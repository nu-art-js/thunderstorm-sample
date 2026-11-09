#!/usr/bin/env bash
# /etc/hosts has no wildcard. Names come from .cursor/test-hosts.txt, one per line.
# A Cloud Agent boot replaces /etc/hosts, so install and start both run this script.
# An empty file does nothing.

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
hosts_file="${root}/.cursor/test-hosts.txt"
if [[ ! -s "${hosts_file}" ]]; then
	exit 0
fi

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

names=()
while IFS= read -r name; do
	[[ -z "${name}" ]] && continue
	names+=("${name}")
done < <(awk 'NF && $1 !~ /^#/ {print $1}' "${hosts_file}")
if [[ ${#names[@]} -eq 0 ]]; then
	exit 0
fi

begin="# BEGIN test dev"
end="# END test dev"
line="127.0.0.1 ${names[*]}"
tmp="$(mktemp)"
if [[ -f /etc/hosts ]] && grep -Fq "${begin}" /etc/hosts; then
	awk -v begin="${begin}" -v end="${end}" '
		$0 == begin {skip=1; next}
		$0 == end {skip=0; next}
		skip != 1 {print}
	' /etc/hosts > "${tmp}"
else
	cp /etc/hosts "${tmp}"
fi
printf '%s\n%s\n%s\n' "${begin}" "${line}" "${end}" >> "${tmp}"
run_root cp "${tmp}" /etc/hosts
rm -f "${tmp}"
