#!/usr/bin/env bash
# Cursor Cloud install: host tools BAI needs, then the Thunderstorm submodule.
# Do not write service-account JSON into the repo. Keys stay in Cursor secrets / the agent home.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f build-and-install.sh ]]; then
  echo "[bootstrap] ERROR: not a Thunderstorm repo root ($ROOT)" >&2
  exit 1
fi

install_host_tools() {
  local missing=()
  command -v cpio >/dev/null 2>&1 || missing+=(cpio)
  command -v rsync >/dev/null 2>&1 || missing+=(rsync)
  if [[ ${#missing[@]} -eq 0 ]]; then
    echo "[bootstrap] host tools: cpio and rsync present"
    return 0
  fi
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "[bootstrap] ERROR: missing ${missing[*]} and apt-get is unavailable" >&2
    exit 1
  fi
  echo "[bootstrap] installing ${missing[*]}"
  apt-get update -qq
  apt-get install -y -qq "${missing[@]}"
}
install_host_tools

git -C "$ROOT" submodule update --init --recursive
echo "[bootstrap] ready: $ROOT"
