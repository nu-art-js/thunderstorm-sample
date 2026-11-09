#!/usr/bin/env bash
# Proves the promotion script stops on a conflict before any pull request,
# rejects a pull request for the wrong repository, and merges submodules first.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script="${root}/.cursor/cloud-agent/cloud-promote.sh"

fail() {
	echo "FAIL: $*" >&2
	exit 1
}

git_id() {
	git -C "$1" config user.email "promote-test@example.com"
	git -C "$1" config user.name "Promote Test"
	git -C "$1" config commit.gpgsign false
}

link_origin() {
	local dir="$1" slug="$2" bare="$3"
	git -C "${dir}" remote remove origin 2>/dev/null || true
	git -C "${dir}" remote add origin "${bare}"
	git -C "${dir}" config promote.slug "${slug}"
}

new_case() {
	case_dir="$(mktemp -d)"
	export GIT_CONFIG_GLOBAL="${case_dir}/gitconfig"
	export GIT_CONFIG_SYSTEM=/dev/null
	: > "${GIT_CONFIG_GLOBAL}"
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
	link_origin "${seed}" "example/sub" "${BARE_SUB}"
	git -C "${seed}" push origin main >/dev/null

	app="${case_dir}/app"
	git init -b main "${app}" >/dev/null
	git_id "${app}"
	printf 'app\n' > "${app}/README.md"
	git -C "${app}" add README.md
	git -C "${app}" commit -m "base app" >/dev/null
	git -C "${app}" -c protocol.file.allow=always submodule add "${BARE_SUB}" _sub >/dev/null
	git_id "${app}/_sub"
	git -C "${app}/_sub" config promote.slug "example/sub"
	git -C "${app}" commit -m "add sub" >/dev/null
	link_origin "${app}" "example/app" "${BARE_APP}"
	git -C "${app}" push origin main >/dev/null
	git -C "${app}/_sub" push origin main >/dev/null
}

branch_both() {
	local sub_text="$1" app_text="$2"
	git -C "${app}/_sub" checkout -b task-group/t1 >/dev/null
	printf '%s\n' "${sub_text}" > "${app}/_sub/file.txt"
	git -C "${app}/_sub" add file.txt
	git -C "${app}/_sub" commit -m "$(printf '%s\n\n%s\n' "feature sub" "Task-Id: ddd685785dba3af75276489b6450cb01")" >/dev/null
	git -C "${app}/_sub" push origin task-group/t1 >/dev/null
	git -C "${app}" checkout -b task-group/t1 >/dev/null
	printf '%s\n' "${app_text}" > "${app}/README.md"
	git -C "${app}" add README.md _sub
	git -C "${app}" commit -m "feature app" >/dev/null
	git -C "${app}" push origin task-group/t1 >/dev/null
}

move_sub_main() {
	local text="$1" file="$2"
	local wt="${case_dir}/sub-main"
	git clone "${BARE_SUB}" "${wt}" >/dev/null
	git_id "${wt}"
	git -C "${wt}" checkout main >/dev/null
	printf '%s\n' "${text}" > "${wt}/${file}"
	git -C "${wt}" add "${file}"
	git -C "${wt}" commit -m "main moves" >/dev/null
	git -C "${wt}" push origin main >/dev/null
}

write_fake_gh() {
	fake="${case_dir}/gh"
	cat > "${fake}" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${GH_LOG}"
sub=""
repo=""
num=""
headref=""
wrong="${GH_WRONG:-0}"
create_draft="${GH_CREATE_DRAFT:-true}"
while [[ $# -gt 0 ]]; do
	case "$1" in
		list|create|ready|merge) sub="$1" ;;
		--repo) shift; repo="$1" ;;
		--head) shift; headref="$1" ;;
		--body-file) shift ;;
		--base|--title|--state|--json) shift ;;
		[0-9]*) num="$1" ;;
	esac
	shift || true
