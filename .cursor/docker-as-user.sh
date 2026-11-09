#!/usr/bin/env bash
# Cursor Cloud docker client. `docker run` starts the container as this user.
# A root dockerd still publishes the port. Volume and bind-mount files are
# handed to this user before the process starts, including a directory the
# image created as another uid.
set -euo pipefail

real="/usr/bin/docker"

grant_tree() {
	local path="$1"
	# The volume parent is not searchable by this user, so a local -e test
	# hides a directory that root can still hand over.
	[[ -n "${path}" ]] || return 0
	if [[ "$(id -u)" -eq 0 ]]; then
		[[ -e "${path}" ]] || return 0
		chown -R "${uid}:${gid}" "${path}"
	else
		sudo chown -R "${uid}:${gid}" "${path}"
	fi
}

if [[ "${1:-}" == "run" ]]; then
	shift
	for arg in "$@"; do
		case "${arg}" in
			--user|--user=*|-u|-u*)
				exec "${real}" run "$@"
				;;
		esac
	done

	uid="$(id -u)"
	gid="$(id -g)"
	detached=0
	attach_flags=()
	create_args=()
	for arg in "$@"; do
		case "${arg}" in
			--detach|-d)
				detached=1
				;;
			--interactive|-i)
				attach_flags+=(-i)
				create_args+=("${arg}")
				;;
			--tty|-t)
				attach_flags+=(-t)
				create_args+=("${arg}")
				;;
			-[!-]*)
				[[ "${arg}" == *d* ]] && detached=1
				[[ "${arg}" == *i* ]] && attach_flags+=(-i)
				[[ "${arg}" == *t* ]] && attach_flags+=(-t)
				stripped="${arg//d/}"
				[[ "${stripped}" == "-" ]] || create_args+=("${stripped}")
				;;
			*)
				create_args+=("${arg}")
				;;
		esac
	done

	cid="$("${real}" create --user "${uid}:${gid}" "${create_args[@]}")"
	while IFS= read -r src; do
		grant_tree "${src}"
	done < <("${real}" inspect -f '{{range .Mounts}}{{if ne .Type "tmpfs"}}{{println .Source}}{{end}}{{end}}' "${cid}")

	if [[ "${detached}" -eq 1 ]]; then
		"${real}" start "${cid}" >/dev/null
		printf '%s\n' "${cid}"
		exit 0
	fi
	exec "${real}" start "${attach_flags[@]}" -a "${cid}"
fi

exec "${real}" "$@"
