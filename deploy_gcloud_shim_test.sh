#!/bin/bash
# The shim must send Cloud Build logs to Cloud Logging and leave every other
# gcloud command alone. No live Cloud Build.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy_gcloud_shim.sh
source "${root}/deploy_gcloud_shim.sh"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cat > "${tmp}/gcloud" <<'EOF'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_GCLOUD_ARGS"
if [ "${1:-}" = "builds" ] && [ "${2:-}" = "submit" ]; then
	shift 2
	while [ "$#" -gt 0 ]; do
		case "$1" in
			--config)
				shift
				cp "$1" "$FAKE_GCLOUD_CONFIG"
				;;
			--config=*)
				cp "${1#--config=}" "$FAKE_GCLOUD_CONFIG"
				;;
		esac
		shift
	done
fi
EOF
chmod 700 "${tmp}/gcloud"

template() {
	cat > "$1" <<'EOF'
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '.'
images:
  - 'example:1'
EOF
}

fail() {
	echo "FAIL: $1" >&2
	exit 1
}

export FAKE_GCLOUD_ARGS="${tmp}/args"
export FAKE_GCLOUD_CONFIG="${tmp}/seen-config"
export PATH="${tmp}:${PATH}"

shim_dir="${tmp}/shim"
install_builds_submit_shim "${tmp}/gcloud" "$shim_dir"
export PATH="${shim_dir}:${PATH}"

cfg="${tmp}/cloudbuild.yaml"
template "$cfg"
gcloud builds submit --config "$cfg" --project example .
grep -q 'logging: CLOUD_LOGGING_ONLY' "$cfg" || fail "logging mode was not added"
args="$(cat "$FAKE_GCLOUD_ARGS")"
[ "$args" = $'builds\nsubmit\n--config\n'"$cfg"$'\n--project\nexample\n.' ] || fail "submit args were rewritten: ${args}"
before="$(cat "$cfg")"
gcloud builds submit --config "$cfg" --project example .
after="$(cat "$cfg")"
[ "$before" = "$after" ] || fail "logging mode was added twice"

template "$cfg"
gcloud builds submit "--config=${cfg}" --project example .
grep -q 'logging: CLOUD_LOGGING_ONLY' "$cfg" || fail "--config= form was not patched"

cat > "$cfg" <<'EOF'
steps:
  - name: 'gcr.io/cloud-builders/docker'
options:
  logging: GCS_ONLY
EOF
gcloud builds submit --config "$cfg" --project example .
grep -q 'GCS_ONLY' "$cfg" || fail "existing logging mode was replaced"
count="$(grep -c '^options:' "$cfg")"
[ "$count" = "1" ] || fail "options key was duplicated"

gcloud auth print-access-token
args="$(cat "$FAKE_GCLOUD_ARGS")"
[ "$args" = $'auth\nprint-access-token' ] || fail "non-submit command was rewritten: ${args}"

echo "deploy_gcloud_shim_test: ok"
