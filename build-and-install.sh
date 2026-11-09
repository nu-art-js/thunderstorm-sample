#!/bin/bash
# Download the loader to a file, then run it.
# `bash <(curl ...)` exits 0 when curl fails. Bash executes an empty script.
# deploy.sh would tag and continue after that.

set -euo pipefail

loader_url="https://github.com/nu-art/bash-tools/releases/latest/download/bundle.loader.sh"
loader="$(mktemp)"
trap 'rm -f "$loader"' EXIT

if ! curl -fsSL -o "$loader" "$loader_url"; then
	echo "build-and-install.sh: failed to download ${loader_url}" >&2
	exit 1
fi
if [[ ! -s "$loader" ]]; then
	echo "build-and-install.sh: downloaded loader is empty: ${loader_url}" >&2
	exit 1
fi

bash "$loader" \
	--sh-repo nu-art-js/build-and-install-script --sh-bundle bai --ts-version=~0.500.0 "$@"
#bash /Users/tacb0ss/dev/nu-art/build-and-install-script/dist/bundle.bai.sh "$@"
