#!/bin/bash
set -e

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy_gcloud_shim.sh
source "${root}/deploy_gcloud_shim.sh"
# shellcheck source=deploy_checkout.sh
source "${root}/deploy_checkout.sh"

# Cursor / agent shells do not inherit a login PATH and cannot prompt gcloud
# to reauth. BAI's commando inherits this process env — so bootstrap HERE,
# do not rely on the caller (or the chat) to export anything.
#
# Auth order:
#   1. Cursor secret: GCP_SA_JSON
#   2. Existing GOOGLE_APPLICATION_CREDENTIALS file
#   3. $HOME/.config/gcloud/<slug>-<env>-deploy.json
#   4. User ADC / gcloud user token
# Never write a key inside the git worktree. Never `gcloud config set`.
# gcloud CLI does not use GAC by itself — service-account keys must be activated.
# BAI's `gcloud builds submit` tails the default logs bucket. A 403 on that
# bucket makes the CLI exit 1 after a SUCCESS build. The PATH shim sets
# CLOUD_LOGGING_ONLY so gcloud polls the build instead of tailing.

# Deploy SA slug, the same one passed to scripts/create-deploy-sa.sh <slug> <env>.
# Key: $HOME/.config/gcloud/<slug>-<env>-deploy.json. DEPLOY_SA_SLUG overrides.
SA_SLUG="${DEPLOY_SA_SLUG:-replace-slug}"

cred_type() {
	python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("type",""))' "$1" 2>/dev/null || true
}

# Prints JSON to stdout for the caller to write. Do not echo this to the terminal.
sa_json_from_env() {
	if [ -n "${GCP_SA_JSON:-}" ]; then
		printf '%s' "$GCP_SA_JSON"
		return
	fi
}

