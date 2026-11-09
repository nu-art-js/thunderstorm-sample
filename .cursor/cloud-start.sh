#!/usr/bin/env bash
# Cloud Agents / Automations start hook.
# Header (keep stable): try fetch and merge, then start this file again.
# A git failure runs setup in this process and returns the git error.
# Setup below the header may change. It is Google auth, Docker, Mongo volumes, and trash cleanup.

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${root}"

export PATH="${HOME}/google-cloud-sdk/bin:${PATH}"
export GIT_TERMINAL_PROMPT=0

git_error=0

# The boot snapshot reuses an older checkout. A good fetch starts this file
# again so setup runs from the merged text. A bad fetch keeps this process.
if [[ "${CLOUD_START_PHASE:-fetch}" == "fetch" ]]; then
	branch="$(git rev-parse --abbrev-ref HEAD)"
	if [[ "${branch}" == "HEAD" ]]; then
		echo "cloud-start: HEAD is detached. Cannot merge origin/main into the cursor branch." >&2
		git_error=1
	else
		git fetch --quiet origin refs/heads/main:refs/remotes/origin/main || git_error=$?
		if [[ "${git_error}" -eq 0 ]]; then
			echo "cloud-start: merge origin/main into ${branch}"
			git merge --no-edit origin/main || git_error=$?
			if [[ "${git_error}" -ne 0 ]]; then
				git merge --abort >/dev/null 2>&1 || true
			fi
		fi
		if [[ "${git_error}" -eq 0 ]]; then
			echo "cloud-start: git submodule update --init"
			git -c url.https://github.com/.insteadOf=git@github.com: submodule update --init || git_error=$?
		fi
		if [[ "${git_error}" -eq 0 ]]; then
			export CLOUD_START_PHASE=run
			exec bash "${root}/.cursor/cloud-start.sh"
		fi
	fi
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

# Cursor secret GCP_SA_JSON.
# Do this first. Docker must not skip Google auth.
python3 - "${HOME}/.config/gcloud/application_default_credentials.json" <<'PY'
import json, os, pathlib, stat, sys
raw = os.environ.get("GCP_SA_JSON") or ""
if not raw:
	raise SystemExit(0)
json.loads(raw)
path = pathlib.Path(sys.argv[1])
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(raw)
path.chmod(stat.S_IRUSR | stat.S_IWUSR)
PY

# Cloud Agent disks are overlay. A nested overlay mount returns EINVAL, so the
# default Docker driver accepts `docker info` and then fails `docker run`.
overlay_mount_works() {
	local base
	base="$(mktemp -d)"
	mkdir -p "${base}/lower" "${base}/upper" "${base}/work" "${base}/merged"
	if run_root mount -t overlay overlay \
		-o "lowerdir=${base}/lower,upperdir=${base}/upper,workdir=${base}/work" \
		"${base}/merged" >/dev/null 2>&1; then
		run_root umount "${base}/merged" >/dev/null 2>&1 || true
		rm -rf "${base}"
		return 0
	fi
	rm -rf "${base}"
	return 1
}

needs_fuse_overlayfs() {
	command -v fuse-overlayfs >/dev/null 2>&1 && ! overlay_mount_works
}

stop_dockerd() {
	local pid=""
	if [[ -r /var/run/docker.pid ]]; then
		pid="$(tr -d '[:space:]' < /var/run/docker.pid)"
	fi
	if [[ -z "${pid}" ]]; then
		pid="$(pidof dockerd 2>/dev/null | awk '{print $1}' || true)"
	fi
	if [[ -z "${pid}" ]]; then
		return 0
	fi
	run_root kill "${pid}" || true
	local i
	for i in $(seq 1 40); do
		if ! ps -p "${pid}" >/dev/null 2>&1; then
			return 0
		fi
		sleep 0.25
	done
	run_root kill -9 "${pid}" || true
}

# These VMs are not systemd (PID 1 is tini). `service docker start` always fails
# even when docker.io is installed. Start dockerd yourself.
ensure_docker() {
	if run_root docker info >/dev/null 2>&1; then
		local driver
		driver="$(run_root docker info --format '{{.Driver}}' 2>/dev/null || true)"
		if [[ "${driver}" == "fuse-overlayfs" ]] || ! needs_fuse_overlayfs; then
			echo "docker: keeping storage driver ${driver}"
			return 0
		fi
		echo "docker: restarting with fuse-overlayfs (nested overlay mount failed)"
		stop_dockerd
	fi

	if ! command -v dockerd >/dev/null 2>&1; then
		echo "dockerd is not installed" >&2
		return 1
	fi

	run_root mkdir -p /var/run
	if [[ -S /var/run/docker.sock ]] && ! pidof dockerd >/dev/null 2>&1; then
		run_root rm -f /var/run/docker.sock
	fi

	if needs_fuse_overlayfs; then
		run_root sh -c 'dockerd --storage-driver fuse-overlayfs >>/tmp/dockerd.log 2>&1 &'
	else
		run_root sh -c 'dockerd >>/tmp/dockerd.log 2>&1 &'
	fi

	local i
	for i in $(seq 1 40); do
		if run_root docker info >/dev/null 2>&1; then
			break
		fi
		sleep 0.5
	done

	if [[ -S /var/run/docker.sock ]]; then
		run_root chmod 666 /var/run/docker.sock || true
		if getent group docker >/dev/null; then
			run_root usermod -aG docker "$(id -un)" || true
		fi
	fi

	if ! run_root docker info >/dev/null 2>&1; then
		return 1
	fi
	driver="$(run_root docker info --format '{{.Driver}}' 2>/dev/null || true)"
	echo "docker: storage driver ${driver}"
}

if ! ensure_docker; then
	echo "docker daemon did not start; continuing without it" >&2
fi

# `docker run` starts as the agent user. Install only puts the Docker package in place.
run_root cp "${root}/.cursor/docker-as-user.sh" /usr/local/bin/docker
run_root chmod 755 /usr/local/bin/docker

# A Mongo volume is copied from the image as uid 999. Hand every existing
# volume data directory to the agent. docker-as-user.sh does this again
# before each new container starts.
if [[ -d /var/lib/docker/volumes ]]; then
	while IFS= read -r -d '' dir; do
		run_root chown -R "$(id -u):$(id -g)" "${dir}"
	done < <(run_root find /var/lib/docker/volumes -mindepth 2 -maxdepth 2 -type d -name _data -print0)
fi

# A folder under .trash can belong to uid 999. The agent cannot delete it.
# --user on the next docker run does not apply until that run starts.
# Remove every folder under .trash. The run creates the ones it needs.
while IFS= read -r -d '' trash; do
	while IFS= read -r -d '' dir; do
		run_root rm -rf -- "${dir}"
	done < <(run_root find "${trash}" -mindepth 1 -maxdepth 1 -type d -print0)
done < <(run_root find "${root}" \( -type d \( -name node_modules -o -name .git \) -prune \) -o \( -type d -name .trash -print0 \))

if [[ "${git_error}" -ne 0 ]]; then
	exit "${git_error}"
fi
