#!/usr/bin/env python3
"""Walk rules for deploy_rtdb_deltas. No live RTDB, no Cloud Run."""

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

import deploy_rtdb_deltas as walklib
from deploy_rtdb_deltas import (
	MemoryRtdb,
	WalkError,
	backend_target,
	container_image,
	flatten,
	image_matches,
	parse_recipe,
	revision_ready,
	serving_revision_name,
	versions_in_range,
	wait_until_serving,
	walk,
)



def _write_backend_pkg(repo: Path, container: dict) -> None:
	pkg = {'unitConfig': {
		'envs': {'staging': {'projectId': 'booking-staging'}},
		'functions': [{'name': 'api_v1'}],
		'containerDeployment': container,
	}}
	(repo / 'app' / 'backend').mkdir(parents=True)
	(repo / 'app' / 'backend' / 'package.json').write_text(json.dumps(pkg))


class BackendTargetRegionTest(unittest.TestCase):

	def _target(self, container: dict):
		with tempfile.TemporaryDirectory() as tmp:
			repo = Path(tmp)
			_write_backend_pkg(repo, container)
			return backend_target(repo, 'staging')

	def test_cloud_run_lookups_use_run_region_and_image_keeps_image_region(self) -> None:
		project, region, service, image, image_uri = self._target({
			'artifactRegistry': {'region': 'us-central1', 'repository': 'web-apps', 'projectId': 'images-proj'},
			'runRegion': 'europe-west1',
			'imageName': 'booking-backend',
		})
		self.assertEqual(project, 'booking-staging')
		self.assertEqual(region, 'europe-west1')
		self.assertEqual(service, 'api-v1')
		self.assertEqual(image, 'booking-backend')
		self.assertEqual(image_uri, 'us-central1-docker.pkg.dev/images-proj/web-apps/booking-backend')

	def test_run_region_falls_back_to_image_region(self) -> None:
		_, region, _, _, image_uri = self._target({
			'artifactRegistry': {'region': 'us-central1', 'repository': 'web-apps', 'projectId': 'images-proj'},
			'imageName': 'booking-backend',
		})
		self.assertEqual(region, 'us-central1')
		self.assertTrue(image_uri.startswith('us-central1-docker.pkg.dev/'))

class VersionsInRangeTest(unittest.TestCase):
	def test_open_start_inclusive_target_semver_order(self) -> None:
		tags = ['1.0.0', '1.0.2', '1.0.1', '1.1.0']
		self.assertEqual(versions_in_range(tags, '1.0.0', '1.0.2'), ['1.0.1', '1.0.2'])

	def test_empty_start_includes_target_and_history(self) -> None:
		tags = ['0.9.0', '1.0.0']
		self.assertEqual(versions_in_range(tags, None, '1.0.0'), ['0.9.0', '1.0.0'])

	def test_missing_target_tag_fails(self) -> None:
		with self.assertRaises(WalkError):
			versions_in_range(['1.0.0'], '1.0.0', '1.0.1')


class FlattenTest(unittest.TestCase):
	def test_nested_paths_and_null_delete(self) -> None:
		flat = flatten({'ModuleBE_A': {'newKey': 1, 'child': {'n': None}}})
		self.assertEqual(flat, {'ModuleBE_A/newKey': 1, 'ModuleBE_A/child/n': None})

	def test_array_replaces_as_one_value(self) -> None:
		flat = flatten({'ModuleBE_A': {'flags': ['a', 'b']}})
		self.assertEqual(flat, {'ModuleBE_A/flags': ['a', 'b']})

	def test_dot_in_key_fails(self) -> None:
		with self.assertRaises(WalkError):
			flatten({'Module.Name': {'a': 1}})


class RecipeTest(unittest.TestCase):
	def test_rejects_action_ids(self) -> None:
		with self.assertRaises(WalkError):
			parse_recipe({'app': {}, 'steps': ['backfill']}, '1.0.0')


