#!/usr/bin/env python3
"""Apply versioned RTDB config deltas after the backend revision is serving.

Git at tag v<semver> is the recipe: releases/<semver>.json with only `default`
and/or `app` (module name → keys to merge). RTDB is the journal:
/_config/versions/<semver with dots as hyphens> and /_config/versions/_currentVersion
(the dotted semver). Firebase keys cannot contain '.'.

deploy.sh calls this on deploy/full after the image deploy and before env/<env> moves.
build does not. Same _currentVersion as the target is a no-op. A lower target does
not roll deltas back.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Callable

ILLEGAL_KEY_CHARS = '.$[]#/'
SLICES = ('default', 'app')


class WalkError(Exception):
	pass


def semver_key(version: str) -> tuple[int, int, int]:
	parts = version.split('.')
	if len(parts) != 3 or not all(part.isdigit() for part in parts):
		raise WalkError(f'not a numeric semver: {version}')
	return tuple(int(part) for part in parts)


def hyphen_key(version: str) -> str:
	semver_key(version)
	return version.replace('.', '-')


def versions_in_range(tags: list[str], start: str | None, target: str) -> list[str]:
	"""Tags in (start, target], semver order. start None includes everything ≤ target."""
	target_key = semver_key(target)
	start_key = semver_key(start) if start else None
	if target not in tags:
		raise WalkError(f'tag v{target} is missing from the merged tag list')
	chosen: list[str] = []
	for tag in tags:
		key = semver_key(tag)
		if key > target_key:
			continue
		if start_key is not None and key <= start_key:
			continue
		chosen.append(tag)
	chosen.sort(key=semver_key)
	return chosen


def flatten(body: dict[str, Any], prefix: str = '') -> dict[str, Any]:
	"""Deep-merge map for a Firebase multi-path PATCH. Arrays and scalars replace."""
	out: dict[str, Any] = {}

	def walk(value: Any, path: str) -> None:
		if isinstance(value, dict):
			for key, child in value.items():
				if not isinstance(key, str) or not key or any(char in key for char in ILLEGAL_KEY_CHARS):
					raise WalkError(f'illegal RTDB key {key!r}')
				child_path = f'{path}/{key}' if path else key
				walk(child, child_path)
			return
		if not path:
			raise WalkError('delta path is empty')
		out[path] = value

	walk(body, prefix)
	return out


def parse_recipe(data: Any, version: str) -> dict[str, Any]:
	if not isinstance(data, dict):
		raise WalkError(f'releases/{version}.json must be an object')
	extra = set(data) - set(SLICES)
	if extra:
		names = ', '.join(sorted(extra))
		raise WalkError(f'releases/{version}.json has keys outside default/app: {names}')
	for slice_name in SLICES:
		if slice_name not in data:
			continue
		body = data[slice_name]
		if not isinstance(body, dict):
			raise WalkError(f'releases/{version}.json {slice_name} must be an object')
		for module, cfg in body.items():
			if not isinstance(module, str) or not module:
				raise WalkError(f'releases/{version}.json {slice_name} has an empty module name')
			if not isinstance(cfg, dict):
				raise WalkError(f'releases/{version}.json {slice_name}.{module} must be an object of keys')
	return data


def serving_revision_name(service_desc: dict[str, Any]) -> str | None:
	status = service_desc.get('status') or {}
	ready = status.get('latestReadyRevisionName')
	traffic = status.get('traffic') or []
	full = [item for item in traffic if int(item.get('percent') or 0) == 100]
	if len(full) != 1 or not ready:
		return None
	item = full[0]
	name = ready if item.get('latestRevision') else item.get('revisionName')
	if name != ready:
		return None
	return name


def container_image(revision: dict[str, Any]) -> str:
	containers = ((revision.get('spec') or {}).get('containers')) or []
	if not containers:
		return ''
	return containers[0].get('image') or ''


def revision_ready(revision: dict[str, Any]) -> bool:
	for condition in (revision.get('status') or {}).get('conditions') or []:
		if condition.get('type') == 'Ready':
			return condition.get('status') == 'True'
	return False


def image_matches(image: str, image_name: str, version: str, digest: str | None = None) -> bool:
	leaf = image.rsplit('/', 1)[-1]
	if leaf == f'{image_name}:{version}':
		return True
	# Cloud Run rewrites a tag to the digest it resolved at deploy time.
	if not digest:
		return False
	name, sep, pin = leaf.partition('@')
	return bool(sep) and name == image_name and pin == digest


def journal_has(journal: dict[str, Any], version: str) -> bool:
	return isinstance(journal.get(hyphen_key(version)), dict)


class GitRepo:
	def __init__(self, repo: Path):
		self.repo = repo

	def _git(self, *args: str) -> subprocess.CompletedProcess[str]:
		return subprocess.run(
			['git', '-C', str(self.repo), *args],
			check=False,
			capture_output=True,
			text=True,
		)

	def require_tag(self, version: str) -> None:
		proc = self._git('rev-parse', '--verify', f'refs/tags/v{version}')
		if proc.returncode != 0:
			raise WalkError(f'tag v{version} is not in this clone — fetch tags, then deploy that tag')

	def merged_versions(self, target: str) -> list[str]:
		self.require_tag(target)
		proc = self._git('tag', '--merged', f'v{target}')
		if proc.returncode != 0:
			raise WalkError(proc.stderr.strip() or f'git tag --merged v{target} failed')
		versions: list[str] = []
		for line in proc.stdout.splitlines():
			name = line.strip()
			if not name.startswith('v'):
				continue
			version = name[1:]
			try:
				semver_key(version)
			except WalkError:
				continue
			versions.append(version)
		versions.sort(key=semver_key)
		return versions

	def env_version(self, env: str) -> str | None:
		proc = self._git('tag', '--points-at', f'env/{env}')
		if proc.returncode != 0:
			return None
		versions: list[str] = []
		for line in proc.stdout.splitlines():
			name = line.strip()
			if not name.startswith('v'):
				continue
			version = name[1:]
			try:
				semver_key(version)
			except WalkError:
				continue
			versions.append(version)
		if not versions:
			return None
		return max(versions, key=semver_key)

	def recipe(self, version: str) -> dict[str, Any] | None:
		proc = self._git('show', f'v{version}:releases/{version}.json')
		if proc.returncode != 0:
			return None
		try:
			data = json.loads(proc.stdout)
		except json.JSONDecodeError as exc:
			raise WalkError(f'releases/{version}.json is not JSON: {exc}') from exc
		return parse_recipe(data, version)


class MemoryRtdb:
	"""In-memory journal + slices for tests and --dry-run."""

	def __init__(self, journal: dict[str, Any] | None = None):
		self.journal: dict[str, Any] = dict(journal or {})
		self.patches: list[tuple[str, dict[str, Any]]] = []
		self.current_writes: list[str] = []

	def read_journal(self) -> dict[str, Any]:
		return dict(self.journal)

	def patch_slice(self, slice_name: str, flat: dict[str, Any]) -> None:
		self.patches.append((slice_name, dict(flat)))

	def write_journal_version(self, version: str, body: dict[str, Any]) -> None:
		self.journal[hyphen_key(version)] = body

	def write_current(self, version: str) -> None:
		self.journal['_currentVersion'] = version
		self.current_writes.append(version)


class HttpRtdb:
	def __init__(self, project: str, token: str):
		self.base = f'https://{project}-default-rtdb.firebaseio.com'
		self.token = token

	def _request(self, method: str, path: str, body: Any | None = None) -> Any:
		query = urllib.parse.urlencode({'access_token': self.token})
		url = f'{self.base}/{path}.json?{query}'
		data = None if body is None else json.dumps(body).encode()
		req = urllib.request.Request(url, data=data, method=method)
		if data is not None:
			req.add_header('Content-Type', 'application/json')
		try:
			with urllib.request.urlopen(req, timeout=30) as resp:
				raw = resp.read().decode()
		except urllib.error.HTTPError as exc:
			detail = exc.read().decode(errors='replace')
			raise WalkError(f'RTDB {method} {path} failed ({exc.code}): {detail}') from exc
		except urllib.error.URLError as exc:
			raise WalkError(f'RTDB {method} {path} failed: {exc.reason}') from exc
		if not raw:
			return None
		return json.loads(raw)

	def read_journal(self) -> dict[str, Any]:
		data = self._request('GET', '_config/versions')
		if data is None:
			return {}
		if not isinstance(data, dict):
			raise WalkError('/_config/versions is not an object')
		return data

	def patch_slice(self, slice_name: str, flat: dict[str, Any]) -> None:
		if slice_name not in SLICES:
			raise WalkError(f'unknown config slice {slice_name}')
		self._request('PATCH', f'_config/{slice_name}', flat)

	def write_journal_version(self, version: str, body: dict[str, Any]) -> None:
		self._request('PUT', f'_config/versions/{hyphen_key(version)}', body)

	def write_current(self, version: str) -> None:
		self._request('PUT', '_config/versions/_currentVersion', version)


def backend_target(repo: Path, env: str) -> tuple[str, str, str, str, str]:
	pkg_path = repo / 'app' / 'backend' / 'package.json'
	pkg = json.loads(pkg_path.read_text())
	unit = pkg['unitConfig']
	env_cfg = (unit.get('envs') or {}).get(env)
	if not isinstance(env_cfg, dict) or not env_cfg.get('projectId'):
		raise WalkError(f'no Firebase projectId for env {env} in app/backend/package.json')
	functions = env_cfg.get('functions', unit.get('functions')) or []
	if not functions:
		raise WalkError('backend unitConfig has no functions')
	first = functions[0]
	name = first['name'] if isinstance(first, dict) else first
	service = str(name).replace('_', '-')
	registry = (unit.get('containerDeployment') or {}).get('artifactRegistry') or {}
	region = registry.get('region')
	image = (unit.get('containerDeployment') or {}).get('imageName')
	registry_project = registry.get('projectId')
	repository = registry.get('repository')
	if not region or not image or not registry_project or not repository:
		raise WalkError('backend containerDeployment is missing region, imageName, or artifact registry')
	image_uri = f'{region}-docker.pkg.dev/{registry_project}/{repository}/{image}'
	return env_cfg['projectId'], region, service, image, image_uri


def gcloud_json(args: list[str]) -> dict[str, Any]:
	proc = subprocess.run(['gcloud', *args, '--format=json'], check=False, capture_output=True, text=True)
	if proc.returncode != 0:
		detail = (proc.stderr or proc.stdout).strip()
		raise WalkError(detail or f'gcloud {" ".join(args)} failed')
	if not proc.stdout.strip():
		return {}
	data = json.loads(proc.stdout)
	if not isinstance(data, dict):
		raise WalkError('gcloud JSON was not an object')
	return data


def tag_digest(
	image_uri: str,
	version: str,
	gcloud: Callable[[list[str]], dict[str, Any]] = gcloud_json,
) -> str:
	data = gcloud(['artifacts', 'docker', 'images', 'describe', f'{image_uri}:{version}'])
	digest = ((data.get('image_summary') or {}).get('digest')) or ''
	if not isinstance(digest, str) or not digest.startswith('sha256:'):
		raise WalkError(f'no digest for {image_uri}:{version}')
	return digest


def wait_until_serving(
	project: str,
	region: str,
	service: str,
	image_name: str,
	version: str,
	*,
	image_uri: str | None = None,
	gcloud: Callable[[list[str]], dict[str, Any]] = gcloud_json,
	timeout: float = 180,
	interval: float = 5,
	log: Callable[[str], None] = print,
	sleep: Callable[[float], None] = time.sleep,
	now: Callable[[], float] = time.time,
) -> None:
	digest = tag_digest(image_uri, version, gcloud) if image_uri else None
	deadline = now() + timeout
	last = 'no ready revision'
	while True:
		service_desc = gcloud(['run', 'services', 'describe', service, f'--project={project}', f'--region={region}'])
		rev_name = serving_revision_name(service_desc)
		if rev_name:
			revision = gcloud(['run', 'revisions', 'describe', rev_name, f'--project={project}', f'--region={region}'])
			image = container_image(revision)
			last = f'{rev_name} {image or "(no image)"}'
			if revision_ready(revision) and image_matches(image, image_name, version, digest):
				log(f'revision serving: {last}')
				return
		else:
			last = 'traffic is not 100% on the latest ready revision'
		if now() >= deadline:
			raise WalkError(f'backend revision for {image_name}:{version} is not serving ({last})')
		log(f'waiting for {image_name}:{version} ({last})')
		sleep(interval)


def resolve_start(journal: dict[str, Any], env_version: str | None, log: Callable[[str], None]) -> str | None:
	current = journal.get('_currentVersion')
	if current is not None and not isinstance(current, str):
		raise WalkError('/_config/versions/_currentVersion is not a string')
	if isinstance(current, str) and current:
		semver_key(current)
		if env_version and env_version != current:
			log(f'journal _currentVersion={current}; env tag is {env_version}; walking from the journal')
		return current
	return env_version


def walk(
	*,
	target: str,
	env_version: str | None,
	tags: list[str],
	recipe_for: Callable[[str], dict[str, Any] | None],
	rtdb: MemoryRtdb | HttpRtdb,
	wait: Callable[[], None],
	log: Callable[[str], None] = print,
) -> None:
	semver_key(target)
	journal = rtdb.read_journal()
	start = resolve_start(journal, env_version, log)
	if start == target:
		log(f'config walk already at {target} — no-op')
		return
	if start and semver_key(target) < semver_key(start):
		log(f'config walk does not roll deltas back ({start} -> {target}); leaving _currentVersion')
		return

	selected = versions_in_range(tags, start, target)
	pending: list[tuple[str, dict[str, Any]]] = []
	for version in selected:
		if journal_has(journal, version):
			log(f'skip {version} — journal has {hyphen_key(version)}')
			continue
		recipe = recipe_for(version)
		if recipe is None:
			log(f'skip {version} — no releases/{version}.json')
			continue
		pending.append((version, parse_recipe(recipe, version)))

	if pending:
		wait()
	for version, recipe in pending:
		for slice_name in SLICES:
			body = recipe.get(slice_name)
			if not body:
				continue
			flat = flatten(body)
			if not flat:
				continue
			log(f'patch /_config/{slice_name} from releases/{version}.json ({len(flat)} paths)')
			rtdb.patch_slice(slice_name, flat)
		body = {'version': version, **{name: recipe[name] for name in SLICES if name in recipe}}
		rtdb.write_journal_version(version, body)
		journal[hyphen_key(version)] = body
		log(f'journal /_config/versions/{hyphen_key(version)}')

	if pending or start != target:
		if not pending:
			wait()
		rtdb.write_current(target)
		log(f'_currentVersion={target}')


def run(argv: list[str] | None = None) -> int:
	parser = argparse.ArgumentParser(description='Apply versioned RTDB config deltas for one deploy.')
	parser.add_argument('--version', required=True, help='Semver being deployed, without the v prefix')
	parser.add_argument('--env', required=True, help='staging or prod')
	parser.add_argument('--repo', default='.', help='Git checkout that contains the version tags')
	parser.add_argument('--dry-run', action='store_true', help='Print the walk. Do not PATCH or write the journal.')
	parser.add_argument('--skip-wait', action='store_true', help='Do not poll Cloud Run. Tests and emergencies only.')
	args = parser.parse_args(argv)

	repo = Path(args.repo).resolve()
	target = args.version
	if target.startswith('v'):
		target = target[1:]
	semver_key(target)

	project, region, service, image_name, image_uri = backend_target(repo, args.env)
	token = os.environ.get('FIREBASE_TOKEN', '')
	if not args.dry_run and not token:
		raise WalkError('FIREBASE_TOKEN is empty — deploy.sh must mint it before the walk')

	git = GitRepo(repo)
	tags = git.merged_versions(target)
	env_version = git.env_version(args.env)

	def wait() -> None:
		if args.dry_run:
			print('dry-run: would wait for the revision')
			return
		if args.skip_wait:
			print('Cloud Run wait skipped')
			return
		wait_until_serving(project, region, service, image_name, target, image_uri=image_uri)

	if args.dry_run:
		if token:
			journal = HttpRtdb(project, token).read_journal()
		else:
			journal = {}
			print('dry-run without FIREBASE_TOKEN — assuming an empty journal')
		start = journal.get('_currentVersion') or env_version or '(none)'
		print(f'dry-run project={project} env={args.env} from={start} to={target}')
		walk(target=target, env_version=env_version, tags=tags, recipe_for=git.recipe, rtdb=MemoryRtdb(journal), wait=wait)
		return 0

	print(f'RTDB config walk project={project} env={args.env} to={target}')
	walk(
		target=target,
		env_version=env_version,
		tags=tags,
		recipe_for=git.recipe,
		rtdb=HttpRtdb(project, token),
		wait=wait,
	)
	return 0


def main(argv: list[str] | None = None) -> int:
	try:
		return run(argv)
	except WalkError as exc:
		print(f'RTDB config walk failed: {exc}', file=sys.stderr)
		return 1


if __name__ == '__main__':
	sys.exit(main())
