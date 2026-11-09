#!/usr/bin/env bash
# Proves git-assert.sh moves this repo and each submodule onto latest origin/main.
# A checkout with its own commits keeps those commits and merges origin/main.
# A dirty worktree fails before the push test.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script="${root}/.cursor/cloud-agent/git-assert.sh"

fail() {
	echo "FAIL: $*" >&2
	if [[ -n "${case_dir:-}" && -f "${case_dir}/out" ]]; then
		echo "--- stdout ---" >&2
		cat "${case_dir}/out" >&2
		echo "--- stderr ---" >&2
		cat "${case_dir}/err" >&2
	fi
	exit 1
}

git_id() {
	git -C "$1" config user.email "git-assert-test@example.com"
	git -C "$1" config user.name "Git Assert Test"
	git -C "$1" config commit.gpgsign false
}

new_case() {
	case_dir="$(mktemp -d)"
	export GIT_CONFIG_GLOBAL="${case_dir}/gitconfig"
	export GIT_CONFIG_SYSTEM=/dev/null
	: > "${GIT_CONFIG_GLOBAL}"
	git config --global protocol.file.allow always
	git config --global init.defaultBranch main
	git config --global user.email "git-assert-test@example.com"
	git config --global user.name "Git Assert Test"
	git config --global commit.gpgsign false
	git config --global advice.detachedHead false

	BARE_SUB="${case_dir}/bare-sub"
	BARE_APP="${case_dir}/bare-app"
	git init --bare -b main "${BARE_SUB}" >/dev/null
	git init --bare -b main "${BARE_APP}" >/dev/null

	seed="${case_dir}/seed-sub"
	git init -b main "${seed}" >/dev/null
	git_id "${seed}"
	printf 'base\n' > "${seed}/file.txt"
	git -C "${seed}" add file.txt
	git -C "${seed}" commit -m "base sub" >/dev/null
	git -C "${seed}" remote add origin "${BARE_SUB}"
	git -C "${seed}" push origin main >/dev/null
	SUB_BASE="$(git -C "${seed}" rev-parse HEAD)"

	app="${case_dir}/app"
	git init -b main "${app}" >/dev/null
	git_id "${app}"
	printf 'app\n' > "${app}/README.md"
	git -C "${app}" add README.md
	git -C "${app}" commit -m "base app" >/dev/null
	git -C "${app}" -c protocol.file.allow=always submodule add "${BARE_SUB}" _sub >/dev/null
	git_id "${app}/_sub"
	git -C "${app}" commit -m "add sub" >/dev/null
	git -C "${app}" remote add origin "${BARE_APP}"
	git -C "${app}" push origin main >/dev/null
	APP_BASE="$(git -C "${app}" rev-parse HEAD)"

	printf 'sub main\n' > "${seed}/file.txt"
	git -C "${seed}" add file.txt
	git -C "${seed}" commit -m "advance sub main" >/dev/null
	git -C "${seed}" push origin main >/dev/null
	SUB_MAIN="$(git -C "${seed}" rev-parse HEAD)"

	printf 'app main\n' > "${app}/README.md"
	git -C "${app}" add README.md
	git -C "${app}" commit -m "advance app main" >/dev/null
	git -C "${app}" push origin main >/dev/null
	APP_MAIN="$(git -C "${app}" rev-parse HEAD)"
}

clone_stale() {
	work="${case_dir}/work"
	git clone --branch main "${BARE_APP}" "${work}" >/dev/null
	git_id "${work}"
	git -C "${work}" checkout -B cursor/stale "${APP_BASE}" >/dev/null
	git -C "${work}" submodule update --init >/dev/null
	git_id "${work}/_sub"
}

run_assert() {
	set +e
	GIT_ASSERT_ROOT="${work}" bash "${script}" >"${case_dir}/out" 2>"${case_dir}/err"
	code=$?
	set -e
}

assert_push_cleaned() {
	local left
	left="$(git ls-remote "${BARE_APP}" 'refs/heads/preflight/git-assert-*')"
	[[ -z "${left}" ]] || fail "app still has the push-test branch: ${left}"
	left="$(git ls-remote "${BARE_SUB}" 'refs/heads/preflight/git-assert-*')"
	[[ -z "${left}" ]] || fail "submodule still has the push-test branch: ${left}"
}

echo "CASE behind"
new_case
clone_stale
run_assert
[[ "${code}" -eq 0 ]] || fail "behind exited ${code}"
[[ "$(tail -n 1 "${case_dir}/out")" == "CONCLUSION pass" ]] || fail "behind conclusion"
[[ "$(git -C "${work}" rev-parse HEAD)" == "${APP_MAIN}" ]] || fail "this repo is not on latest main"
[[ "$(git -C "${work}/_sub" rev-parse HEAD)" == "${SUB_MAIN}" ]] || fail "submodule is not on latest main"
[[ "$(git -C "${work}" rev-parse --abbrev-ref HEAD)" == "cursor/stale" ]] || fail "this repo left its branch"
grep -q "path=\\. .* state=fast-forward" "${case_dir}/out" || fail "missing this repo fast-forward"
grep -q "path=_sub .* state=checked-out" "${case_dir}/out" || fail "missing submodule checkout"
assert_push_cleaned
[[ "$(git -C "${work}/_sub" rev-parse HEAD)" != "${SUB_BASE}" ]] || fail "submodule stayed on the old pin"

echo "CASE own commits"
new_case
clone_stale
printf 'own\n' > "${work}/own.txt"
git -C "${work}" add own.txt
git -C "${work}" commit -m "own work" >/dev/null
OWN="$(git -C "${work}" rev-parse HEAD)"
run_assert
[[ "${code}" -eq 0 ]] || fail "own-commits exited ${code}"
[[ "$(tail -n 1 "${case_dir}/out")" == "CONCLUSION pass" ]] || fail "own-commits conclusion"
git -C "${work}" merge-base --is-ancestor "${OWN}" HEAD || fail "own commit was discarded"
git -C "${work}" merge-base --is-ancestor "${APP_MAIN}" HEAD || fail "origin/main was not merged"
[[ "$(git -C "${work}/_sub" rev-parse HEAD)" == "${SUB_MAIN}" ]] || fail "own-commits submodule is not on latest main"
assert_push_cleaned

echo "CASE dirty"
new_case
clone_stale
BEFORE="$(git -C "${work}" rev-parse HEAD)"
printf 'dirty\n' >> "${work}/README.md"
run_assert
[[ "${code}" -ne 0 ]] || fail "dirty exited 0"
[[ "$(tail -n 1 "${case_dir}/out")" == "CONCLUSION fail" ]] || fail "dirty conclusion"
[[ "$(git -C "${work}" rev-parse HEAD)" == "${BEFORE}" ]] || fail "dirty checkout moved"
grep -q "the worktree has uncommitted changes" "${case_dir}/out" || fail "missing dirty reason"
assert_push_cleaned

echo "PASS"
