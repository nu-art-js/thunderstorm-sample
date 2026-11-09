#!/usr/bin/env bash
# The launcher must stop when the loader download fails or the file is empty.
# A successful download must run that file and keep its exit code.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cat > "${tmp}/curl" <<'EOF'
#!/usr/bin/env bash
out=""
while [[ $# -gt 0 ]]; do
	case "$1" in
		-o)
			out="$2"
			shift 2
			;;
		-o*)
			out="${1#-o}"
			shift
			;;
		*)
			shift
			;;
	esac
done
if [[ -z "${out}" ]]; then
	echo "fake curl: missing -o" >&2
	exit 2
fi
case "${CURL_MODE:-ok}" in
	fail)
		echo "curl: (22) The requested URL returned error: 504" >&2
		exit 22
		;;
	empty)
		: > "${out}"
		exit 0
		;;
	ok)
		cp "${CURL_BODY}" "${out}"
		exit 0
		;;
	*)
		echo "fake curl: unknown mode ${CURL_MODE}" >&2
		exit 2
		;;
esac
EOF
chmod 700 "${tmp}/curl"

cat > "${tmp}/loader.sh" <<'EOF'
#!/bin/bash
printf '%s\n' "$@"
exit 9
EOF

export PATH="${tmp}:${PATH}"
export CURL_BODY="${tmp}/loader.sh"

fail() {
	echo "FAIL: $*" >&2
	exit 1
}

run_launcher() {
	set +e
	out="$(bash "${root}/build-and-install.sh" "$@" 2>"${tmp}/err")"
	code=$?
	set -e
	err="$(cat "${tmp}/err")"
}

echo "CASE curl 504"
CURL_MODE=fail run_launcher init
[[ "${code}" -ne 0 ]] || fail "504 exited ${code}"
[[ "${err}" == *"failed to download"* ]] || fail "504 missing download error: ${err}"
[[ "${out}" != *"nu-art-js/build-and-install-script"* ]] || fail "504 still ran the loader"

echo "CASE empty loader"
CURL_MODE=empty run_launcher init
[[ "${code}" -ne 0 ]] || fail "empty file exited ${code}"
[[ "${err}" == *"downloaded loader is empty"* ]] || fail "empty file missing error: ${err}"
[[ "${out}" != *"nu-art-js/build-and-install-script"* ]] || fail "empty file still ran the loader"

echo "CASE loader exit code"
CURL_MODE=ok run_launcher init
[[ "${code}" -eq 9 ]] || fail "loader exit was ${code}"
[[ "${out}" == *"nu-art-js/build-and-install-script"* ]] || fail "loader did not receive repo arg"
[[ "${out}" == *"init"* ]] || fail "loader did not receive init"

echo "build-and-install_test: ok"
