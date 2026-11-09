#!/usr/bin/env bash
# End of stage 08. Run this on the task-group branch from the main repository.
# Exit 0: pull requests are merged, submodules first, then the main repository.
# Exit 2: resolve the conflicts, commit them, run the tests, and run this script again.
# Exit 3: numbered branches are on the remote. Open each printed pull request with the Cursor action, then run this script again.
# Exit 1: git or gh failed. The stderr is the record.
#
# Usage: .cursor/cloud-agent/cloud-promote.sh

set -euo pipefail

if [[ -n "${CLOUD_PROMOTE_ROOT:-}" ]]; then
	root="${CLOUD_PROMOTE_ROOT}"
else
	root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi
cd "${root}"

export GIT_TERMINAL_PROMPT=0
export GIT_MERGE_AUTOEDIT=no
export GH_PROMPT_DISABLED=1

tmp="$(mktemp -d)"
: > "${tmp}/need-open.tsv"
trap 'rm -rf "${tmp}"' EXIT

redact() {
	sed -E \
		-e 's#://[^[:space:]/@]+@#://#g' \
		-e 's#x-access-token:[^@[:space:]]+#x-access-token:REDACTED#g' \
		-e 's#gh[pousr]_[A-Za-z0-9_]+#TOKEN_REDACTED#g' \
		-e 's#github_pat_[A-Za-z0-9_]+#TOKEN_REDACTED#g'
}

die() {
	echo "$*" >&2
	echo "CONCLUSION fail"
	exit 1
}

conflict_exit() {
	echo "Conflict in ${1}."
	echo "Resolve the conflicts and commit them."
	echo "Run the tests."
	echo "Run this script again."
	echo "CONCLUSION conflict"
	exit 2
}

open_pr_exit() {
	echo "Open each pull request with the Cursor action open_git_pr."
	echo "One call per line. A URL for a different repository is a failed create."
	echo "Do not use gh pr create."
	echo "After every listed pull request exists, run this script again."
	while IFS=$'\t' read -r slug head; do
		[[ -z "${slug}" ]] && continue
		echo "repo_url=https://github.com/${slug} branch=${head} base_branch=main"
	done < "${tmp}/need-open.tsv"
	echo "CONCLUSION open-pr"
	exit 3
}

git_net() {
	git -c url.https://github.com/.insteadOf=git@github.com: "$@"
}

gh_cmd() {
	if [[ -n "${CLOUD_PROMOTE_GH:-}" ]]; then
		"${CLOUD_PROMOTE_GH}" "$@"
	else
		command gh "$@"
	fi
}

# Pull the userinfo token out of an https GitHub URL. Empty when the URL has none.
token_from_url() {
	local url="$1" token=""
	case "${url}" in
		https://*@github.com/*)
			token="${url#https://}"
			token="${token%%@*}"
			token="${token#*:}"
			;;
	esac
	printf '%s' "${token}"
}

# Git fetch uses url.<https://token@github.com/>.insteadof to rewrite origin.
# remote.origin.url often stays git@github.com:org/repo.git and has no token.
# The Cursor gh login cannot see every private repository, so list and merge use this token.
origin_token() {
	local dir="$1" stored effective token line key instead best best_len
	stored="$(git -C "${dir}" config --get remote.origin.url 2>/dev/null || true)"
	token="$(token_from_url "${stored}")"
	if [[ -n "${token}" ]]; then
		printf '%s' "${token}"
		return 0
	fi
	effective="$(git -C "${dir}" remote get-url origin 2>/dev/null || true)"
	token="$(token_from_url "${effective}")"
	if [[ -n "${token}" ]]; then
		printf '%s' "${token}"
		return 0
	fi
	best=""
	best_len=0
	while IFS= read -r line; do
		[[ -z "${line}" ]] && continue
		key="${line%% *}"
		instead="${line#* }"
		key="${key#url.}"
		key="${key%.insteadof}"
		case "${stored}" in
			"${instead}"*)
				token="$(token_from_url "${key}")"
				if [[ -n "${token}" && "${#instead}" -gt "${best_len}" ]]; then
					best="${token}"
					best_len="${#instead}"
				fi
				;;
		esac
	done < <(git -C "${dir}" config --get-regexp '^url\..*\.insteadof$' 2>/dev/null || true)
	printf '%s' "${best}"
}

