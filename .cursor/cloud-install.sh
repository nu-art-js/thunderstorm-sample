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

# Playwright binds :443 as the agent user. The apt package also starts a service
# these VMs cannot run (PID 1 is tini). Install the binary only.
install_caddy() {
	local bin="/usr/local/bin/caddy"
	if ! package_installed libcap2-bin; then
		run_root apt-get update
		apt_install libcap2-bin
	fi
	if [[ ! -x "${bin}" ]]; then
		local archive="/tmp/caddy-linux-amd64"
		curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=amd64" -o "${archive}"
		run_root cp "${archive}" "${bin}"
		run_root chmod 755 "${bin}"
		rm -f "${archive}"
	fi
	if ! /usr/sbin/getcap "${bin}" 2>/dev/null | grep -q cap_net_bind_service; then
		run_root /usr/sbin/setcap cap_net_bind_service=+ep "${bin}"
	fi
	"${bin}" version >/dev/null
}

install_mkcert() {
	local bin="/usr/local/bin/mkcert"
	if [[ -x "${bin}" ]]; then
		return 0
	fi
	if ! package_installed libnss3-tools; then
		run_root apt-get update
		apt_install libnss3-tools
	fi
	local archive="/tmp/mkcert-linux-amd64"
	curl -fsSL "https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64" -o "${archive}"
	run_root cp "${archive}" "${bin}"
	run_root chmod 755 "${bin}"
	rm -f "${archive}"
}

# Cert names follow the first host in .cursor/test-hosts.txt.
install_test_certs() {
	local cert_dir="${root}/.config/dev-proxy/certs"
	local apex caroot pem key
	apex="$(awk 'NF && $1 !~ /^#/ {print $1; exit}' "${root}/.cursor/test-hosts.txt")"
	if [[ -z "${apex}" ]]; then
		return 0
	fi
	pem="${cert_dir}/${apex}.pem"
	key="${cert_dir}/${apex}-key.pem"
	caroot="${HOME}/.local/share/mkcert"
	if [[ -f "${pem}" && -f "${key}" ]]; then
		return 0
	fi
	install_mkcert
	mkdir -p "${cert_dir}" "${caroot}"
	run_root env CAROOT="${caroot}" /usr/local/bin/mkcert -install
	run_root chown -R "$(id -un):$(id -gn)" "${caroot}"
	CAROOT="${caroot}" /usr/local/bin/mkcert -cert-file "${pem}" -key-file "${key}" \
		"${apex}" "*.${apex}"
}

install_test_hosts() {
	bash "${root}/.cursor/ensure-test-hosts.sh"
}

install_apt_packages
install_gcloud
install_docker
if [[ -s "${root}/.cursor/test-hosts.txt" ]]; then
	install_caddy
	install_test_hosts
	install_test_certs
fi
# Cursor clones without submodules. SSH git@ URLs fail on Cloud; use HTTPS.
git -c url.https://github.com/.insteadOf=git@github.com: submodule update --init --recursive
# Do not run `build-and-install.sh init` here. It OOMs the Cloud Build.
# `.cursor/initial-setup.sh` is a separate, explicit step.