class ServingTest(unittest.TestCase):
	def test_requires_100_percent_on_the_ready_revision(self) -> None:
		desc = {
			'status': {
				'latestReadyRevisionName': 'api-0002',
				'traffic': [{'percent': 100, 'latestRevision': True, 'revisionName': 'api-0002'}],
			}
		}
		self.assertEqual(serving_revision_name(desc), 'api-0002')
		split = {
			'status': {
				'latestReadyRevisionName': 'api-0002',
				'traffic': [
					{'percent': 50, 'revisionName': 'api-0001'},
					{'percent': 50, 'revisionName': 'api-0002'},
				],
			}
		}
		self.assertIsNone(serving_revision_name(split))

	def test_image_must_be_this_tag(self) -> None:
		revision = {
			'spec': {'containers': [{'image': 'us-central1-docker.pkg.dev/p/r/app-backend:1.2.3'}]},
			'status': {'conditions': [{'type': 'Ready', 'status': 'True'}]},
		}
		self.assertTrue(revision_ready(revision))
		self.assertTrue(image_matches(container_image(revision), 'app-backend', '1.2.3'))
		self.assertFalse(image_matches(container_image(revision), 'app-backend', '1.2.30'))
		digest = 'sha256:abc'
		pinned = {
			'spec': {'containers': [{'image': f'us-central1-docker.pkg.dev/p/r/app-backend@{digest}'}]},
		}
		self.assertTrue(image_matches(container_image(pinned), 'app-backend', '1.2.3', digest))
		self.assertFalse(image_matches(container_image(pinned), 'app-backend', '1.2.3', 'sha256:other'))

	def test_wait_accepts_the_digest_cloud_run_stores(self) -> None:
		digest = 'sha256:abc'

		def gcloud(args: list[str]) -> dict:
			if args[0] == 'artifacts':
				return {'image_summary': {'digest': digest}}
			if args[1] == 'services':
				return {
					'status': {
						'latestReadyRevisionName': 'api-0002',
						'traffic': [{'percent': 100, 'latestRevision': True, 'revisionName': 'api-0002'}],
					}
				}
			return {
				'spec': {'containers': [{'image': f'us-central1-docker.pkg.dev/p/r/app-backend@{digest}'}]},
				'status': {'conditions': [{'type': 'Ready', 'status': 'True'}]},
			}

		wait_until_serving(
			'replace-staging', 'us-central1', 'api', 'app-backend', '1.2.3',
			image_uri='us-central1-docker.pkg.dev/p/r/app-backend',
			gcloud=gcloud, timeout=1, interval=0, sleep=lambda _s: (_ for _ in ()).throw(AssertionError('sleep')),
		)

	def test_wait_returns_when_the_serving_image_is_this_tag(self) -> None:
		def gcloud(args: list[str]) -> dict:
			if args[1] == 'services':
				return {
					'status': {
						'latestReadyRevisionName': 'api-0002',
						'traffic': [{'percent': 100, 'latestRevision': True, 'revisionName': 'api-0002'}],
					}
				}
			return {
				'spec': {'containers': [{'image': 'us-central1-docker.pkg.dev/p/r/app-backend:1.2.3'}]},
				'status': {'conditions': [{'type': 'Ready', 'status': 'True'}]},
			}

		wait_until_serving(
			'replace-staging', 'us-central1', 'api', 'app-backend', '1.2.3',
			gcloud=gcloud, timeout=1, interval=0, sleep=lambda _s: (_ for _ in ()).throw(AssertionError('sleep')),
		)

	def test_wait_fails_when_the_serving_image_is_older(self) -> None:
		def gcloud(args: list[str]) -> dict:
			if args[1] == 'services':
				return {
					'status': {
						'latestReadyRevisionName': 'api-0001',
						'traffic': [{'percent': 100, 'latestRevision': True}],
					}
				}
			return {
				'spec': {'containers': [{'image': 'x/app-backend:1.0.0'}]},
				'status': {'conditions': [{'type': 'Ready', 'status': 'True'}]},
			}

		clock = {'t': 0.0}

		def now() -> float:
			clock['t'] += 10
			return clock['t']

		with self.assertRaises(WalkError):
			wait_until_serving(
				'p', 'us-central1', 'api', 'app-backend', '1.2.3',
				gcloud=gcloud, timeout=5, interval=1, now=now, sleep=lambda _s: None,
			)