gh_in() {
	local dir="$1"
	shift
	local token
	token="$(origin_token "${dir}")"
	if [[ -n "${token}" ]]; then
		(
			export GH_TOKEN="${token}"
			unset GITHUB_TOKEN
			gh_cmd "$@"
		)
		return
	fi
	if [[ -n "${CLOUD_PROMOTE_GH:-}" ]]; then
		gh_cmd "$@"
		return
	fi
	die "No GitHub token for ${dir}. The Cursor gh login is not used."
}

gh_to() {
	local dest="$1"
	local dir="$2"
	shift 2
	if ! gh_in "${dir}" "$@" >"${dest}" 2>"${tmp}/gh.err"; then
		redact < "${tmp}/gh.err" >&2 || true
		die "gh failed."
	fi
}

set_slug() {
	local url rest configured
	# Tests set promote.slug when origin is a local repository. Production uses the GitHub origin.
	configured="$(git -C "$1" config --get promote.slug || true)"
	if [[ -n "${configured}" ]]; then
		SLUG="${configured}"
		return
	fi
	url="$(git -C "$1" remote get-url origin)"
	url="${url%.git}"
	url="${url%/}"
	if [[ "${url}" == git@github.com:* ]]; then
		SLUG="${url#git@github.com:}"
		return
	fi
	if [[ "${url}" == *github.com/* ]]; then
		rest="${url#*github.com/}"
		SLUG="${rest#*@}"
		return
	fi
	die "Origin is not a GitHub repository in ${1}."
}

require_repo_url() {
	local url="$1" slug="$2"
	case "${url}" in
		"https://github.com/${slug}/pull/"*) ;;
		*)
			die "Failed create. Result is ${url}. Expected ${slug}."
			;;
	esac
}

SUB_PATHS=()
SUB_SAVED=()
SUB_PR_URLS=""
ALLOCATED_HEADS=" "

while IFS= read -r path; do
	[[ -z "${path}" ]] && continue
	SUB_PATHS+=("${path}")
done < <(git config --file "${root}/.gitmodules" --get-regexp '^submodule\..*\.path$' | awk '{print $2}')

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${branch}" == "HEAD" || "${branch}" == "main" ]]; then
	die "Checkout the task-group branch. Current branch is ${branch}."
fi

ensure_initialized() {
	local path
	for path in "${SUB_PATHS[@]}"; do
		if [[ ! -e "${root}/${path}/.git" ]]; then
			die "Submodule ${path} is not initialized. Initialize it. Run this script again."
		fi
	done
}

ensure_clean() {
	local dir="$1" label="$2"
	if [[ -n "$(git -C "${dir}" ls-files -u)" ]]; then
		conflict_exit "${label}"
	fi
	local porcelain
	porcelain="$(git -C "${dir}" status --porcelain=v1 --untracked-files=normal --ignore-submodules=dirty)"
	if [[ -n "${porcelain}" ]]; then
		die "Working tree is dirty in ${label}. Commit or leave the tree clean. Run this script again."
	fi
}

restore_subs() {
	local until="$1" i
	i=0
	while [[ "${i}" -lt "${until}" ]]; do
		git -C "${root}/${SUB_PATHS[$i]}" checkout --quiet --detach "${SUB_SAVED[$i]}"
		i=$((i + 1))
	done
}

merge_main_into() {
	local dir="$1" label="$2" restore_until="$3"
	echo "promote: fetch main in ${label}"
	git_net -C "${dir}" fetch --quiet origin +refs/heads/main:refs/remotes/origin/main
	if ! git_net -C "${dir}" fetch --quiet origin "+refs/heads/${branch}:refs/remotes/origin/${branch}"; then
		die "Origin has no ${branch} in ${label}."
	fi
	if git -C "${dir}" show-ref --verify --quiet "refs/heads/${branch}"; then
		git -C "${dir}" checkout --quiet "${branch}"
	else
		git -C "${dir}" checkout --quiet -B "${branch}" "origin/${branch}"
	fi
	if ! git -C "${dir}" merge --ff-only --quiet "origin/${branch}"; then
		restore_subs "${restore_until}"
		die "Local ${branch} in ${label} diverged from origin. Fix that branch. Run this script again."
	fi
	if git -C "${dir}" merge-base --is-ancestor origin/main HEAD; then
		echo "promote: ${label} already contains main"
		return 0
	fi
	echo "promote: merge origin/main into ${branch} in ${label}"
	if ! git -C "${dir}" merge --no-edit origin/main; then
		if [[ -n "$(git -C "${dir}" ls-files -u)" ]]; then
			restore_subs "${restore_until}"
			conflict_exit "${label}"
		fi
		restore_subs "${restore_until}"
		die "Merge of origin/main failed in ${label}."
	fi
}

push_branch() {
	local dir="$1" label="$2"
	echo "promote: push ${label}"
	if ! git_net -C "${dir}" push --quiet origin "refs/heads/${branch}:refs/heads/${branch}"; then
		die "Push failed in ${label}."
	fi
}

collect_task_ids() {
	git -C "$1" log --format=%B "origin/main..refs/heads/${branch}" \
		| sed -n 's/^Task-Id:[[:space:]]*//p' \
		| sort -u \
		| awk 'NF {print "- " $0}'
}

RUN_TASK_IDS=""

record_task_ids() {
	local dir="$1" id
	while IFS= read -r id; do
		[[ -z "${id}" ]] && continue
		case " ${RUN_TASK_IDS} " in
			*" ${id} "*) ;;
			*) RUN_TASK_IDS="${RUN_TASK_IDS} ${id}" ;;
		esac
	done < <(git -C "${dir}" log --format=%B "origin/main..refs/heads/${branch}" \
		| sed -n 's/^Task-Id:[[:space:]]*//p' \
		| sort -u)
}

