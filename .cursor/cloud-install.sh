#!/usr/bin/env bash
# Cloud Agents / Automations install hook.
# environment.json "install" should only call this script.

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${root}"

apt_packages=(cpio rsync fuse-overlayfs)

# deploy.sh looks for $HOME/google-cloud-sdk/bin. Keep that path.
install_gcloud() {
	local sdk="${HOME}/google-cloud-sdk"
	if [[ ! -x "${sdk}/bin/gcloud" ]]; then
		local archive="/tmp/google-cloud-cli-linux-x86_64.tar.gz"
		curl -fsSL "https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz" -o "${archive}"
		tar -xzf "${archive}" -C "${HOME}"
		rm -f "${archive}"
		"${sdk}/bin/gcloud" --version >/dev/null
	fi
	# Login shells do not load ~/.bashrc. deploy.sh still looks in $HOME.
	local tool
	for tool in gcloud gsutil bq; do
		if [[ -x "${sdk}/bin/${tool}" ]]; then
			run_root ln -sfn "${sdk}/bin/${tool}" "/usr/local/bin/${tool}"
		fi
	done
}

package_installed() {
	dpkg-query -W -f '${Status}' "$1" 2>/dev/null | grep -q 'install ok installed'
}

install_docker() {
	if package_installed docker.io; then
		return 0
	fi
	run_root apt-get update
	apt_install docker.io
}

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

apt_install() {
	# fuse3 prompts on /etc/fuse.conf even with DEBIAN_FRONTEND=noninteractive.
	run_root env DEBIAN_FRONTEND=noninteractive apt-get install -y \
		-o Dpkg::Options::=--force-confdef \
		-o Dpkg::Options::=--force-confold \
		--no-install-recommends "$@"
}

install_apt_packages() {
	local missing=()
	local package

	for package in "${apt_packages[@]}"; do
		if ! package_installed "${package}"; then
			missing+=("${package}")
		fi
	done

	if [[ ${#missing[@]} -eq 0 ]]; then
		return 0
	fi

	run_root apt-get update
	apt_install "${missing[@]}"
}

install_apt_packages
install_gcloud
install_docker
# Cursor clones without submodules. SSH git@ URLs fail on Cloud; use HTTPS.
git -c url.https://github.com/.insteadOf=git@github.com: submodule update --init --recursive
# Do not run `build-and-install.sh init` here. It OOMs the Cloud Build.
# `.cursor/initial-setup.sh` is a separate, explicit step.
