#!/usr/bin/env python3
"""Resolve the app version from git tags.

deploy.sh calls this for patch, minor, major, and promoted.
promoted is the vX.Y.Z tag that env/staging points at. It does not bump.
The latest vX.Y.Z tag is the number. version-app.json is written to that number.
A tag whose commit already contains that version is incremented.
A tag whose commit does not contain that version is kept, and the file is set to it.
A commit whose file and tag already match is left as committed.
version-app.json is the base only when the repo has no version tags.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

SEMVER = re.compile(r'^v(\d+)\.(\d+)\.(\d+)$')


class VersionError(Exception):
	pass


def _semver(name: str) -> tuple[int, int, int] | None:
	match = SEMVER.fullmatch(name.strip())
	if match is None:
		return None
	return tuple(int(part) for part in match.groups())


def _tag_names(root: Path, *args: str) -> list[str]:
	out = subprocess.check_output(
		['git', '-C', str(root), 'tag', *args],
		text=True,
	)
	return [line.strip() for line in out.splitlines() if line.strip()]


def tags_on_head(root: Path) -> list[tuple[int, int, int]]:
	found = []
	for name in _tag_names(root, '--points-at', 'HEAD'):
		parsed = _semver(name)
		if parsed is not None:
			found.append(parsed)
	return found


def all_version_tags(root: Path) -> list[tuple[int, int, int]]:
	found = []
	for name in _tag_names(root, '-l'):
		parsed = _semver(name)
		if parsed is not None:
			found.append(parsed)
	return found


def bump(version: tuple[int, int, int], kind: str) -> tuple[int, int, int]:
	major, minor, patch = version
	if kind == 'major':
		return major + 1, 0, 0
	if kind == 'minor':
		return major, minor + 1, 0
	if kind == 'patch':
		return major, minor, patch + 1
	raise VersionError(f'Unknown bump {kind}')


def fmt(version: tuple[int, int, int]) -> str:
	return f'{version[0]}.{version[1]}.{version[2]}'


def _parse_version(current: object) -> tuple[int, int, int] | None:
	parts = str(current).split('.')
	if len(parts) != 3 or not all(part.isdigit() for part in parts):
		return None
	return tuple(int(part) for part in parts)


def read_app_version(root: Path) -> tuple[int, int, int]:
	path = root / 'version-app.json'
	try:
		data = json.loads(path.read_text())
	except FileNotFoundError as error:
		raise VersionError('Refusing release. version-app.json is missing.') from error
	if not isinstance(data, dict):
		raise VersionError('Refusing release. version-app.json is not an object.')
	parsed = _parse_version(data.get('version'))
	if parsed is None:
		raise VersionError(f"Refusing release. version-app.json version is not x.y.z: {data.get('version')}")
	return parsed


def read_app_version_at(root: Path, rev: str) -> tuple[int, int, int] | None:
	proc = subprocess.run(
		['git', '-C', str(root), 'show', f'{rev}:version-app.json'],
		capture_output=True,
		text=True,
	)
	if proc.returncode != 0:
		return None
	try:
		data = json.loads(proc.stdout)
	except json.JSONDecodeError:
		return None
	if not isinstance(data, dict):
		return None
	return _parse_version(data.get('version'))


def _result(version: str, already: bool, base: str, realign: bool = False) -> dict:
	return {
		'version': version,
		'alreadyTagged': already,
		'base': base,
		'realign': realign,
	}


def resolve(root: Path, kind: str) -> dict:
	on_head = tags_on_head(root)
	if len(on_head) > 1:
		names = ', '.join(f'v{fmt(version)}' for version in sorted(on_head))
		raise VersionError(f'Refusing release. Commit has more than one version tag: {names}')
	file_here = read_app_version(root)
	if len(on_head) == 1 and on_head[0] == file_here:
		return _result(fmt(on_head[0]), True, f'v{fmt(on_head[0])}')
	tags = all_version_tags(root)
	if not tags:
		return _result(fmt(bump(file_here, kind)), False, 'version-app.json')
	latest = max(tags)
	tagged_file = read_app_version_at(root, f'v{fmt(latest)}')
	if tagged_file != latest:
		return _result(fmt(latest), False, f'v{fmt(latest)}', realign=True)
	return _result(fmt(bump(latest, kind)), False, f'v{fmt(latest)}')


def promoted_staging_version(root: Path) -> str:
	from deploy_rtdb_deltas import GitRepo

	version = GitRepo(root).env_version('staging')
	if not version:
		raise VersionError('Refusing release. env/staging has no vX.Y.Z tag.')
	return version


def tag_action(root: Path, version: str) -> str:
	parsed = _semver(f'v{version}')
	if parsed is None:
		raise VersionError(f'Refusing release. Version is not x.y.z: {version}')
	tag = f'v{version}'
	probe = subprocess.run(
		['git', '-C', str(root), 'rev-parse', '--verify', f'refs/tags/{tag}^{{commit}}'],
		capture_output=True,
		text=True,
	)
	if probe.returncode != 0:
		return 'create'
	tagged = probe.stdout.strip()
	head = subprocess.check_output(
		['git', '-C', str(root), 'rev-parse', 'HEAD'],
		text=True,
	).strip()
	if tagged == head:
		return 'keep'
	if read_app_version_at(root, tag) == parsed:
		raise VersionError(f'Refusing release. {tag} points at {tagged}, not {head}.')
	return 'move'


def main() -> None:
	parser = argparse.ArgumentParser()
	parser.add_argument('command', choices=['resolve', 'tag-action', 'promoted'])
	parser.add_argument('--root', required=True)
	parser.add_argument('--bump')
	parser.add_argument('--version')
	args = parser.parse_args()
	root = Path(args.root)
	try:
		if args.command == 'tag-action':
			if not args.version:
				raise VersionError('Refusing release. tag-action requires --version.')
			sys.stdout.write(tag_action(root, args.version) + '\n')
			return
		if args.command == 'promoted':
			sys.stdout.write(f'version={promoted_staging_version(root)}\n')
			return
		if not args.bump:
			raise VersionError('Refusing release. resolve requires --bump.')
		result = resolve(root, args.bump)
	except VersionError as error:
		sys.stderr.write(f'{error}\n')
		sys.exit(1)
	if result['alreadyTagged']:
		sys.stderr.write(f"Commit already tagged v{result['version']}. Not incrementing.\n")
	elif result['realign']:
		sys.stderr.write(
			f"Latest tag v{result['version']} does not match version-app.json. "
			f"Setting the file to {result['version']}.\n"
		)
	elif result['base'] == 'version-app.json':
		sys.stderr.write(
			f"Version bump {args.bump}: no version tags, version-app.json -> {result['version']}\n"
		)
	else:
		sys.stderr.write(
			f"Version bump {args.bump}: {result['base']} -> {result['version']}\n"
		)
	print(f"version={result['version']}")
	print(f"alreadyTagged={'1' if result['alreadyTagged'] else '0'}")


if __name__ == '__main__':
	main()