print_done_instruction() {
	local id
	echo "All merges passed clean."
	echo "Mark every task implemented in this run done."
	echo "Implementing agents do not mark these tasks done."
	echo "Post notes and any other record with task.conversation.post."
	echo "The id is the task id. The text is the notes."
	echo "Then set that task to done with task.upsert."
	if [[ -n "${RUN_TASK_IDS}" ]]; then
		echo "Task-Id:"
		for id in ${RUN_TASK_IDS}; do
			echo "- ${id}"
		done
	else
		echo "No Task-Id trailers were on the merged commits."
	fi
	echo "CONCLUSION done"
}

write_body() {
	local dir="$1" dest="$2" ids
	{
		echo "Task-group branch: ${branch}"
		echo
		ids="$(collect_task_ids "${dir}")"
		if [[ -n "${ids}" ]]; then
			echo "Task-Id:"
			echo "${ids}"
			echo
		fi
		if [[ -n "${SUB_PR_URLS}" ]]; then
			echo "Submodule pull requests:"
			echo "${SUB_PR_URLS}"
			echo
		fi
		echo "Merge with a merge commit."
	} > "${dest}"
}

head_exists_in() {
	local dir="$1" name="$2"
	git -C "${dir}" rev-parse --verify --quiet "refs/heads/${name}" >/dev/null && return 0
	git -C "${dir}" rev-parse --verify --quiet "refs/remotes/origin/${name}" >/dev/null && return 0
	return 1
}

head_taken_anywhere() {
	local name="$1" path
	case "${ALLOCATED_HEADS}" in
		*" ${name} "*) return 0 ;;
	esac
	if head_exists_in "${root}" "${name}"; then
		return 0
	fi
	for path in "${SUB_PATHS[@]}"; do
		if head_exists_in "${root}/${path}" "${name}"; then
			return 0
		fi
	done
	return 1
}

