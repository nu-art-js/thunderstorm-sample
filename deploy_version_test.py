#!/usr/bin/env python3
"""Tag rules for deploy_version. No network, no Cloud Run."""

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

import deploy_version
from deploy_version import VersionError, promoted_staging_version, resolve, tag_action


def git(root: Path, *args: str) -> None:
	subprocess.check_call(['git', '-C', str(root), *args], stdout=subprocess.DEVNULL)


def repo() -> Path:
	root = Path(tempfile.mkdtemp())
	git(root, 'init', '-b', 'main')
	git(root, 'config', 'user.email', 'test@example.com')
	git(root, 'config', 'user.name', 'test')
	commit_version(root, '0.1.0')
	return root


def commit_version(root: Path, version: str) -> None:
	(root / 'version-app.json').write_text(json.dumps({'version': version}) + '\n')
	git(root, 'add', 'version-app.json')
	git(root, 'commit', '-m', f'Set app version to {version}.')


class ResolveVersionTest(unittest.TestCase):
	def test_untagged_commit_increments_latest_semver_not_lexical_order(self) -> None:
		root = repo()
		commit_version(root, '0.1.9')
		git(root, 'tag', 'v0.1.9')
		commit_version(root, '0.1.10')
		git(root, 'tag', 'v0.1.10')
		(root / 'file').write_text('next\n')
		git(root, 'add', 'file')
		git(root, 'commit', '-m', 'untagged')
		result = resolve(root, 'patch')
		self.assertEqual(result['version'], '0.1.11')
		self.assertFalse(result['alreadyTagged'])
		self.assertEqual(result['base'], 'v0.1.10')

	def test_tagged_commit_is_used_as_is_when_the_file_matches(self) -> None:
		root = repo()
		commit_version(root, '0.1.2')
		git(root, 'tag', 'v0.1.2')
		(root / 'file').write_text('later\n')
		git(root, 'add', 'file')
		git(root, 'commit', '-m', 'later')
		commit_version(root, '0.1.10')
		git(root, 'tag', 'v0.1.10')
		git(root, 'checkout', 'v0.1.2', '--detach')
		result = resolve(root, 'patch')
		self.assertEqual(result['version'], '0.1.2')
		self.assertTrue(result['alreadyTagged'])

	def test_latest_tag_with_a_stale_file_is_kept_and_not_bumped(self) -> None:
		root = repo()
		git(root, 'tag', 'v0.1.181')
		result = resolve(root, 'patch')
		self.assertEqual(result['version'], '0.1.181')
		self.assertTrue(result['realign'])
		self.assertFalse(result['alreadyTagged'])

	def test_minor_and_major_increment_from_the_latest_tag(self) -> None:
		root = repo()
		commit_version(root, '1.2.3')
		git(root, 'tag', 'v1.2.3')
		(root / 'file').write_text('next\n')
		git(root, 'add', 'file')
		git(root, 'commit', '-m', 'untagged')
		self.assertEqual(resolve(root, 'minor')['version'], '1.3.0')
		self.assertEqual(resolve(root, 'major')['version'], '2.0.0')

	def test_no_tags_falls_back_to_version_app_json(self) -> None:
		root = repo()
		result = resolve(root, 'patch')
		self.assertEqual(result['version'], '0.1.1')
		self.assertEqual(result['base'], 'version-app.json')

	def test_two_version_tags_on_the_commit_are_refused(self) -> None:
		root = repo()
		git(root, 'tag', 'v0.1.2')
		git(root, 'tag', 'v0.1.3')
		with self.assertRaises(VersionError):
			resolve(root, 'patch')

	def test_tag_action_moves_a_tag_whose_file_disagrees(self) -> None:
		root = repo()
		git(root, 'tag', 'v0.1.181')
		(root / 'file').write_text('next\n')
		git(root, 'add', 'file')
		git(root, 'commit', '-m', 'next')
		self.assertEqual(tag_action(root, '0.1.181'), 'move')

	def test_promoted_is_the_version_tag_on_env_staging(self) -> None:
		root = repo()
		commit_version(root, '0.1.9')
		git(root, 'tag', 'v0.1.9')
		git(root, 'tag', 'env/staging', 'v0.1.9')
		self.assertEqual(promoted_staging_version(root), '0.1.9')

	def test_promoted_refuses_when_env_staging_has_no_version_tag(self) -> None:
		root = repo()
		with self.assertRaises(VersionError):
			promoted_staging_version(root)

	def test_tag_action_refuses_a_tag_that_already_contains_the_version(self) -> None:
		root = repo()
		commit_version(root, '0.1.5')
		git(root, 'tag', 'v0.1.5')
		(root / 'file').write_text('next\n')
		git(root, 'add', 'file')
		git(root, 'commit', '-m', 'next')
		with self.assertRaises(VersionError):
			tag_action(root, '0.1.5')


if __name__ == '__main__':
	unittest.main()
