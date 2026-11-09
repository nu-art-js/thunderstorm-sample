#!/usr/bin/env bash
# Proves a clean cursor/* checkout moves onto origin/main and keeps its own commits.
# A feature branch and a stale local main stay refused.
# A detached submodule passes only when HEAD is the pin and that pin is origin/main.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy_checkout.sh
source "${root}/deploy_checkout.sh"

fail() {
	echo "FAIL: $*" >&2
	if [[ -n "${out:-}" && -f "${out}" ]]; then
		echo "--- output ---" >&2
		cat "${out}" >&2
	fi
	exit 1
}

git_id() {
	git -C "$1" config user.email "deploy-checkout-test@example.com"
	git -C "$1" config user.name "Deploy Checkout Test"
	git -C "$1" config commit.gpgsign false
}

run_fn() {
	set +e
	(
		"$@"
	) >"${out}" 2>&1
	code=$?
	set -e
}

new_app() {
	if [[ -n "${case_dir:-}" ]]; then
		rm -rf "${case_dir}"
	fi
	case_dir="$(mktemp -d)"
	export GIT_CONFIG_GLOBAL="${case_dir}/gitconfig"
	export GIT_CONFIG_SYSTEM=/dev/null
	: > "${GIT_CONFIG_GLOBAL}"
	git config --global protocol.file.allow always
	git config --global init.defaultBranch main
	git config --global user.email "deploy-checkout-test@example.com"
	git config --global user.name "Deploy Checkout Test"
	git config --global commit.gpgsign false
	git config --global advice.detachedHead false
	out="${case_dir}/out"

	bare="${case_dir}/bare"
	work="${case_dir}/work"
	git init --bare -b main "${bare}" >/dev/null
	git init -b main "${work}" >/dev/null
	git_id "${work}"
	printf 'one\n' > "${work}/file.txt"
	git -C "${work}" add file.txt
	git -C "${work}" commit -m "one" >/dev/null
	C1="$(git -C "${work}" rev-parse HEAD)"
	git -C "${work}" remote add origin "${bare}"
	git -C "${work}" push origin main >/dev/null
	printf 'two\n' > "${work}/file.txt"
	git -C "${work}" commit -am "two" >/dev/null
	git -C "${work}" push origin main >/dev/null
	C2="$(git -C "${work}" rev-parse HEAD)"
}

echo "CASE cursor branch with its own commit"
new_app
git -C "${work}" checkout -B cursor/beamz-mcp "${C1}" >/dev/null
printf 'only-cursor\n' > "${work}/only.txt"
git -C "${work}" add only.txt
git -C "${work}" commit -m "cursor only" >/dev/null
U="$(git -C "${work}" rev-parse HEAD)"
run_fn move_cursor_checkout_to_main "${work}"
[[ "${code}" -eq 0 ]] || fail "cursor move exited ${code}"
[[ "$(git -C "${work}" branch --show-current)" == "main" ]] || fail "cursor move did not land on main"
[[ "$(git -C "${work}" rev-parse HEAD)" == "${C2}" ]] || fail "cursor move did not land on origin/main"
[[ "$(git -C "${work}" rev-parse cursor/beamz-mcp)" == "${U}" ]] || fail "cursor commit was moved"
run_fn assert_repo_on_updated_main "${work}" beamz
[[ "${code}" -eq 0 ]] || fail "main after cursor move exited ${code}"

echo "CASE dirty cursor branch"
new_app
git -C "${work}" checkout -B cursor/dirty "${C1}" >/dev/null
BEFORE="$(git -C "${work}" rev-parse HEAD)"
printf 'dirty\n' >> "${work}/file.txt"
run_fn move_cursor_checkout_to_main "${work}"
[[ "${code}" -ne 0 ]] || fail "dirty cursor exited 0"
[[ "$(git -C "${work}" rev-parse HEAD)" == "${BEFORE}" ]] || fail "dirty cursor moved"
[[ "$(git -C "${work}" branch --show-current)" == "cursor/dirty" ]] || fail "dirty cursor left its branch"
grep -q "uncommitted changes" "${out}" || fail "missing dirty reason"

echo "CASE feature branch stays refused"
new_app
git -C "${work}" checkout -B feature/laptop >/dev/null
run_fn move_cursor_checkout_to_main "${work}"
[[ "${code}" -eq 0 ]] || fail "feature move exited ${code}"
[[ "$(git -C "${work}" branch --show-current)" == "feature/laptop" ]] || fail "feature branch was switched"
run_fn assert_repo_on_updated_main "${work}" beamz
[[ "${code}" -ne 0 ]] || fail "feature branch was accepted"
grep -q "not main" "${out}" || fail "missing feature refusal"

echo "CASE stale local main stays refused"
new_app
git -C "${work}" reset --hard "${C1}" >/dev/null
run_fn assert_repo_on_updated_main "${work}" beamz
[[ "${code}" -ne 0 ]] || fail "stale main was accepted"
[[ "$(git -C "${work}" rev-parse HEAD)" == "${C1}" ]] || fail "stale main was moved"
grep -q "is not origin/main" "${out}" || fail "missing stale refusal"

echo "CASE detached submodule at the pin"
new_app
sub_bare="${case_dir}/sub-bare"
sub_seed="${case_dir}/sub-seed"
git init --bare -b main "${sub_bare}" >/dev/null
git init -b main "${sub_seed}" >/dev/null
git_id "${sub_seed}"
printf 'sub\n' > "${sub_seed}/sub.txt"
git -C "${sub_seed}" add sub.txt
git -C "${sub_seed}" commit -m "sub" >/dev/null
git -C "${sub_seed}" remote add origin "${sub_bare}"
git -C "${sub_seed}" push origin main >/dev/null
SUB="$(git -C "${sub_seed}" rev-parse HEAD)"
git -C "${work}" -c protocol.file.allow=always submodule add "${sub_bare}" _sub >/dev/null
git_id "${work}/_sub"
git -C "${work}" commit -m "add sub" >/dev/null
git -C "${work}" push origin main >/dev/null
git -C "${work}" submodule update --init >/dev/null
git -C "${work}/_sub" checkout --detach >/dev/null
run_fn assert_submodule_pin "${work}" _sub
[[ "${code}" -eq 0 ]] || fail "detached pin exited ${code}"
[[ -z "$(git -C "${work}/_sub" branch --show-current)" ]] || fail "submodule was put on a branch"

echo "CASE submodule pin behind origin/main"
printf 'newer\n' >> "${sub_seed}/sub.txt"
git -C "${sub_seed}" commit -am "newer sub" >/dev/null
git -C "${sub_seed}" push origin main >/dev/null
run_fn assert_submodule_pin "${work}" _sub
[[ "${code}" -ne 0 ]] || fail "stale pin was accepted"
grep -q "is not origin/main" "${out}" || fail "missing stale pin refusal"

echo "CASE submodule HEAD is not the pin"
git -C "${work}/_sub" checkout --detach "${SUB}" >/dev/null
printf 'ahead\n' >> "${work}/_sub/sub.txt"
git -C "${work}/_sub" commit -am "off pin" >/dev/null
run_fn assert_submodule_pin "${work}" _sub
[[ "${code}" -ne 0 ]] || fail "off-pin submodule was accepted"
grep -q "not the pin on main" "${out}" || fail "missing off-pin refusal"

echo "PASS"
rm -rf "${case_dir}"