# Pull request heads are branch_1, branch_2, ... so two repositories never share a name.
choose_pr_head() {
	local dir="$1" slug="$2" label="$3"
	local n=1 candidate count
	while [[ "${n}" -le 100 ]]; do
		candidate="${branch}_${n}"
		if head_taken_anywhere "${candidate}"; then
			if head_exists_in "${dir}" "${candidate}"; then
				gh_to "${tmp}/pr-list.json" "${dir}" pr list --repo "${slug}" --head "${candidate}" --base main --state open --json number,isDraft,url
				count="$(python3 -c 'import json,sys; print(len(json.load(open(sys.argv[1]))))' "${tmp}/pr-list.json")"
				if [[ "${count}" -eq 1 ]]; then
					ALLOCATED_HEADS="${ALLOCATED_HEADS}${candidate} "
					PR_HEAD="${candidate}"
					echo "promote: reuse branch ${candidate}"
					return 0
				fi
				if [[ "${count}" -gt 1 ]]; then
					die "More than one open pull request for ${slug} on ${candidate}."
				fi
			fi
			n=$((n + 1))
			continue
		fi
		echo "promote: branch ${candidate} from ${branch}"
		git -C "${dir}" branch --force "${candidate}" "refs/heads/${branch}"
		if ! git_net -C "${dir}" push --quiet origin "refs/heads/${candidate}:refs/heads/${candidate}"; then
			die "Push failed for ${candidate} in ${label}."
		fi
		ALLOCATED_HEADS="${ALLOCATED_HEADS}${candidate} "
		PR_HEAD="${candidate}"
		return 0
	done
	die "No free pull request branch for ${label}."
}

read_open_pr() {
	local dir="$1" slug="$2" number="$3" head="$4"
	gh_to "${tmp}/pr-list.json" "${dir}" pr list --repo "${slug}" --head "${head}" --base main --state open --json number,isDraft,url
	python3 -c '
import json, sys
number = int(sys.argv[1])
rows = json.load(open(sys.argv[2]))
for row in rows:
    if int(row["number"]) == number:
        print("true" if row.get("isDraft") else "false")
        print(row["url"])
        raise SystemExit(0)
raise SystemExit(1)
' "${number}" "${tmp}/pr-list.json" \
		|| die "Open pull request ${number} is missing in ${slug}."
}

promote_pr() {
	local dir="$1" label="$2" slug url number draft count
	git_net -C "${dir}" fetch --quiet origin +refs/heads/main:refs/remotes/origin/main
	local ahead
	ahead="$(git -C "${dir}" rev-list --count "origin/main..refs/heads/${branch}")"
	if [[ "${ahead}" -eq 0 ]]; then
		echo "promote: ${label} has no commits ahead of main"
		return 0
	fi
	set_slug "${dir}"
	slug="${SLUG}"
	choose_pr_head "${dir}" "${slug}" "${label}"
	gh_to "${tmp}/pr-list.json" "${dir}" pr list --repo "${slug}" --head "${PR_HEAD}" --base main --state open --json number,isDraft,url
	count="$(python3 -c 'import json,sys; print(len(json.load(open(sys.argv[1]))))' "${tmp}/pr-list.json")"
	if [[ "${count}" -eq 0 ]]; then
		echo "promote: pull request missing for ${slug} head ${PR_HEAD}"
		printf '%s\t%s\n' "${slug}" "${PR_HEAD}" >> "${tmp}/need-open.tsv"
		return 0
	elif [[ "${count}" -eq 1 ]]; then
		url="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))[0]["url"])' "${tmp}/pr-list.json")"
		require_repo_url "${url}" "${slug}"
		number="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))[0]["number"])' "${tmp}/pr-list.json")"
		echo "promote: reuse ${slug}#${number}"
	else
		die "More than one open pull request for ${slug} on ${PR_HEAD}."
	fi
	pr_text="$(read_open_pr "${dir}" "${slug}" "${number}" "${PR_HEAD}")"
	draft="$(printf '%s\n' "${pr_text}" | sed -n '1p')"
	url="$(printf '%s\n' "${pr_text}" | sed -n '2p')"
	require_repo_url "${url}" "${slug}"
	if [[ "${draft}" == "true" ]]; then
		echo "promote: ready ${slug}#${number}"
		gh_to "${tmp}/pr-ready.txt" "${dir}" pr ready "${number}" --repo "${slug}"
		pr_text="$(read_open_pr "${dir}" "${slug}" "${number}" "${PR_HEAD}")"
		draft="$(printf '%s\n' "${pr_text}" | sed -n '1p')"
		url="$(printf '%s\n' "${pr_text}" | sed -n '2p')"
		if [[ "${draft}" == "true" ]]; then
			die "Pull request ${slug}#${number} is still a draft."
		fi
	fi
	echo "promote: merge ${slug}#${number}"
	gh_to "${tmp}/pr-merge.txt" "${dir}" pr merge "${number}" --repo "${slug}" --merge
	git_net -C "${dir}" fetch --quiet origin +refs/heads/main:refs/remotes/origin/main
	if [[ "${label}" != "main repository" ]]; then
		SUB_PR_URLS="${SUB_PR_URLS}- ${url}"$'\n'
	fi
}

