#!/usr/bin/env bash
# Git requirement for this checkout.
# Setup moves this repo and every submodule onto latest origin/main.
# A checkout that already has its own commits merges origin/main instead.
# Assert then proves read and write once per unique origin.
# The last line is CONCLUSION pass or CONCLUSION fail.
#
# Usage: .cursor/cloud-agent/git-assert.sh
# Tests set GIT_ASSERT_ROOT to a fixture checkout.

set -euo pipefail

if [[ -n "${GIT_ASSERT_ROOT:-}" ]]; then
	root="$(cd "${GIT_ASSERT_ROOT}" && pwd)"
else
	root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi
cd "${root}"

export GIT_TERMINAL_PROMPT=0

stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
branch="preflight/git-assert-${stamp}"
tmp="$(mktemp)"
err="$(mktemp)"
trap 'rm -f "${tmp}" "${err}"' EXIT

redact() {
	sed -E \
		-e 's#://[^[:space:]/@]+@#://#g' \
		-e 's#x-access-token:[^@[:space:]]+#x-access-token:REDACTED#g' \
		-e 's#gh[pousr]_[A-Za-z0-9_]+#TOKEN_REDACTED#g' \
		-e 's#github_pat_[A-Za-z0-9_]+#TOKEN_REDACTED#g'
}

public_origin() {
	git -C "$1" remote get-url origin | sed -E \
		-e 's#://[^/@]+@#://#' \
		-e 's#\.git/*$##' \
		-e 's#/*$##'
}

git_net() {
	git -c url.https://github.com/.insteadOf=git@github.com: "$@"
}

finish() {
	local result="$1"
	echo "CONCLUSION ${result}"
	if [[ "${result}" == "pass" ]]; then
		exit 0
	fi
	exit 1
}

worktree_dirty() {
	local dir="$1"
	local mode="$2"
	if [[ "${mode}" == "parent" ]]; then
		git -C "${dir}" status --porcelain=v1 --untracked-files=normal --ignore-submodules=all
	else
		git -C "${dir}" status --porcelain=v1 --untracked-files=normal
	fi
}

sync_main() {
	local dir="$1"
	local label="$2"
	local mode="$3"
	local porcelain main_sha head_sha branch ahead

	echo "SETUP main path=${label}"
	porcelain="$(worktree_dirty "${dir}" "${mode}")"
	if [[ -n "${porcelain}" ]]; then
		echo "SETUP main fail path=${label}"
		echo "the worktree has uncommitted changes"
		printf '%s\n' "${porcelain}" | redact
		finish fail
	fi

	if ! git_net -C "${dir}" fetch --quiet origin '+refs/heads/main:refs/remotes/origin/main' >"${tmp}" 2>"${err}"; then
		echo "SETUP main fail path=${label}"
		redact <"${err}"
		finish fail
	fi

	main_sha="$(git -C "${dir}" rev-parse refs/remotes/origin/main)"
	head_sha="$(git -C "${dir}" rev-parse HEAD)"
	branch="$(git -C "${dir}" branch --show-current)"
	if [[ "${head_sha}" == "${main_sha}" ]]; then
		echo "SETUP main pass path=${label} commit=${main_sha} state=current"
		return 0
	fi

	ahead="$(git -C "${dir}" rev-list --count "${main_sha}..HEAD")"
	if [[ "${ahead}" != "0" ]]; then
		if [[ -z "${branch}" ]]; then
			echo "SETUP main fail path=${label}"
			echo "detached HEAD has commits that are not on origin/main"
			finish fail
		fi
		if ! git -C "${dir}" -c submodule.recurse=false merge --no-edit "${main_sha}" >"${tmp}" 2>"${err}"; then
			echo "SETUP main fail path=${label}"
			echo "merge of origin/main failed"
			redact <"${err}"
			git -C "${dir}" merge --abort >/dev/null 2>&1 || true
			finish fail
		fi
		echo "SETUP main pass path=${label} commit=$(git -C "${dir}" rev-parse HEAD) state=merged"
		return 0
	fi

	if [[ -n "${branch}" ]]; then
		if ! git -C "${dir}" -c submodule.recurse=false merge --ff-only "${main_sha}" >"${tmp}" 2>"${err}"; then
			echo "SETUP main fail path=${label}"
			redact <"${err}"
			finish fail
		fi
		echo "SETUP main pass path=${label} commit=${main_sha} state=fast-forward"
		return 0
	fi
	if ! git -C "${dir}" -c submodule.recurse=false checkout --detach "${main_sha}" >"${tmp}" 2>"${err}"; then
		echo "SETUP main fail path=${label}"
		redact <"${err}"
		finish fail
	fi
	echo "SETUP main pass path=${label} commit=${main_sha} state=checked-out"
}

echo "REQUIREMENT move this repo and each submodule onto latest origin/main, then for each unique origin prove ls-remote, push a new branch at the current commit, and delete that branch"

if ! command -v git >/dev/null 2>&1; then
	echo "SETUP git fail"
	echo "git is not installed"
	finish fail
fi
echo "SETUP git $(git --version)"

echo "SETUP submodule-init"
if ! git_net -C "${root}" submodule update --init --recursive >"${tmp}" 2>"${err}"; then
	echo "SETUP submodule-init fail"
	redact <"${err}"
	finish fail
fi
echo "SETUP submodule-init pass"

if ! git -C "${root}" submodule status --recursive >"${tmp}" 2>"${err}"; then
	echo "SETUP submodule-status fail"
	redact <"${err}"
	finish fail
fi
if grep -q '^[-U]' "${tmp}"; then
	echo "SETUP submodule-status fail"
	redact <"${tmp}"
	finish fail
