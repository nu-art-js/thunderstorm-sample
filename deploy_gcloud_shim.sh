#!/bin/bash
# PATH shim for deploy.sh. BAI runs `gcloud builds submit`. With the default
# logs bucket, a 403 while tailing logs makes that CLI exit 1 after a build
# that Cloud Build itself marked SUCCESS. gcloud still tails when
# --suppress-logs is set. CLOUD_LOGGING_ONLY makes `gcloud builds submit`
# poll the build and skip the bucket. Other gcloud commands are unchanged.

install_builds_submit_shim() {
	local real="$1"
	local dest="$2"
	if [ -z "$real" ] || [ ! -x "$real" ]; then
		echo "Refusing gcloud shim. Real gcloud is missing: ${real:-<empty>}" >&2
		return 1
	fi
	mkdir -p "$dest"
	cat > "${dest}/gcloud" <<EOF
#!/bin/bash
set -euo pipefail
real=$(printf '%q' "$real")
if [ "\${1:-}" != "builds" ] || [ "\${2:-}" != "submit" ]; then
	exec "\$real" "\$@"
fi
shift 2
args=("\$@")
config=""
i=0
while [ "\$i" -lt "\${#args[@]}" ]; do
	arg="\${args[\$i]}"
	case "\$arg" in
		--config)
			i=\$((i + 1))
			config="\${args[\$i]:-}"
			;;
		--config=*)
			config="\${arg#--config=}"
			;;
	esac
	i=\$((i + 1))
done
if [ -n "\$config" ] && [ -f "\$config" ]; then
	if ! grep -Eq '^options:[[:space:]]*$|^[[:space:]]*logging:' "\$config"; then
		printf '\\noptions:\\n  logging: CLOUD_LOGGING_ONLY\\n' >> "\$config"
	fi
fi
exec "\$real" builds submit "\${args[@]}"
EOF
	chmod 700 "${dest}/gcloud"
}

use_builds_submit_shim() {
	local gcloud_bin shim_dir
	gcloud_bin="$(command -v gcloud)"
	shim_dir="$(mktemp -d "${TMPDIR:-/tmp}/gcloud-shim.XXXXXX")"
	install_builds_submit_shim "$gcloud_bin" "$shim_dir"
	export PATH="${shim_dir}:${PATH}"
}
