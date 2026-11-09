#!/bin/bash
# One test part. Same checkout rule as deploy.sh, then init when the runner
# is missing, then bai -t for that part only.
#
# Whole part:
#   ./test.sh app
#   ./test.sh thunderstorm
#
# Upward from a change. The second argument is package names, separated by commas.
#   ./test.sh app @app/backend,@app/e2e
#   ./test.sh thunderstorm @nu-art/changed,@nu-art/dependent
set -e

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy_checkout.sh
source "${root}/deploy_checkout.sh"
cd "$root"

part="${1:-}"
packages="${2:-}"

refuse() {
	echo "Refusing. $1"
	echo "App, whole part: ./test.sh app"
	echo "Thunderstorm, whole part: ./test.sh thunderstorm"
	echo "Upward from a change: pass the package names as the second argument, separated by commas."
	exit 1
}

trim() {
	local value="$1"
	value="${value#"${value%%[![:space:]]*}"}"
	value="${value%"${value##*[![:space:]]}"}"
	printf '%s' "$value"
}

validate_list() {
	local kind="$1"
	local raw="$2"
	local item trimmed count=0
	local -a items=()

	IFS=',' read -ra items <<< "$raw"
	for item in "${items[@]}"; do
		trimmed="$(trim "$item")"
		if [ -z "$trimmed" ]; then
			refuse "The package list has an empty name."
		fi
		count=$((count + 1))
		case "$kind" in
			app)
				case "$trimmed" in
					@app/?*) ;;
					*) refuse "The app part accepts only @app/ package names. Got: ${trimmed}" ;;
				esac
				;;
			thunderstorm)
				case "$trimmed" in
					@nu-art/?*) ;;
					*) refuse "Thunderstorm accepts only @nu-art/ package names. Got: ${trimmed}" ;;
				esac
				;;
		esac
	done
	if [ "$count" -eq 0 ]; then
		refuse "The package list is empty."
	fi
}

case "$part" in
	app)
		label="App tests."
		passed="App tests passed."
		failed="App tests failed."
		if [ -z "$packages" ]; then
			filter='@app/'
		else
			validate_list app "$packages"
			filter="$packages"
		fi
		;;
	thunderstorm)
		label="Thunderstorm tests."
		passed="Thunderstorm tests passed."
		failed="Thunderstorm tests failed."
		if [ -z "$packages" ]; then
			filter='@nu-art/'
		else
			validate_list thunderstorm "$packages"
			filter="$packages"
		fi
		;;
	*)
		refuse "The test command needs a part."
		;;
esac

echo "$label"
assert_release_repos

if [ -d node_modules ] && [ -x node_modules/.bin/tsx ]; then
	echo "node_modules is present."
else
	if [ ! -d node_modules ]; then
		echo "node_modules is missing. Running bai init..."
	else
		echo "node_modules/.bin/tsx is missing. Running bai init..."
	fi
	if ! bash ./build-and-install.sh init; then
		echo "bai init failed."
		exit 1
	fi
fi

# v8-compile-cache aborts Node on a bad bytecode cache. Skip that cache.
export DISABLE_V8_COMPILE_CACHE=1
# SecretKey reads one of these at import time. An empty pair throws before Mocha runs a test.
# This repo's local id is the placeholder in app/backend. A real app replaces that value.
if [ -z "${GCP_PROJECT_ID:-}" ] && [ -z "${GCLOUD_PROJECT:-}" ]; then
	local_project="$(python3 - <<'PY'
import json
from pathlib import Path
for name in ("package.json", "__package.json"):
    path = Path("app/backend") / name
    if not path.exists():
        continue
    data = json.loads(path.read_text())
    project = (((data.get("unitConfig") or {}).get("envs") or {}).get("local") or {}).get("projectId")
    if isinstance(project, str) and project:
        print(project)
        break
PY
)"
	if [ -z "${local_project}" ]; then
		echo "Refusing tests. Set GCP_PROJECT_ID. app/backend has no local projectId."
		exit 1
	fi
	export GCP_PROJECT_ID="${local_project}"
	export GCLOUD_PROJECT="${local_project}"
	echo "GCP_PROJECT_ID and GCLOUD_PROJECT were empty. Using ${local_project}."
fi
if [ -z "${GOOGLE_CLOUD_PROJECT:-}" ]; then
	export GOOGLE_CLOUD_PROJECT="${GCP_PROJECT_ID:-${GCLOUD_PROJECT}}"
fi
echo "Running bai -t -up=${filter}."
if ! bash ./build-and-install.sh -t -up="$filter"; then
	echo "$failed"
	exit 1
fi
echo "$passed"