done
if [[ -n "${GH_EXPECT_DIR:-}" && -n "${repo}" ]]; then
	want="$(cat "${GH_EXPECT_DIR}/${repo//\//__}")"
	[[ "${GH_TOKEN:-}" == "${want}" ]] || {
		echo "token mismatch for ${repo}" >&2
		exit 1
	}
fi
state="${GH_STATE}/${repo//\//__}"
case "${sub}" in
	list)
		if [[ "${wrong}" == "1" ]]; then
			python3 -c 'import json; print(json.dumps([{"number":102,"isDraft":True,"url":"https://github.com/nu-art-js/thunderstorm/pull/102"}]))'
		elif [[ -f "${state}" ]] && [[ "$(sed -n '4p' "${state}")" != "merged" ]]; then
			number="$(sed -n '1p' "${state}")"
			draft="$(sed -n '2p' "${state}")"
			url="$(sed -n '3p' "${state}")"
			stored_head="$(sed -n '5p' "${state}")"
			if [[ -n "${headref}" && -n "${stored_head}" && "${headref}" != "${stored_head}" ]]; then
				echo '[]'
			else
				python3 -c 'import json,sys; print(json.dumps([{"number":int(sys.argv[1]),"isDraft":sys.argv[2]=="true","url":sys.argv[3]}]))' "${number}" "${draft}" "${url}"
			fi
		else
			echo '[]'
		fi
		;;
	create)
		if [[ "${wrong}" == "1" ]]; then
			echo "https://github.com/nu-art-js/thunderstorm/pull/102"
			exit 0
		fi
		mkdir -p "${GH_STATE}"
		if [[ "${repo}" == "example/sub" ]]; then number=1; else number=2; fi
		url="https://github.com/${repo}/pull/${number}"
		printf '%s\n%s\n%s\n%s\n%s\n' "${number}" "${create_draft}" "${url}" "open" "${headref}" > "${state}"
		echo "${url}"
		;;
	ready)
		draft_line="$(sed -n '2p' "${state}")"
		[[ "${draft_line}" == "true" ]]
		number="$(sed -n '1p' "${state}")"
		url="$(sed -n '3p' "${state}")"
		headref="$(sed -n '5p' "${state}")"
		printf '%s\n%s\n%s\n%s\n%s\n' "${number}" "false" "${url}" "open" "${headref}" > "${state}"
		;;
	merge)
		[[ "$(sed -n '4p' "${state}")" == "open" ]]
		number="$(sed -n '1p' "${state}")"
		url="$(sed -n '3p' "${state}")"
		headref="$(sed -n '5p' "${state}")"
		printf '%s\n%s\n%s\n%s\n%s\n' "${number}" "false" "${url}" "merged" "${headref}" > "${state}"
		if [[ "${repo}" == "example/sub" ]]; then bare="${BARE_SUB}"; else bare="${BARE_APP}"; fi
		wt="$(mktemp -d)"
		git clone "${bare}" "${wt}" >/dev/null
		git -C "${wt}" config user.email "promote-test@example.com"
		git -C "${wt}" config user.name "Promote Test"
		git -C "${wt}" config commit.gpgsign false
		git -C "${wt}" checkout main >/dev/null
		headref="$(sed -n '5p' "${state}")"
		[[ -n "${headref}" ]] || headref="task-group/t1"
		git -C "${wt}" merge --no-ff --no-edit "origin/${headref}" >/dev/null
		git -C "${wt}" push origin main >/dev/null
		if [[ "${repo}" == "example/app" ]]; then
			git --git-dir="${BARE_APP}" rev-parse "refs/heads/task-group/t1:_sub" > "${GH_STATE}/gitlink"
			git --git-dir="${BARE_SUB}" rev-parse "refs/heads/main" > "${GH_STATE}/submain"
		fi
		rm -rf "${wt}"
		;;
	*)
		echo "unexpected gh: ${sub}" >&2
		exit 1
		;;
esac
EOF
	chmod 700 "${fake}"
}

assert_conflict() {
	new_case
	branch_both "feature" "app feature"
	move_sub_main "other" "file.txt"
	write_fake_gh
	export GH_LOG="${case_dir}/gh.log"
	export GH_STATE="${case_dir}/state"
	export BARE_SUB BARE_APP
	: > "${GH_LOG}"
	mkdir -p "${GH_STATE}"
	set +e
	CLOUD_PROMOTE_ROOT="${app}" CLOUD_PROMOTE_GH="${fake}" "${script}" >"${case_dir}/out" 2>"${case_dir}/err"
	code=$?
	set -e
	[[ "${code}" -eq 2 ]] || fail "conflict exit ${code}: $(cat "${case_dir}/err")"
	grep -q "Conflict in _sub." "${case_dir}/out" || fail "missing conflict line"
	grep -q "Resolve the conflicts and commit them." "${case_dir}/out" || fail "missing resolve line"
	grep -q "Run the tests." "${case_dir}/out" || fail "missing test line"
	grep -q "Run this script again." "${case_dir}/out" || fail "missing rerun line"
	grep -q "CONCLUSION conflict" "${case_dir}/out" || fail "missing conclusion"
	[[ ! -s "${GH_LOG}" ]] || fail "gh ran on conflict: $(cat "${GH_LOG}")"
	echo "conflict: pass"
	rm -rf "${case_dir}"
}

