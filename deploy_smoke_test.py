#!/usr/bin/env python3
"""Probe rules for deploy_smoke. No live hosts, no Cloud Run."""

from __future__ import annotations

import json
import unittest
import urllib.error
from pathlib import Path
from tempfile import TemporaryDirectory

import deploy_smoke
from deploy_smoke import DEFAULTS, Probe, SmokeError, build_probes, hosting_site, probe_until, smoke, status_ok


def _package(site: str | None) -> str:
	envs = {'staging': {}}
	if site:
		envs['staging']['hostingSite'] = site
	return json.dumps({'unitConfig': {'envs': envs}})


class StatusTest(unittest.TestCase):
	def test_hosting_is_200_only(self) -> None:
		self.assertTrue(status_ok('hosting', 200))
		self.assertFalse(status_ok('hosting', 404))

	def test_api_accepts_the_live_root_404(self) -> None:
		self.assertTrue(status_ok('api', 404))
		self.assertFalse(status_ok('api', 500))

	def test_mcp_is_up_when_unauthenticated(self) -> None:
		self.assertTrue(status_ok('mcp', 401))
		self.assertFalse(status_ok('mcp', 404))


class PlanTest(unittest.TestCase):
	def test_default_units_probe_cloud_run_and_hosting_site(self) -> None:
		probes = build_probes(
			['@app/backend', '@app/frontend-vite'],
			'staging',
			sites={'@app/frontend-vite': 'app-staging'},
			cloud_run='https://api-example.a.run.app',
			config=DEFAULTS,
		)
		self.assertEqual([probe.url for probe in probes], [
			'https://api-example.a.run.app/',
			'https://app-staging.web.app/',
		])

	def test_json_planes_add_apex_api_and_mcp(self) -> None:
		config = {
			'planes': {'staging': {'apex': 'https://app-staging.example', 'api': 'https://api.app-staging.example'}},
			'mcpPath': '/mcp/app',
			'units': {
				'@app/backend': {'role': 'backend'},
				'@app/frontend-vite': {'role': 'hosting', 'folder': 'frontend-vite'},
			},
		}
		probes = build_probes(
			['@app/frontend-vite', '@app/backend'],
			'staging',
			sites={'@app/frontend-vite': 'app-staging'},
			cloud_run='https://api-example.a.run.app',
			config=config,
		)
		self.assertEqual([probe.url for probe in probes], [
			'https://app-staging.example/',
			'https://app-staging.web.app/',
			'https://api.app-staging.example/',
			'https://api.app-staging.example/mcp/app',
			'https://api-example.a.run.app/',
			'https://api-example.a.run.app/mcp/app',
		])

	def test_missing_hosting_site_skips_that_probe(self) -> None:
		probes = build_probes(
			['@app/frontend-vite'],
			'staging',
			sites={'@app/frontend-vite': None},
			cloud_run=None,
			config=DEFAULTS,
		)
		self.assertEqual(probes, [])

	def test_unknown_unit_and_unknown_env_fail(self) -> None:
		with self.assertRaises(SmokeError):
			build_probes(['@app/other'], 'staging', sites={}, cloud_run=None, config=DEFAULTS)
		with self.assertRaises(SmokeError):
			build_probes(['@app/frontend-vite'], 'local', sites={}, cloud_run=None, config=DEFAULTS)


class RetryTest(unittest.TestCase):
	def test_later_401_passes_without_burning_the_budget(self) -> None:
		seen = {'n': 0}

		def fetch(_url: str) -> int:
			seen['n'] += 1
			return 503 if seen['n'] < 3 else 401

		clock = {'t': 0.0}
		probe_until(
			Probe('mcp', 'https://api-example.a.run.app/mcp/app', 'cloud run mcp'),
			fetch=fetch,
			timeout=45,
			interval=5,
			log=lambda _m: None,
			sleep=lambda seconds: clock.__setitem__('t', clock['t'] + seconds),
			now=lambda: clock['t'],
		)
		self.assertEqual(seen['n'], 3)
		self.assertEqual(clock['t'], 10)

	def test_connection_error_retries(self) -> None:
		seen = {'n': 0}

		def fetch(_url: str) -> int:
			seen['n'] += 1
			if seen['n'] == 1:
				raise urllib.error.URLError('timed out')
			return 200

		probe_until(
			Probe('hosting', 'https://app-staging.web.app/', 'hosting'),
			fetch=fetch,
			timeout=45,
			interval=5,
			log=lambda _m: None,
			sleep=lambda _s: None,
			now=lambda: 0,
		)
		self.assertEqual(seen['n'], 2)


class SmokeWiringTest(unittest.TestCase):
	def test_backend_waits_then_probes_the_origin_it_just_read(self) -> None:
		with TemporaryDirectory() as tmp:
			root = Path(tmp)
			front = root / 'app' / 'frontend-vite'
			backend = root / 'app' / 'backend'
			front.mkdir(parents=True)
			backend.mkdir(parents=True)
			(front / '__package.json').write_text(_package('app-staging'))
			(backend / '__package.json').write_text(json.dumps({
				'unitConfig': {
					'functions': ['api'],
					'containerDeployment': {
						'artifactRegistry': {
							'region': 'us-central1',
							'repository': 'web-apps',
							'projectId': 'images-proj',
						},
						'imageName': 'app-backend',
					},
					'envs': {'staging': {'projectId': 'app-staging'}},
				},
			}))
			waited: list[str] = []
			fetched: list[str] = []

			def wait(*_args, **kwargs) -> None:
				waited.append(kwargs['image_uri'])

			def gcloud(args: list[str]) -> dict:
				self.assertEqual(args[0], 'run')
				return {'status': {'url': 'https://api-example.a.run.app'}}

			def fetch(url: str) -> int:
				fetched.append(url)
				return 200

			smoke(
				repo=root,
				version='1.2.3',
				env='staging',
				units=['@app/backend', '@app/frontend-vite'],
				fetch=fetch,
				gcloud=gcloud,
				wait=wait,
				log=lambda _m: None,
				sleep=lambda _s: (_ for _ in ()).throw(AssertionError('sleep')),
				now=lambda: 0,
			)
			self.assertEqual(waited, ['us-central1-docker.pkg.dev/images-proj/web-apps/app-backend'])
			self.assertEqual(fetched, [
				'https://api-example.a.run.app/',
				'https://app-staging.web.app/',
			])

	def test_hosting_site_prefers_package_json(self) -> None:
		with TemporaryDirectory() as tmp:
			folder = Path(tmp)
			app = folder / 'app' / 'frontend-vite'
			app.mkdir(parents=True)
			(app / '__package.json').write_text(_package('from-source'))
			(app / 'package.json').write_text(_package('from-prepare'))
			self.assertEqual(hosting_site(folder, 'frontend-vite', 'staging'), 'from-prepare')

	def test_missing_hosting_site_is_skipped(self) -> None:
		with TemporaryDirectory() as tmp:
			folder = Path(tmp)
			app = folder / 'app' / 'frontend-vite'
			app.mkdir(parents=True)
			(app / '__package.json').write_text(_package(None))
			self.assertIsNone(hosting_site(folder, 'frontend-vite', 'staging'))


class CliTest(unittest.TestCase):
	def test_main_prints_the_failure(self) -> None:
		code = deploy_smoke.main(['--version', '1.2.3', '--env', 'dev', '--units', '@app/frontend-vite', '--repo', '.'])
		self.assertEqual(code, 1)


if __name__ == '__main__':
	unittest.main()