# Prints a key path or nothing. Does not print JSON.
resolve_sa_key() {
	local repo_root dest json
	repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
	dest="${HOME}/.config/gcloud/staging-deploy-sa.json"
	json="$(sa_json_from_env)"

	if [ -n "$json" ]; then
		case "$dest" in
			"$repo_root"/*)
				echo "Refusing to write a service-account key inside the repo: $dest" >&2
				exit 1
				;;
		esac
		mkdir -p "$(dirname "$dest")"
		umask 077
		printf '%s' "$json" > "$dest"
		chmod 600 "$dest"
		echo "$dest"
		return
	fi

	if [ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] && [ -f "${GOOGLE_APPLICATION_CREDENTIALS}" ]; then
		echo "${GOOGLE_APPLICATION_CREDENTIALS}"
		return
	fi

	# This repo's own key only (never another project's *-deploy.json).
	local named="${HOME}/.config/gcloud/${SA_SLUG}-${ENV}-deploy.json"
	if [ -f "$named" ]; then
		echo "$named"
	fi
}

ensure_gcloud() {
	export PATH="${HOME}/google-cloud-sdk/bin:/opt/homebrew/share/google-cloud-sdk/bin:/opt/homebrew/bin:/usr/local/bin:${PATH}"
	export CLOUDSDK_CORE_DISABLE_PROMPTS=1

	local key adc_json token
	key="$(resolve_sa_key)"
	adc_json="${HOME}/.config/gcloud/application_default_credentials.json"

	if [ -n "$key" ]; then
		export GOOGLE_APPLICATION_CREDENTIALS="$key"
		unset FIREBASE_TOKEN
	elif [ -f "$adc_json" ]; then
		export GOOGLE_APPLICATION_CREDENTIALS="$adc_json"
		unset FIREBASE_TOKEN
	fi

	if ! command -v gcloud >/dev/null 2>&1; then
		echo "gcloud is not installed. Cloud Agents: install google-cloud-cli in this product's Cloud install hook. Laptop: install the Cloud SDK."
		exit 1
	fi

	if [ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] && [ "$(cred_type "$GOOGLE_APPLICATION_CREDENTIALS")" = "service_account" ]; then
		gcloud auth activate-service-account --key-file="$GOOGLE_APPLICATION_CREDENTIALS" --quiet
		if token=$(gcloud auth print-access-token 2>/dev/null) && [ -n "$token" ]; then
			echo "gcloud: using staging deploy service account ($(command -v gcloud))"
			use_builds_submit_shim
			return
		fi
		echo "gcloud: service-account key is present but did not yield a token."
		exit 1
	fi

	if token=$(gcloud auth print-access-token 2>/dev/null) && [ -n "$token" ]; then
		if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
			export FIREBASE_TOKEN="$token"
		fi
		echo "gcloud: using user credentials ($(command -v gcloud))"
		use_builds_submit_shim
		return
	fi

	local adc
	adc=$(gcloud auth application-default print-access-token 2>/dev/null || true)
	if [ -n "$adc" ]; then
		export CLOUDSDK_AUTH_ACCESS_TOKEN="$adc"
		if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
			export FIREBASE_TOKEN="$adc"
		fi
		echo "gcloud: user token expired — using application-default credentials"
		use_builds_submit_shim
		return
	fi

	echo "gcloud cannot get a token. Cloud Agents need Cursor secret GCP_SA_JSON. Laptop: gcloud auth login && gcloud auth application-default login."
	exit 1
}

ACTION=$1
VERSION_ARG=$2
ENV=${3:-staging}
# Never pass one package, or any subset, unless the user explicitly asked for
# that package. Do not infer a subset from which files changed. Omit units
# and ship the default set.
# Headless repos: drop @app/frontend-vite from this default.
DEFAULT_UNITS="@app/backend,@app/frontend-vite"
BACKEND_UNIT="@app/backend"
UNITS=${4:-$DEFAULT_UNITS}

if [ -z "$ACTION" ] || [ -z "$VERSION_ARG" ]; then
	echo "Usage: deploy.sh <build|deploy|full> <patch|minor|major|x.y.z> [env] [units]"
	echo "       deploy.sh deploy <x.y.z|promoted> [env] [units]"
	echo ""
	echo "  build  <patch|minor|major|x.y.z> [env] [units]  — Build and push images/packages to Artifact Registry"
	echo "  deploy <x.y.z|promoted> [env] [units]            — Deploy an existing tag to the target env"
	echo "  full   <patch|minor|major|x.y.z> [env] [units]  — Build, push, and deploy in one step"
	echo ""
	echo "  patch, minor, and major read the latest vX.Y.Z tag."
	echo "  A tag whose commit already contains that version is incremented."
	echo "  A tag whose commit does not contain that version is kept, and version-app.json is set to it."
	echo "  version-app.json is the base only when the repo has no version tags."
	echo "  build and full write that file, commit it, and push it to origin/main when it differs."
	echo "  deploy does not bump. Pass the x.y.z the build printed, or promoted."
	echo "  promoted is the vX.Y.Z tag that env/staging points at. It does not build."
	echo "  An explicit x.y.z on build/full still sets that version."
	echo "  env defaults to 'staging'. Prod requires DEPLOY_CONFIRM_PROD=yes."
	echo "  units defaults to: ${DEFAULT_UNITS}"
	echo "  Never pass one package, or any subset, unless the user explicitly"
	echo "  asked for that package. Do not infer a subset from which files changed."
	echo "  build/full, before compile: this repo must match origin/main with a clean"
	echo "  tree. version-app.json is set to the resolved version, committed, and pushed"
	echo "  when it differs. A commit whose file and tag already match is not rewritten."
	echo "  After the artifacts are pushed, v<version> is created on that"
	echo "  commit and pushed. A failed install or build does not tag. A tag that already"
	echo "  points there is kept. A tag whose commit lacks that version moves onto"
	echo "  this commit. A tag that already contains that version on another commit is refused."
	echo "  Submodules are not tagged."
	echo "  build/full, and deploy, first check node_modules. If that directory or"
	echo "  node_modules/.bin/tsx is missing, build-and-install.sh init runs before"
	echo "  any other bai call. -i is added only when node_modules/.modules.yaml"
	echo "  is missing or the package.json tree changed since the last install this"
	echo "  script recorded. A matching package.json tree skips -i."
	echo "  Image packaging is one call: -nb and one -up"
	echo "  per unit, so it ships that dist instead of recompiling. Deploy is one"
	echo "  call the same way. -se is on every bai call so Prepare writes config"
	echo "  for that plane before compile."
	echo "  After the live action (success or fail) restores -se=local so the"
	echo "  working tree is back on the emulator plane."
	echo "  deploy/full, when ${BACKEND_UNIT} is in the unit list: after that"
	echo "  Cloud Run revision is serving, walk releases/<semver>.json from the"
	echo "  previous version up to this tag and PATCH /_config/default and"
	echo "  /_config/app. build does not. The same tag twice does not patch again."
	echo ""
	echo "  A clean cursor/* checkout is moved onto origin/main before the release."
	echo "  Any other branch is refused. local main must match origin/main."
	echo "  A submodule may stay detached. Its HEAD must be the pin on that main"
	echo "  commit, and that pin must be the submodule's origin/main."
	echo "  Self-bootstraps gcloud (PATH + ADC fallback). Callers do not export PATH."
	echo "  Do not call bai --build-push-image / --deploy-image yourself."
	exit 1
fi

if [ "$ENV" = "local" ]; then
	echo "Refusing -se=local. This script is for staging/prod only."
	exit 1
fi

if [ "$ENV" = "prod" ] && [ "${DEPLOY_CONFIRM_PROD:-}" != "yes" ]; then
	echo "Refusing prod. Set DEPLOY_CONFIRM_PROD=yes only after an explicit user yes."
	exit 1
fi

# A release ships origin/main. A clean cursor/* checkout is moved there first.
# Any other branch, a dirty tree, and a stale local main are refused.
# A submodule may stay detached when its HEAD is the pin and that pin is its origin/main.
assert_release_repos

ensure_gcloud

# build/full: the latest vX.Y.Z tag supplies the number.
# A tag whose commit already contains that version is incremented.
# A tag whose commit does not contain that version is kept, and the file is set to it.
# A commit whose file and tag already match is left as committed.
# An x.y.z is used as given. deploy never bumps.
# promoted is only valid for deploy. The caller has already fetched tags.
resolve_app_version() {
	local resolved
	ALREADY_TAGGED=0
	case "$VERSION_ARG" in
		promoted)
			if [ "$ACTION" != "deploy" ]; then
				echo "Refusing release. promoted is only valid for deploy."
				exit 1
			fi
			if ! resolved=$(python3 "$root/deploy_version.py" promoted --root "$root"); then
				exit 1
			fi
			VERSION="$(printf '%s\n' "$resolved" | sed -n 's/^version=//p')"
			if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
				echo "Refusing release. env/staging did not resolve to x.y.z."
				exit 1
			fi
			;;
		patch|minor|major)
			if [ "$ACTION" = "deploy" ]; then
				echo "Refusing release. deploy does not bump. Pass the x.y.z the build printed."
				exit 1
			fi
			if ! git -C "$root" fetch origin '+refs/tags/v*:refs/tags/v*'; then
				echo "Refusing release. Could not fetch version tags."
				exit 1
			fi
			if ! resolved=$(python3 "$root/deploy_version.py" resolve --root "$root" --bump "$VERSION_ARG"); then
				exit 1
			fi
			VERSION="$(printf '%s\n' "$resolved" | sed -n 's/^version=//p')"
			ALREADY_TAGGED="$(printf '%s\n' "$resolved" | sed -n 's/^alreadyTagged=//p')"
			if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
				echo "Refusing release. Could not resolve a version from the tags."
				exit 1
			fi
			;;
		*)
			if ! [[ "$VERSION_ARG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
				echo "Refusing release. Second argument must be patch, minor, major, or x.y.z. Got: ${VERSION_ARG}"
				exit 1
			fi
			VERSION="$VERSION_ARG"
			;;
	esac
}

# Write version-app.json. Exit 0 when it already matches, 2 when it changed.
write_app_version_file() {
	local root="$1"
	python3 - "$root" "$VERSION" <<'PY'
import json, sys
from pathlib import Path
root, version = sys.argv[1], sys.argv[2]
path = Path(root) / "version-app.json"
raw = path.read_text() if path.exists() else ""
data = json.loads(raw) if raw else {}
if not isinstance(data, dict):
    sys.exit(1)
if data.get("version") == version:
    sys.exit(0)
indent = "\t" if "\t" in raw else "  "
data["version"] = version
path.write_text(json.dumps(data, indent=indent) + "\n")
sys.exit(2)
PY
}

# Before compile. The version file has to be on the commit the artifact is built
# from. The git tag comes later, only after that artifact has been pushed.
prepare_app_version() {
	local root version_status
	root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
	if [ -n "$(git -C "$root" status --porcelain)" ]; then
		echo "Refusing release. The app repo has uncommitted changes:"
		git -C "$root" status --porcelain
		exit 1
	fi
	if [ "$ALREADY_TAGGED" = "1" ]; then
		local file_version
		file_version="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$root/version-app.json")"
		if [ "$file_version" != "$VERSION" ]; then
			echo "Refusing release. Commit is tagged v${VERSION} but version-app.json is ${file_version}."
			exit 1
		fi
		echo "Commit already tagged v${VERSION}. Leaving version-app.json as committed."
		return
	fi
	version_status=0
	write_app_version_file "$root" || version_status=$?
	if [ "$version_status" -eq 2 ]; then
		echo "Setting version-app.json to ${VERSION}..."
		git -C "$root" add -- version-app.json
		git -C "$root" commit -m "$(cat <<EOF
Set app version to ${VERSION}.

EOF
)"
		git -C "$root" push origin HEAD
	elif [ "$version_status" -ne 0 ]; then
		echo "Refusing release. Could not write version-app.json."
		exit 1
	else
		echo "version-app.json is already ${VERSION}."
	fi
}

# After the artifacts exist. Tags the commit they were built from. The worktree
# may be dirty from -se by then; the tag points at HEAD, not at those files.
# A tag moves only when its commit does not contain this version. Submodules are not tagged.
tag_app_version() {
	local tag head action
	tag="v${VERSION}"
	head="$(git -C "$root" rev-parse HEAD)"
	if ! action=$(python3 "$root/deploy_version.py" tag-action --root "$root" --version "$VERSION"); then
		exit 1
	fi
	case "$action" in
		keep)
			echo "${tag} already points at ${head}."
			;;
		create)
			echo "Tagging ${tag} at ${head}..."
			git -C "$root" tag "$tag" "$head"
			;;
		move)
			echo "Moving ${tag} to ${head}. The previous commit does not contain ${VERSION}."
			git -C "$root" tag -f "$tag" "$head"
			;;
		*)
			echo "Refusing release. Unknown tag action: ${action}"
			exit 1
			;;
	esac
	echo "Pushing ${tag}..."
	if [ "$action" = "move" ]; then
		git -C "$root" push --force origin "refs/tags/${tag}"
	else
		git -C "$root" push origin "refs/tags/${tag}"
	fi
}

# Force-move the env-pointer tag (env/<env>) to the deployed version and push it.
# Version tags (v<x.y.z>) stay as tag_app_version left them. This push updates
# only env/<env>. A force push of every tag would move version tags too.
tag_env_pointer() {
	local env_tag="env/${ENV}"
	echo "Tagging ${env_tag} -> v${VERSION} (force-moving deploy pointer)..."
	git -C "$root" tag -f "$env_tag" "v${VERSION}"
	git -C "$root" push --force origin "refs/tags/${env_tag}"
}

# Cloud start fetches origin/main and does not fetch tags. deploy and full need
# vX.Y.Z for the RTDB walk and env/<env> for a later rollback.
fetch_release_tags() {
	if ! git -C "$root" fetch origin '+refs/tags/v*:refs/tags/v*' '+refs/tags/env/*:refs/tags/env/*'; then
		echo "Refusing release. Could not fetch release tags."
		exit 1
	fi
}

# Live -se writes staging/prod config into the tree.
# Snap back to local so the next emulator run is not pointed at the live plane.
restore_local() {
	echo "Restoring working tree to -se=local..."
	bash build-and-install.sh -se=local -nb
}

# Config deltas are git recipes (releases/<semver>.json at v<semver>).
# Run only after the backend revision that will restart into the patch is serving,
# and before env/<env> moves — that tag is still the previous version until then.
backend_was_deployed() {
	local unit
	IFS=',' read -ra UNIT_ARR <<< "$UNITS"
	for unit in "${UNIT_ARR[@]}"; do
		unit="${unit// /}"
		if [ "$unit" = "$BACKEND_UNIT" ]; then
			return 0
		fi
	done
	return 1
}

apply_rtdb_config_deltas() {
	if ! backend_was_deployed; then
		echo "RTDB config walk skipped — ${BACKEND_UNIT} was not in this deploy."
		return 0
	fi
	local root
	root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
	# Firebase Hosting must not see FIREBASE_TOKEN (it beats ADC and cannot
	# list the project). Mint a token only for this process.
	# RTDB rejects a cloud-platform-only ADC token. When the deploy identity is a
	# service account, mint a token that includes the Firebase database scope.
	# gcloud auth print-access-token would otherwise return CLOUDSDK_AUTH_ACCESS_TOKEN,
	# which is the unscoped token from ensure_gcloud.
	local token=""
	local firebase_scopes="https://www.googleapis.com/auth/firebase.database,https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/userinfo.email"
	if [ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
		token=$(gcloud auth application-default print-access-token --scopes="$firebase_scopes" 2>/dev/null || true)
	fi
	if [ -z "$token" ]; then
		token="${FIREBASE_TOKEN:-}"
	fi
	if [ -z "$token" ]; then
		token=$(gcloud auth print-access-token 2>/dev/null || true)
	fi
	if [ -z "$token" ]; then
		token=$(gcloud auth application-default print-access-token 2>/dev/null || true)
	fi
	if [ -z "$token" ]; then
		echo "RTDB config walk failed. No access token. env/${ENV} not moved."
		exit 1
	fi
	echo "RTDB config-delta walk -> v${VERSION} (${ENV})..."
	if ! FIREBASE_TOKEN="$token" python3 "${root}/deploy_rtdb_deltas.py" --version "$VERSION" --env "$ENV" --repo "$root"; then
		echo "RTDB config walk failed. env/${ENV} not moved."
		exit 1
	fi
}

# One BAI invocation for the whole unit list. -up is repeatable, and units in
# the same phase run together. A second process per unit only repeats startup.
run_units() {
	local unit
	local up_args=()
	IFS=',' read -ra UNIT_ARR <<< "$UNITS"
	for unit in "${UNIT_ARR[@]}"; do
		unit="${unit// /}"
		[ -z "$unit" ] && continue
		up_args+=("-up=${unit}")
	done
	if [ ${#up_args[@]} -eq 0 ]; then
		echo "Refusing release. No units."
		return 1
	fi
	echo "=== ${ACTION} ${UNITS} (v${VERSION} ${ENV}) ==="
	ensure_node_modules || return 1
	bash build-and-install.sh "$@" -se="$ENV" "${up_args[@]}" || return 1
}

trap restore_local EXIT

# -se MUST be on every action. Without it, Prepare leaves local config on disk
# and the image/package bakes localhost into the artifact.
# Image packaging is -nb: compile happens once, for the whole tree, immediately
# before it. -up alone would compile only that unit and vendor stale dependency dist.
#
# bai.build.run execs ./node_modules/.bin/tsx. -i is that path, so a missing
# node_modules dies at bundle.bai.sh before install. bai init installs tsx
# first (temp package, then the real purge/install) and leaves the tree clean.
# Pass -i only when node_modules/.modules.yaml is missing or the package.json
# tree changed. Install reuses the repo-local pnpm store. It does not prune
# or force a re-download.
ensure_node_modules() {
	if [ -d "${root}/node_modules" ] && [ -x "${root}/node_modules/.bin/tsx" ]; then
		return 0
	fi
	if [ ! -d "${root}/node_modules" ]; then
		echo "node_modules is missing. Running bai init..."
	else
		echo "node_modules/.bin/tsx is missing. Running bai init..."
	fi
	if ! (
		cd "$root"
		bash ./build-and-install.sh init
	); then
		echo "bai init failed."
		return 1
	fi
}

install_fingerprint() {
	python3 - "$root" <<'PY'
import hashlib, os, sys
root = sys.argv[1]
skip = {"node_modules", ".git", "dist", ".trash", ".cache"}
paths = []
for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [name for name in dirnames if name not in skip]
    if "package.json" in filenames:
        paths.append(os.path.join(dirpath, "package.json"))
digest = hashlib.sha256()
for path in sorted(paths):
    digest.update(os.path.relpath(path, root).encode())
    with open(path, "rb") as handle:
        digest.update(handle.read())
    digest.update(b"\0")
print(digest.hexdigest())
PY
}

install_required() {
	local marker="${root}/node_modules/.modules.yaml"
	local stamp="${root}/.trash/deploy-install.fingerprint"
	local fingerprint
	if [ ! -f "$marker" ]; then
		echo "node_modules is missing. Installing."
		return 0
	fi
	if [ ! -f "$stamp" ]; then
		echo "node_modules exists and this script has no install stamp yet. Skipping install."
		return 1
	fi
	fingerprint="$(install_fingerprint)"
	if [ "$(cat "$stamp")" = "$fingerprint" ]; then
		echo "package.json tree matches the last install. Skipping install."
		return 1
	fi
	echo "package.json tree changed since the last install. Installing."
	return 0
}

write_install_stamp() {
	mkdir -p "${root}/.trash"
	install_fingerprint > "${root}/.trash/deploy-install.fingerprint"
}

install_and_compile() {
	ensure_node_modules || return 1
	if install_required; then
		echo "Installing and compiling the whole tree for ${ENV}..."
		bash build-and-install.sh -i -se="$ENV" || return 1
	else
		echo "Compiling the whole tree for ${ENV} without install..."
		bash build-and-install.sh -se="$ENV" || return 1
	fi
	write_install_stamp
}

case "$ACTION" in
	build)
		resolve_app_version
		echo "Building and pushing v${VERSION} (env: ${ENV}; units: ${UNITS})..."
		prepare_app_version
		if ! install_and_compile; then
			echo "Install failed. v${VERSION} was not created."
			exit 1
		fi
		if ! run_units --build-push-image="$VERSION" -nb; then
			echo "Build failed. v${VERSION} was not created."
			exit 1
		fi
		tag_app_version
		;;
	deploy)
		fetch_release_tags
		resolve_app_version
		if ! git -C "$root" rev-parse --verify "refs/tags/v${VERSION}^{commit}" >/dev/null 2>&1; then
			echo "Refusing release. Tag v${VERSION} is not in this clone."
			exit 1
		fi
		echo "Deploying v${VERSION} to ${ENV} (units: ${UNITS})..."
		if ! run_units --deploy-image="$VERSION" -nb; then
			echo "One or more units failed. env/${ENV} not moved."
			exit 1
		fi
		apply_rtdb_config_deltas
		tag_env_pointer
		;;
	full)
		fetch_release_tags
		resolve_app_version
		echo "Building, pushing, and deploying v${VERSION} to ${ENV} (units: ${UNITS})..."
		prepare_app_version
		if ! install_and_compile; then
			echo "Install failed. v${VERSION} was not created."
			exit 1
		fi
		if ! run_units --build-push-image="$VERSION" -nb; then
			echo "Build failed. v${VERSION} was not created."
			exit 1
		fi
		tag_app_version
		if ! run_units --deploy-image="$VERSION" -nb; then
			echo "One or more units failed. env/${ENV} not moved."
			exit 1
		fi
		apply_rtdb_config_deltas
		tag_env_pointer
		;;
	*)
		echo "Unknown action: $ACTION"
		echo "Use: build, deploy, or full"
		exit 1
		;;
esac