assert_wrong_repo() {
	new_case
	branch_both "feature" "app feature"
	write_fake_gh
	export GH_LOG="${case_dir}/gh.log"
	export GH_STATE="${case_dir}/state"
	export GH_WRONG=1
	export BARE_SUB BARE_APP
	: > "${GH_LOG}"
	mkdir -p "${GH_STATE}"
	set +e
	CLOUD_PROMOTE_ROOT="${app}" CLOUD_PROMOTE_GH="${fake}" "${script}" >"${case_dir}/out" 2>"${case_dir}/err"
	code=$?
	set -e
	[[ "${code}" -eq 1 ]] || fail "wrong-repo exit ${code}: $(cat "${case_dir}/out") $(cat "${case_dir}/err")"
	grep -q "Failed create. Result is https://github.com/nu-art-js/thunderstorm/pull/102. Expected example/sub." "${case_dir}/err" || fail "missing failed create"
	grep -q "pr merge" "${GH_LOG}" && fail "merged after a wrong repository result"
	echo "wrong repository: pass"
	rm -rf "${case_dir}"
	unset GH_WRONG
}

seed_pr() {
	local repo="$1" number="$2" draft="$3" head="$4"
	local url="https://github.com/${repo}/pull/${number}"
	printf '%s\n%s\n%s\n%s\n%s\n' "${number}" "${draft}" "${url}" "open" "${head}" > "${GH_STATE}/${repo//\//__}"
}

run_promote() {
	set +e
	CLOUD_PROMOTE_ROOT="${app}" CLOUD_PROMOTE_GH="${fake}" "${script}" >"${case_dir}/out" 2>"${case_dir}/err"
	code=$?
	set -e
}

assert_order() {
	new_case
	branch_both "feature" "app feature"
	move_sub_main "main only" "other.txt"
	write_fake_gh
	export GH_LOG="${case_dir}/gh.log"
	export GH_STATE="${case_dir}/state"
	export BARE_SUB BARE_APP
	: > "${GH_LOG}"
	mkdir -p "${GH_STATE}"
	run_promote
	[[ "${code}" -eq 3 ]] || fail "first exit ${code}: $(cat "${case_dir}/out") $(cat "${case_dir}/err")"
	grep -q "CONCLUSION open-pr" "${case_dir}/out" || fail "missing open-pr: $(cat "${case_dir}/out")"
	grep -q "repo_url=https://github.com/example/sub branch=task-group/t1_1 base_branch=main" "${case_dir}/out" || fail "missing sub instruction"
	grep -q "pr create" "${GH_LOG}" && fail "script called gh pr create"
	git --git-dir="${BARE_SUB}" rev-parse --verify --quiet refs/heads/task-group/t1_1 >/dev/null || fail "missing sub branch _1"
	seed_pr "example/sub" 1 true "task-group/t1_1"
	run_promote
	[[ "${code}" -eq 3 ]] || fail "second exit ${code}: $(cat "${case_dir}/out") $(cat "${case_dir}/err")"
	grep -q "repo_url=https://github.com/example/app branch=task-group/t1_2 base_branch=main" "${case_dir}/out" || fail "missing app instruction: $(cat "${case_dir}/out")"
	git --git-dir="${BARE_APP}" rev-parse --verify --quiet refs/heads/task-group/t1_2 >/dev/null || fail "missing app branch _2"
	grep -q "promote: point _sub at" "${case_dir}/out" || fail "missing pointer line"
	seed_pr "example/app" 2 true "task-group/t1_2"
	run_promote
	[[ "${code}" -eq 0 ]] || fail "third exit ${code}: $(cat "${case_dir}/out") $(cat "${case_dir}/err")"
	grep -q "All merges passed clean." "${case_dir}/out" || fail "missing clean line: $(cat "${case_dir}/out")"
	grep -q "Implementing agents do not mark these tasks done." "${case_dir}/out" || fail "missing do-not-mark line"
	grep -q "task.conversation.post" "${case_dir}/out" || fail "missing comment line"
	grep -q "CONCLUSION done" "${case_dir}/out" || fail "missing done: $(cat "${case_dir}/out")"
	sub_line="$(grep -n 'pr merge 1 --repo example/sub' "${GH_LOG}" | head -n 1 | cut -d: -f1)"
	app_line="$(grep -n 'pr merge 2 --repo example/app' "${GH_LOG}" | head -n 1 | cut -d: -f1)"
	[[ -n "${sub_line}" && -n "${app_line}" && "${sub_line}" -lt "${app_line}" ]] || fail "merge order: $(cat "${GH_LOG}")"
	[[ "$(cat "${GH_STATE}/gitlink")" == "$(cat "${GH_STATE}/submain")" ]] || fail "pointer $(cat "${GH_STATE}/gitlink") != $(cat "${GH_STATE}/submain")"
	echo "order: pass"
	rm -rf "${case_dir}"
}

