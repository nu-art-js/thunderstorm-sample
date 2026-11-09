#!/usr/bin/env python3
"""Smoke a deploy before env/<env> moves.

deploy.sh calls this on deploy and full, after the RTDB walk, and before the
env pointer moves. build does not. A failure is the signal to roll that plane
back once.

Product names live in DEFAULTS below, or in deploy-smoke.json when that file
exists. This checkout has no public hosts and no hostingSite, so those probes
are skipped. A backend unit still waits until Cloud Run serves the image.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from deploy_rtdb_deltas import WalkError, backend_target, gcloud_json, wait_until_serving

# Temporary product table for this boilerplate. Replace the file or this dict
# when the script moves to a real app.
DEFAULTS: dict[str, Any] = {
	'userAgent': 'deploy-smoke',
	'mcpPath': '',
	'planes': {
		'staging': {},
		'prod': {},
	},
	'units': {
		'@app/backend': {'role': 'backend'},
		'@app/frontend-vite': {'role': 'hosting', 'folder': 'frontend-vite'},
	},
}


class SmokeError(Exception):
	pass


@dataclass(frozen=True)
class Probe:
	kind: str
	url: str
	label: str


def load_config(repo: Path) -> dict[str, Any]:
	path = repo / 'deploy-smoke.json'
	if not path.exists():
		return DEFAULTS
	data = json.loads(path.read_text())
	if not isinstance(data, dict):
		raise SmokeError('deploy-smoke.json is not an object')
	return data


def status_ok(kind: str, status: int) -> bool:
	if kind == 'hosting':
		return status == 200
	if kind == 'api':
		return 200 <= status < 500
	if kind == 'mcp':
		return status in (200, 401)
	raise SmokeError(f'unknown probe kind {kind}')


def build_probes(
	units: list[str],
	env: str,
	*,
	sites: dict[str, str | None],
	cloud_run: str | None,
	config: dict[str, Any],
) -> list[Probe]:
	planes = config.get('planes') or {}
	if env not in planes:
		raise SmokeError(f'no public hosts for env {env}')
	plane = planes[env] if isinstance(planes[env], dict) else {}
	unit_cfg = config.get('units') or {}
	unknown = [unit for unit in units if unit not in unit_cfg]
	if unknown:
		raise SmokeError(f'no smoke for {", ".join(unknown)}')
	if not units:
		raise SmokeError('no units to smoke')

	mcp = str(config.get('mcpPath') or '')
	probes: list[Probe] = []
	for unit in units:
		spec = unit_cfg[unit]
		role = spec.get('role') if isinstance(spec, dict) else None
		if role == 'hosting':
			apex = plane.get('apex')
			if isinstance(apex, str) and apex:
				probes.append(Probe('hosting', f'{apex.rstrip("/")}/', f'{unit} apex'))
			site = sites.get(unit)
			if site:
				probes.append(Probe('hosting', f'https://{site}.web.app/', f'{unit} hosting'))
		elif role == 'backend':
			api = plane.get('api')
			if isinstance(api, str) and api:
				origin = api.rstrip('/')
				probes.append(Probe('api', f'{origin}/', 'api domain'))
				if mcp:
					probes.append(Probe('mcp', f'{origin}{mcp}', 'api mcp'))
			if cloud_run:
				origin = cloud_run.rstrip('/')
				probes.append(Probe('api', f'{origin}/', 'cloud run'))
				if mcp:
					probes.append(Probe('mcp', f'{origin}{mcp}', 'cloud run mcp'))
		else:
			raise SmokeError(f'unknown smoke role for {unit}')
	return probes


def fetch_status(url: str, timeout: float = 20, user_agent: str = 'deploy-smoke') -> int:
	req = urllib.request.Request(url, method='GET', headers={'User-Agent': user_agent})
	try:
		with urllib.request.urlopen(req, timeout=timeout) as resp:
			return int(resp.status)
	except urllib.error.HTTPError as exc:
		return int(exc.code)


def probe_until(
	probe: Probe,
	*,
	fetch: Callable[[str], int] = fetch_status,
	timeout: float = 45,
	interval: float = 5,
	log: Callable[[str], None] = print,
	sleep: Callable[[float], None] = time.sleep,
	now: Callable[[], float] = time.time,
) -> None:
	"""Poll until the probe matches or the budget passes. First try is immediate."""
	deadline = now() + timeout
	last = 'no response'
	while True:
		try:
			status = fetch(probe.url)
		except urllib.error.URLError as exc:
			last = str(exc.reason)
		else:
			last = str(status)
			if status_ok(probe.kind, status):
				log(f'smoke {status} {probe.url}')
				return
		if now() >= deadline:
			raise SmokeError(f'{probe.label} not ready ({last}) {probe.url}')
		log(f'smoke wait {probe.url} ({last})')
		sleep(interval)


def hosting_site(repo: Path, folder: str, env: str) -> str | None:
	found = False
	for name in ('package.json', '__package.json'):
		path = repo / 'app' / folder / name
		if not path.exists():
			continue
		found = True
		pkg = json.loads(path.read_text())
		site = (((pkg.get('unitConfig') or {}).get('envs') or {}).get(env) or {}).get('hostingSite')
		if isinstance(site, str) and site:
			return site
	if not found:
		raise SmokeError(f'app/{folder}/package.json is missing')
	return None


def cloud_run_url(
	project: str,
	region: str,
	service: str,
	gcloud: Callable[[list[str]], dict] = gcloud_json,
) -> str:
	desc = gcloud(['run', 'services', 'describe', service, f'--project={project}', f'--region={region}'])
	url = (desc.get('status') or {}).get('url')
	if not isinstance(url, str) or not url.startswith('https://'):
		raise SmokeError(f'{service} has no Cloud Run URL')
	return url


def smoke(
	*,
	repo: Path,
	version: str,
	env: str,
	units: list[str],
	fetch: Callable[[str], int] | None = None,
	gcloud: Callable[[list[str]], dict] = gcloud_json,
	wait: Callable[..., None] = wait_until_serving,
	log: Callable[[str], None] = print,
	sleep: Callable[[float], None] = time.sleep,
	now: Callable[[], float] = time.time,
) -> None:
	config = load_config(repo)
	user_agent = str(config.get('userAgent') or 'deploy-smoke')
	if fetch is None:
		def fetch(url: str, _agent: str = user_agent) -> int:
			return fetch_status(url, user_agent=_agent)

	unit_cfg = config.get('units') or {}
	cloud_run = None
	sites: dict[str, str | None] = {}
	if any((unit_cfg.get(unit) or {}).get('role') == 'backend' for unit in units):
		project, region, service, image_name, image_uri = backend_target(repo, env)
		wait(project, region, service, image_name, version, image_uri=image_uri, gcloud=gcloud, log=log)
		cloud_run = cloud_run_url(project, region, service, gcloud)
		log(f'cloud run {cloud_run}')
	for unit in units:
		spec = unit_cfg.get(unit) or {}
		if spec.get('role') != 'hosting':
			continue
		folder = spec.get('folder')
		if not isinstance(folder, str) or not folder:
			raise SmokeError(f'{unit} has no hosting folder')
		sites[unit] = hosting_site(repo, folder, env)
	probes = build_probes(units, env, sites=sites, cloud_run=cloud_run, config=config)
	if not probes:
		log(f'smoke: no HTTP probes for {env}')
		return
	for probe in probes:
		probe_until(probe, fetch=fetch, log=log, sleep=sleep, now=now)


def parse_units(raw: str) -> list[str]:
	return [part.strip() for part in raw.split(',') if part.strip()]


def run(argv: list[str] | None = None) -> int:
	parser = argparse.ArgumentParser(description='Smoke one deploy.')
	parser.add_argument('--version', required=True, help='Semver being deployed, without the v prefix')
	parser.add_argument('--env', required=True, help='staging or prod')
	parser.add_argument('--repo', default='.', help='Checkout that contains the unit configs')
	parser.add_argument('--units', required=True, help='Comma-separated package names this deploy shipped')
	args = parser.parse_args(argv)
	version = args.version[1:] if args.version.startswith('v') else args.version
	smoke(repo=Path(args.repo).resolve(), version=version, env=args.env, units=parse_units(args.units))
	print(f'deployment smoke passed v{version} ({args.env})')
	return 0


def main(argv: list[str] | None = None) -> int:
	try:
		return run(argv)
	except (SmokeError, WalkError) as exc:
		print(f'deployment smoke failed: {exc}', file=sys.stderr)
		return 1


if __name__ == '__main__':
	sys.exit(main())
