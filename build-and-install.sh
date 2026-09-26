#!/bin/bash

# The downloaded BAI wrapper defaults TS_DESIRED_VERSION to ~0.401.0 and does not
# read version-thunderstorm.json. Without a pin, `init` installs BAI 0.401.x,
# which cannot compile a 0.500 tree.
#
# This repo forces the pin: inject --ts-version from version-thunderstorm.json
# unless the caller already passed --ts-version / -tv / -tsv, or TS_VERSION is set.
#
# Hack if you bypass this script (cached bundle, `pnpm exec build-and-install`):
#   bash build-and-install.sh --ts-version="$(python3 -c "import json; print(json.load(open('version-thunderstorm.json'))['version'])")" ...
#   # or: TS_VERSION=0.500.6 bash build-and-install.sh ...

_bai_extra=()
_bai_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_bai_pin_file="${_bai_dir}/version-thunderstorm.json"
if [[ -z "${TS_VERSION:-}" && -f "${_bai_pin_file}" ]]; then
	_bai_has_flag=false
	for _bai_arg in "$@"; do
		case "${_bai_arg}" in
			--ts-version=*|-tv=*|-tsv=*) _bai_has_flag=true ;;
		esac
	done
	if [[ "${_bai_has_flag}" == false ]]; then
		_bai_pin="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['version'])" "${_bai_pin_file}" 2>/dev/null || true)"
		if [[ -n "${_bai_pin}" ]]; then
			_bai_extra+=(--ts-version="${_bai_pin}")
		fi
	fi
fi

# Once published BAI is on disk, reject unitConfig the installed package will not accept
# before starting another pipeline. The first init has no node_modules yet, so it skips.
if [[ -f "${_bai_dir}/node_modules/@nu-art/build-and-install/package.json" ]]; then
	node "${_bai_dir}/scripts/preflight-unit-config.mjs" || exit $?
fi

bash <(curl -fsSL https://github.com/nu-art/bash-tools/releases/latest/download/bundle.loader.sh) --sh-repo nu-art-js/build-and-install-script --sh-bundle bai "${_bai_extra[@]}" "$@"
#bash /Users/tacb0ss/dev/nu-art/build-and-install-script/dist/bundle.bai.sh "${_bai_extra[@]}" "$@"
