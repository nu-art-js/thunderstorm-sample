#!/usr/bin/env bash
# Cloud Agents / Automations start hook.
# Runs before the agent sees the prompt: docker daemon, submodules, optional SA ADC.

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${root}"

export PATH="${HOME}/google-cloud-sdk/bin:${PATH}"

need_sudo() {
	if [[ "$(id -u)" -eq 0 ]]; then
		return 1
	fi
	command -v sudo >/dev/null
}

run_root() {
	if need_sudo; then
		sudo "$@"
	else
		"$@"
	fi
}

# Builds snapshot disk only. The daemon must start on every agent run.
if ! docker info >/dev/null 2>&1; then
	run_root service docker start
fi

# Feature-branch checkout after a Build leaves _thunderstorm empty. Init here,
# not in the agent turn. HTTPS so the GitHub App token can fetch git@ submodules.
git -c url.https://github.com/.insteadOf=git@github.com: submodule update --init --recursive

# Cursor secret GCP_SA_JSON.
python3 - "${HOME}/.config/gcloud/application_default_credentials.json" <<'PY'
import json, os, pathlib, stat, sys
raw = os.environ.get("GCP_SA_JSON") or ""
if not raw:
	raise SystemExit(0)
json.loads(raw)
path = pathlib.Path(sys.argv[1])
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(raw)
path.chmod(stat.S_IRUSR | stat.S_IWUSR)
PY