should_point() {
	local dir="$1" path="$2"
	local branch_sha main_sha gitlink
	branch_sha="$(git -C "${dir}" rev-parse "refs/heads/${branch}")"
	main_sha="$(git -C "${dir}" rev-parse "refs/remotes/origin/main")"
	if [[ "${branch_sha}" == "${main_sha}" ]]; then
		return 1
	fi
	if ! git -C "${dir}" merge-base --is-ancestor "${branch_sha}" "${main_sha}"; then
		return 1
	fi
	if ! gitlink="$(git -C "${root}" rev-parse "HEAD:${path}" 2>/dev/null)"; then
		return 1
	fi
	if [[ "${gitlink}" == "${main_sha}" ]]; then
		return 1
	fi
	if [[ "${gitlink}" == "${branch_sha}" ]] || git -C "${dir}" merge-base --is-ancestor "${gitlink}" "${branch_sha}"; then
		return 0
	fi
	return 1
}

if [[ -n "${CLOUD_PROMOTE_PRINT_TOKEN_DIR:-}" ]]; then
	origin_token "${CLOUD_PROMOTE_PRINT_TOKEN_DIR}"
	exit 0
fi

ensure_initialized

i=0
while [[ "${i}" -lt "${#SUB_PATHS[@]}" ]]; do
	ensure_clean "${root}/${SUB_PATHS[$i]}" "${SUB_PATHS[$i]}"
	SUB_SAVED[$i]="$(git -C "${root}/${SUB_PATHS[$i]}" rev-parse HEAD)"
	i=$((i + 1))
done
ensure_clean "${root}" "main repository"

i=0
while [[ "${i}" -lt "${#SUB_PATHS[@]}" ]]; do
	merge_main_into "${root}/${SUB_PATHS[$i]}" "${SUB_PATHS[$i]}" "${i}"
	i=$((i + 1))
done
restore_subs "${#SUB_PATHS[@]}"
ensure_clean "${root}" "main repository"
merge_main_into "${root}" "main repository" "${#SUB_PATHS[@]}"

i=0
while [[ "${i}" -lt "${#SUB_PATHS[@]}" ]]; do
	push_branch "${root}/${SUB_PATHS[$i]}" "${SUB_PATHS[$i]}"
	i=$((i + 1))
done
push_branch "${root}" "main repository"

i=0
while [[ "${i}" -lt "${#SUB_PATHS[@]}" ]]; do
	record_task_ids "${root}/${SUB_PATHS[$i]}"
	i=$((i + 1))
done
record_task_ids "${root}"

i=0
while [[ "${i}" -lt "${#SUB_PATHS[@]}" ]]; do
	promote_pr "${root}/${SUB_PATHS[$i]}" "${SUB_PATHS[$i]}"
	i=$((i + 1))
done

if [[ -s "${tmp}/need-open.tsv" ]]; then
	open_pr_exit
fi

pointed=0
i=0
while [[ "${i}" -lt "${#SUB_PATHS[@]}" ]]; do
	path="${SUB_PATHS[$i]}"
	dir="${root}/${path}"
	if should_point "${dir}" "${path}"; then
		sha="$(git -C "${dir}" rev-parse "refs/remotes/origin/main")"
		echo "promote: point ${path} at ${sha}"
		git -C "${dir}" checkout --quiet --detach "${sha}"
		git -C "${root}" add -- "${path}"
		pointed=1
	fi
	i=$((i + 1))
done

if [[ "${pointed}" -eq 1 ]]; then
	if ! git -C "${root}" diff --cached --quiet; then
		git -C "${root}" commit --quiet -m "Point submodules at merged main."
		push_branch "${root}" "main repository"
	fi
fi

promote_pr "${root}" "main repository"
if [[ -s "${tmp}/need-open.tsv" ]]; then
	open_pr_exit
fi
print_done_instruction
echo "CONCLUSION done"
exit 0