assert_ready_skipped() {
	new_case
	branch_both "feature" "app feature"
	write_fake_gh
	export GH_LOG="${case_dir}/gh.log"
	export GH_STATE="${case_dir}/state"
	export GH_CREATE_DRAFT=false
	export BARE_SUB BARE_APP
	: > "${GH_LOG}"
	mkdir -p "${GH_STATE}"
	seed_pr "example/sub" 1 false "task-group/t1_1"
	seed_pr "example/app" 2 false "task-group/t1_2"
	run_promote
	[[ "${code}" -eq 0 ]] || fail "ready-skip exit ${code}: $(cat "${case_dir}/out") $(cat "${case_dir}/err")"
	grep -q "All merges passed clean" "${case_dir}/out" || fail "ready-skip missing done: $(cat "${case_dir}/out")"
	grep -q "pr ready" "${GH_LOG}" && fail "ready ran for an open pull request: $(cat "${GH_LOG}")"
	grep -q "pr merge 2 --repo example/app" "${GH_LOG}" || fail "app was not merged"
	echo "open pull request: pass"
	rm -rf "${case_dir}"
	unset GH_CREATE_DRAFT
}

point_token_origin() {
	local dir="$1" slug="$2" bare="$3" token="$4"
	git -C "${dir}" remote set-url origin "https://x-access-token:${token}@github.com/${slug}"
	git -C "${dir}" config "url.${bare}.insteadOf" "https://x-access-token:${token}@github.com/${slug}"
	git -C "${dir}" config promote.slug "${slug}"
}

assert_origin_token() {
	new_case
	branch_both "feature" "app feature"
	git config --file "${GIT_CONFIG_GLOBAL}" protocol.file.allow always
	point_token_origin "${app}/_sub" "example/sub" "${BARE_SUB}" "sub-token"
	point_token_origin "${app}" "example/app" "${BARE_APP}" "app-token"
	write_fake_gh
	export GH_LOG="${case_dir}/gh.log"
	export GH_STATE="${case_dir}/state"
	export GH_EXPECT_DIR="${case_dir}/expect"
	export BARE_SUB BARE_APP
	: > "${GH_LOG}"
	mkdir -p "${GH_STATE}" "${GH_EXPECT_DIR}"
	printf '%s' "sub-token" > "${GH_EXPECT_DIR}/example__sub"
	printf '%s' "app-token" > "${GH_EXPECT_DIR}/example__app"
	run_promote
	[[ "${code}" -eq 3 ]] || fail "token exit ${code}: $(cat "${case_dir}/out") $(cat "${case_dir}/err")"
	grep -q "CONCLUSION open-pr" "${case_dir}/out" || fail "token missing open-pr: $(cat "${case_dir}/out") $(cat "${case_dir}/err")"
	grep -q "repo_url=https://github.com/example/sub branch=task-group/t1_1 base_branch=main" "${case_dir}/out" || fail "token missing instruction"
	echo "origin token: pass"
	rm -rf "${case_dir}"
	unset GH_EXPECT_DIR
}

assert_insteadof_token() {
	new_case
	branch_both "feature" "app feature"
	git config --file "${GIT_CONFIG_GLOBAL}" protocol.file.allow always
	git -C "${app}/_sub" remote set-url origin "git@github.com:example/sub.git"
	git -C "${app}" remote set-url origin "git@github.com:example/app.git"
	git -C "${app}/_sub" config "url.https://x-access-token:sub-token@github.com/.insteadof" "git@github.com:example/sub.git"
	git -C "${app}" config "url.https://x-access-token:app-token@github.com/.insteadof" "git@github.com:example/app.git"
	git -C "${app}/_sub" config promote.slug "example/sub"
	git -C "${app}" config promote.slug "example/app"
	sub_token="$(CLOUD_PROMOTE_ROOT="${app}" CLOUD_PROMOTE_PRINT_TOKEN_DIR="${app}/_sub" "${script}")"
	app_token="$(CLOUD_PROMOTE_ROOT="${app}" CLOUD_PROMOTE_PRINT_TOKEN_DIR="${app}" "${script}")"
	[[ "${sub_token}" == "sub-token" ]] || fail "sub insteadof token mismatch"
	[[ "${app_token}" == "app-token" ]] || fail "app insteadof token mismatch"
	echo "insteadof token: pass"
	rm -rf "${case_dir}"
	unset GH_EXPECT_DIR
}

assert_conflict
assert_wrong_repo
assert_order
assert_ready_skipped
assert_origin_token
assert_insteadof_token
echo "cloud-promote_test: pass"