fi
echo "SETUP submodule-status pass"

sync_main "${root}" "." "parent"

echo "SETUP submodule-init-after-main"
if ! git_net -C "${root}" submodule update --init --recursive >"${tmp}" 2>"${err}"; then
	echo "SETUP submodule-init-after-main fail"
	redact <"${err}"
	finish fail
fi
echo "SETUP submodule-init-after-main pass"

declare -a sub_paths=()
if ! git -C "${root}" submodule foreach --recursive --quiet 'printf "%s\n" "$displaypath"' >"${tmp}" 2>"${err}"; then
	echo "SETUP submodule-list fail"
	redact <"${err}"
	finish fail
fi
while IFS= read -r displaypath; do
	[[ -z "${displaypath}" ]] && continue
	sub_paths+=("${displaypath}")
done <"${tmp}"
if [[ "${#sub_paths[@]}" -gt 0 ]]; then
	for displaypath in "${sub_paths[@]}"; do
		sync_main "${root}/${displaypath}" "${displaypath}" "child"
	done
fi

declare -a probe_dirs=()
declare -a probe_labels=()
declare -A seen_origin=()

add_repo() {
	local dir="$1"
	local label="$2"
	local origin
	if ! origin="$(public_origin "${dir}" 2>/dev/null)"; then
		echo "SETUP origin fail path=${label}"
		finish fail
	fi
	if [[ -z "${origin}" ]]; then
		echo "SETUP origin fail path=${label}"
		finish fail
	fi
	if [[ -n "${seen_origin[${origin}]+x}" ]]; then
		echo "SETUP origin skip path=${label} same=${origin}"
		return 0
	fi
	seen_origin["${origin}"]=1
	probe_dirs+=("${dir}")
	probe_labels+=("${label}")
	echo "SETUP origin path=${label} remote=${origin}"
}

add_repo "${root}" "."
if [[ "${#sub_paths[@]}" -gt 0 ]]; then
	for displaypath in "${sub_paths[@]}"; do
		add_repo "${root}/${displaypath}" "${displaypath}"
	done
fi

failed=0
for i in "${!probe_dirs[@]}"; do
	dir="${probe_dirs[$i]}"
	label="${probe_labels[$i]}"
	origin="$(public_origin "${dir}")"
	sha="$(git -C "${dir}" rev-parse HEAD)"
	local_branch="$(git -C "${dir}" branch --show-current)"
	repo_failed=0

	echo "ASSERT path=${label} remote=${origin}"

	if ! git_net -C "${dir}" ls-remote --symref origin HEAD >"${tmp}" 2>"${err}"; then
		echo "ASSERT path=${label} read=fail"
		redact <"${err}"
		repo_failed=1
	elif ! grep -q '^ref:' "${tmp}"; then
		echo "ASSERT path=${label} read=fail"
		echo "origin HEAD has no symbolic ref"
		repo_failed=1
	else
		echo "ASSERT path=${label} read=pass"
	fi

	if [[ "${repo_failed}" -eq 0 ]]; then
		if ! git_net -C "${dir}" push origin "${sha}:refs/heads/${branch}" >"${tmp}" 2>"${err}"; then
			echo "ASSERT path=${label} write=fail branch=${branch}"
			redact <"${err}"
			repo_failed=1
		else
			if ! remote_sha="$(git_net -C "${dir}" ls-remote origin "refs/heads/${branch}" | awk '{print $1}')"; then
				echo "ASSERT path=${label} write=fail branch=${branch}"
				echo "the remote branch lookup failed"
				repo_failed=1
				remote_sha=""
			fi
			if [[ "${repo_failed}" -eq 0 && "${remote_sha}" != "${sha}" ]]; then
				echo "ASSERT path=${label} write=fail branch=${branch}"
				echo "remote branch does not point at the current commit"
				repo_failed=1
			elif [[ "${repo_failed}" -eq 0 ]]; then
				echo "ASSERT path=${label} write=pass branch=${branch}"
			fi
		fi
	fi

	if git_net -C "${dir}" ls-remote origin "refs/heads/${branch}" | grep -q .; then
		if ! git_net -C "${dir}" push origin ":refs/heads/${branch}" >"${tmp}" 2>"${err}"; then
			echo "ASSERT path=${label} delete=fail branch=${branch}"
			redact <"${err}"
			repo_failed=1
		fi
	fi

	if [[ "${repo_failed}" -eq 0 ]]; then
		if ! left="$(git_net -C "${dir}" ls-remote origin "refs/heads/${branch}")"; then
			echo "ASSERT path=${label} delete=fail branch=${branch}"
			echo "the remote branch lookup failed"
			repo_failed=1
			left="lookup-failed"
		fi
		if [[ "${repo_failed}" -eq 0 && -n "${left}" ]]; then
			echo "ASSERT path=${label} delete=fail branch=${branch}"
			echo "remote branch is still present"
			repo_failed=1
		elif [[ "${repo_failed}" -eq 0 ]]; then
			echo "ASSERT path=${label} delete=pass branch=${branch}"
		fi
	fi

	head_after="$(git -C "${dir}" rev-parse HEAD)"
	branch_after="$(git -C "${dir}" branch --show-current)"
	if [[ "${head_after}" != "${sha}" || "${branch_after}" != "${local_branch}" ]]; then
		echo "ASSERT path=${label} local=fail"
		echo "the local commit or branch changed"
		repo_failed=1
	else
		echo "ASSERT path=${label} local=pass"
	fi

	if [[ "${repo_failed}" -ne 0 ]]; then
		failed=1
	fi
done

if [[ "${failed}" -ne 0 ]]; then
	finish fail
fi
finish pass
