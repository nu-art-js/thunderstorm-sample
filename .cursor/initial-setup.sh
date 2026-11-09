#!/usr/bin/env bash
# Workspace BAI setup as three processes so Node can free RSS between steps.
# Do not fold these into one `bai init`.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${root}"

bash "${root}/build-and-install.sh" init  -up=build-and-install -bt -up=root
bash "${root}/build-and-install.sh" --local
bash "${root}/build-and-install.sh" -i -nb
bash "${root}/build-and-install.sh"
