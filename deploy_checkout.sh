#!/bin/bash
# Release checkout rules for deploy.sh.
# A clean cursor/* checkout is moved onto origin/main. Its extra commits stay
# on that cursor branch. Any other non-main branch is refused.
# A submodule may stay detached. Its HEAD must be the pin on main, and that
# pin must be the submodule's origin/main.

move_cursor_checkout_to_main() {
	local root="$1"
	local branch
	branch="$(git -C "$root" branch --show-current)"
	case "$branch" in
		cursor/*) ;;
		*) return 0 ;;
	esac
	if [ -n "$(git -C "$root" status --porcelain=v1 --untracked-files=normal --ignore-submodules=all)" ]; then
		echo "Refusing release. $(basename "$root") has uncommitted changes:"
		git -C "$root" status --porcelain=v1 --untracked-files=normal --ignore-submodules=all
		exit 1
	fi
	if ! git -C "$root" fetch origin main; then
		echo "Refusing release. Could not fetch origin main for $(basename "$root")."
		exit 1
	fi
	echo "Cloud checkout ${branch} is clean. Checking out main at origin/main."
	if ! git -C "$root" -c submodule.recurse=false checkout -B main origin/main; then
		echo "Refusing release. Could not check out main at origin/main."
		exit 1
	fi
	if ! git -C "$root" submodule update --init; then
		echo "Refusing release. Could not check out the submodule pins on main."
		exit 1
	fi
}

assert_repo_on_updated_main() {
	local repo="$1"
	local label="$2"
	if ! git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
		echo "Refusing release. ${label} is not a git checkout."
		exit 1
	fi
	if ! git -C "$repo" fetch origin main; then
		echo "Refusing release. Could not fetch origin main for ${label}."
		exit 1
	fi
	local branch local_main remote_main
	branch="$(git -C "$repo" branch --show-current)"
	if [ "$branch" != "main" ]; then
		echo "Refusing release. ${label} is on '${branch:-detached HEAD}', not main."
		exit 1
	fi
	local_main="$(git -C "$repo" rev-parse --verify refs/heads/main 2>/dev/null || true)"
	remote_main="$(git -C "$repo" rev-parse --verify refs/remotes/origin/main 2>/dev/null || true)"
	if [ -z "$local_main" ] || [ -z "$remote_main" ] || [ "$local_main" != "$remote_main" ]; then
		echo "Refusing release. ${label} local main (${local_main:-missing}) is not origin/main (${remote_main:-missing})."
		exit 1
	fi
}

assert_submodule_pin() {
	local root="$1"
	local path="$2"
	local repo="${root}/${path}"
	local head pin remote_main
	if ! git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
		echo "Refusing release. ${path} is not a git checkout."
		exit 1
	fi
	if [ -n "$(git -C "$repo" status --porcelain=v1 --untracked-files=normal)" ]; then
		echo "Refusing release. ${path} has uncommitted changes:"
		git -C "$repo" status --porcelain=v1 --untracked-files=normal
		exit 1
	fi
	if ! git -C "$repo" fetch origin main; then
		echo "Refusing release. Could not fetch origin main for ${path}."
		exit 1
	fi
	head="$(git -C "$repo" rev-parse HEAD)"
	if ! pin="$(git -C "$root" rev-parse "HEAD:${path}" 2>/dev/null)"; then
		echo "Refusing release. ${path} has no pin on main."
		exit 1
	fi
	remote_main="$(git -C "$repo" rev-parse --verify refs/remotes/origin/main 2>/dev/null || true)"
	if [ "$head" != "$pin" ]; then
		echo "Refusing release. ${path} is at ${head}, not the pin on main (${pin})."
		exit 1
	fi
	if [ -z "$remote_main" ] || [ "$pin" != "$remote_main" ]; then
		echo "Refusing release. ${path} pin (${pin}) is not origin/main (${remote_main:-missing})."
		exit 1
	fi
}

assert_release_repos() {
	local release_root path
	release_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
	move_cursor_checkout_to_main "$release_root"
	assert_repo_on_updated_main "$release_root" "$(basename "$release_root")"
	while IFS= read -r path; do
		[ -z "$path" ] && continue
		assert_submodule_pin "$release_root" "$path"
	done < <(git -C "$release_root" config --file "${release_root}/.gitmodules" --get-regexp '^submodule\..*\.path$' | awk '{print $2}')
}
