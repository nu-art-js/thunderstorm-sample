#!/usr/bin/env bash
# Proves the cloud-start header.
# A good fetch starts the merged file and skips a second fetch.
# A git failure runs setup from the current file and returns the git error.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
real="${root}/.cursor/cloud-start.sh"

fail() {
	echo "FAIL: $*" >&2
	exit 1
}

header_of() {
	awk 'BEGIN{p=1} /^need_sudo\(\)/{p=0} p' "$1"
}

make_script() {
	local dest="$1" marker="$2"
	mkdir -p "$(dirname "$dest")"
	header_of "$real" > "$dest"
	cat >> "$dest" <<EOF
echo "SETUP phase=\${CLOUD_START_PHASE:-fetch} marker=${marker}"
exit "\${git_error}"
EOF
	chmod 755 "$dest"
}

git_id() {
	git -C "$1" config user.email "cloud-start-test@example.com"
	git -C "$1" config user.name "Cloud Start Test"
	git -C "$1" config commit.gpgsign false
}

base="$(mktemp -d)"
git init -q -b main "$base/origin"
git_id "$base/origin"
make_script "$base/origin/.cursor/cloud-start.sh" OLD
git -C "$base/origin" add .cursor/cloud-start.sh
git -C "$base/origin" commit -q -m "base"

git clone -q "$base/origin" "$base/clone"
git_id "$base/clone"
git -C "$base/clone" checkout -q -b cursor/fixture
make_script "$base/origin/.cursor/cloud-start.sh" NEW
git -C "$base/origin" commit -q -am "new setup"
out="$(bash "$base/clone/.cursor/cloud-start.sh")"
echo "$out" | grep -q "marker=NEW" || fail "good fetch did not run the merged setup"
echo "$out" | grep -q "phase=run" || fail "second start did not skip fetch"
echo "$out" | grep -q "cloud-start: merge origin/main into cursor/fixture" || fail "missing merge"

git -C "$base/clone" remote set-url origin "$base/missing"
phase_out="$(CLOUD_START_PHASE=run bash "$base/clone/.cursor/cloud-start.sh")"
echo "$phase_out" | grep -q "marker=NEW" || fail "phase run lost the merged file"
if echo "$phase_out" | grep -q "cloud-start: merge"; then
	fail "phase run fetched again"
fi

git clone -q "$base/origin" "$base/fail"
git_id "$base/fail"
git -C "$base/fail" checkout -q -b cursor/fail
make_script "$base/fail/.cursor/cloud-start.sh" OLD
git -C "$base/fail" commit -q -am "old local"
git -C "$base/fail" remote set-url origin "$base/missing"
set +e
fail_out="$(bash "$base/fail/.cursor/cloud-start.sh" 2>"$base/fail.err")"
fail_code=$?
set -e
echo "$fail_out" | grep -q "marker=OLD" || fail "fetch failure skipped setup"
test "$fail_code" -ne 0 || fail "fetch failure returned success"

git init -q -b main "$base/conflict-origin"
git_id "$base/conflict-origin"
make_script "$base/conflict-origin/.cursor/cloud-start.sh" BASE
git -C "$base/conflict-origin" add .cursor/cloud-start.sh
git -C "$base/conflict-origin" commit -q -m "base"
git clone -q "$base/conflict-origin" "$base/conflict"
git_id "$base/conflict"
git -C "$base/conflict" checkout -q -b cursor/conflict
make_script "$base/conflict/.cursor/cloud-start.sh" LOCAL
git -C "$base/conflict" commit -q -am "local"
make_script "$base/conflict-origin/.cursor/cloud-start.sh" REMOTE
git -C "$base/conflict-origin" commit -q -am "remote"
set +e
conf_out="$(bash "$base/conflict/.cursor/cloud-start.sh" 2>"$base/conflict.err")"
conf_code=$?
set -e
echo "$conf_out" | grep -q "marker=LOCAL" || fail "merge conflict skipped setup"
test "$conf_code" -ne 0 || fail "merge conflict returned success"
if git -C "$base/conflict" rev-parse -q --verify MERGE_HEAD >/dev/null; then
	fail "merge conflict left MERGE_HEAD"
fi

git clone -q "$base/origin" "$base/detach"
git -C "$base/detach" checkout -q --detach
make_script "$base/detach/.cursor/cloud-start.sh" DETACH
git -C "$base/detach" remote set-url origin "$base/missing"
set +e
det_out="$(bash "$base/detach/.cursor/cloud-start.sh" 2>"$base/detach.err")"
det_code=$?
set -e
echo "$det_out" | grep -q "marker=DETACH" || fail "detached HEAD skipped setup"
test "$det_code" -eq 1 || fail "detached HEAD exit ${det_code}"
if grep -q "Could not read from remote" "$base/detach.err"; then
	fail "detached HEAD fetched"
fi

echo "cloud-start_test pass"