class WalkTest(unittest.TestCase):
	def test_applies_in_order_then_second_run_is_noop(self) -> None:
		recipes = {
			'1.0.1': {'app': {'ModuleBE_A': {'added': True}}},
			'1.0.2': {'default': {'ModuleBE_B': {'n': 2}}, 'app': {'ModuleBE_A': {'added': False}}},
		}
		rtdb = MemoryRtdb()
		waited: list[str] = []
		walk(
			target='1.0.2',
			env_version='1.0.0',
			tags=['1.0.0', '1.0.1', '1.0.2'],
			recipe_for=recipes.get,
			rtdb=rtdb,
			wait=lambda: waited.append('yes'),
		)
		self.assertEqual(waited, ['yes'])
		self.assertEqual(rtdb.patches, [
			('app', {'ModuleBE_A/added': True}),
			('default', {'ModuleBE_B/n': 2}),
			('app', {'ModuleBE_A/added': False}),
		])
		self.assertIn('1-0-1', rtdb.journal)
		self.assertEqual(rtdb.journal['1-0-2']['version'], '1.0.2')
		self.assertEqual(rtdb.current_writes, ['1.0.2'])

		again = MemoryRtdb(rtdb.journal)
		walk(
			target='1.0.2',
			env_version='1.0.2',
			tags=['1.0.0', '1.0.1', '1.0.2'],
			recipe_for=recipes.get,
			rtdb=again,
			wait=lambda: waited.append('again'),
		)
		self.assertEqual(again.patches, [])
		self.assertEqual(again.current_writes, [])
		self.assertEqual(waited, ['yes'])

	def test_journal_hit_is_not_patched_again(self) -> None:
		rtdb = MemoryRtdb({'1-0-1': {'version': '1.0.1', 'app': {}}, '_currentVersion': '1.0.0'})
		walk(
			target='1.0.1',
			env_version='1.0.0',
			tags=['1.0.0', '1.0.1'],
			recipe_for=lambda version: {'app': {'ModuleBE_A': {'added': True}}},
			rtdb=rtdb,
			wait=lambda: None,
		)
		self.assertEqual(rtdb.patches, [])
		self.assertEqual(rtdb.current_writes, ['1.0.1'])

	def test_missing_recipe_still_advances_the_pointer(self) -> None:
		rtdb = MemoryRtdb()
		walk(
			target='1.0.1',
			env_version=None,
			tags=['1.0.1'],
			recipe_for=lambda version: None,
			rtdb=rtdb,
			wait=lambda: None,
		)
		self.assertEqual(rtdb.patches, [])
		self.assertEqual(rtdb.journal['_currentVersion'], '1.0.1')
		self.assertNotIn('1-0-1', rtdb.journal)

	def test_older_target_does_not_write(self) -> None:
		rtdb = MemoryRtdb({'_currentVersion': '1.0.2'})
		walk(
			target='1.0.1',
			env_version='1.0.2',
			tags=['1.0.1', '1.0.2'],
			recipe_for=lambda version: {'app': {'ModuleBE_A': {'added': True}}},
			rtdb=rtdb,
			wait=lambda: (_ for _ in ()).throw(AssertionError('wait')),
		)
		self.assertEqual(rtdb.patches, [])
		self.assertEqual(rtdb.current_writes, [])

	def test_journal_beats_env_tag(self) -> None:
		rtdb = MemoryRtdb({'_currentVersion': '1.0.1'})
		walk(
			target='1.0.2',
			env_version='1.0.0',
			tags=['1.0.0', '1.0.1', '1.0.2'],
			recipe_for=lambda version: {'app': {'ModuleBE_A': {'from': version}}} if version == '1.0.2' else None,
			rtdb=rtdb,
			wait=lambda: None,
		)
		self.assertEqual([item[0] for item in rtdb.patches], ['app'])
		self.assertEqual(rtdb.patches[0][1], {'ModuleBE_A/from': '1.0.2'})


class GitRecipeTest(unittest.TestCase):
	def test_reads_recipe_at_the_tag(self) -> None:
		with tempfile.TemporaryDirectory() as tmp:
			root = Path(tmp)
			subprocess.run(['git', 'init'], cwd=root, check=True, capture_output=True)
			subprocess.run(['git', 'config', '--local', 'user.email', 't@example.com'], cwd=root, check=True)
			subprocess.run(['git', 'config', '--local', 'user.name', 't'], cwd=root, check=True)
			(root / 'README').write_text('a\n')
			subprocess.run(['git', 'add', 'README'], cwd=root, check=True)
			subprocess.run(['git', 'commit', '-m', 'init'], cwd=root, check=True, capture_output=True)
			subprocess.run(['git', 'tag', 'v1.0.0'], cwd=root, check=True)
			release = root / 'releases'
			release.mkdir()
			(release / '1.0.1.json').write_text(json.dumps({'app': {'ModuleBE_A': {'k': 1}}}))
			subprocess.run(['git', 'add', 'releases/1.0.1.json'], cwd=root, check=True)
			subprocess.run(['git', 'commit', '-m', 'delta'], cwd=root, check=True, capture_output=True)
			subprocess.run(['git', 'tag', 'v1.0.1'], cwd=root, check=True)
			subprocess.run(['git', 'tag', '-f', 'env/staging', 'v1.0.0'], cwd=root, check=True)
			git = walklib.GitRepo(root)
			self.assertEqual(git.env_version('staging'), '1.0.0')
			self.assertIsNone(git.recipe('1.0.0'))
			self.assertEqual(git.recipe('1.0.1'), {'app': {'ModuleBE_A': {'k': 1}}})
			self.assertEqual(git.merged_versions('1.0.1'), ['1.0.0', '1.0.1'])


if __name__ == '__main__':
	unittest.main()
