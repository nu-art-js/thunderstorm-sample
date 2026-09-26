#!/bin/bash
set -e

# Cursor / agent shells do not inherit a login PATH and cannot prompt gcloud
# to reauth. BAI's commando inherits this process env — so bootstrap HERE,
# do not rely on the caller (or the chat) to export anything.
#
# Required on this machine:
#   PATH must include $HOME/google-cloud-sdk/bin (gcloud is not on /opt/homebrew/bin)
#   CLOUDSDK_CORE_DISABLE_PROMPTS=1
#   If `gcloud auth print-access-token` fails (expired user token), set
#   CLOUDSDK_AUTH_ACCESS_TOKEN from `gcloud auth application-default print-access-token`
#   Firebase Hosting must use the ADC json (GOOGLE_APPLICATION_CREDENTIALS).
#   A gcloud user access token in FIREBASE_TOKEN cannot list the Firebase
#   project, and that var beats ADC — so unset it whenever the ADC json exists.
#   Fall back to FIREBASE_TOKEN only when there is no ADC file.
# Optional: CLOUDSDK_CORE_ACCOUNT when several accounts are logged in.
# Never `gcloud config set`.

ensure_gcloud() {
	export PATH="${HOME}/google-cloud-sdk/bin:/opt/homebrew/share/google-cloud-sdk/bin:/opt/homebrew/bin:/usr/local/bin:${PATH}"
	export CLOUDSDK_CORE_DISABLE_PROMPTS=1

	local adc_json="${HOME}/.config/gcloud/application_default_credentials.json"
	if [ -f "$adc_json" ]; then
		export GOOGLE_APPLICATION_CREDENTIALS="$adc_json"
		unset FIREBASE_TOKEN
	fi

	if ! command -v gcloud >/dev/null 2>&1; then
		echo "gcloud not on PATH after adding \$HOME/google-cloud-sdk/bin. Install the Cloud SDK or add it to PATH."
		exit 1
	fi

	local token
	if token=$(gcloud auth print-access-token 2>/dev/null) && [ -n "$token" ]; then
		if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
			export FIREBASE_TOKEN="$token"
		fi
		echo "gcloud: using user credentials ($(command -v gcloud))"
		return
	fi

	local adc
	adc=$(gcloud auth application-default print-access-token 2>/dev/null || true)
	if [ -n "$adc" ]; then
		export CLOUDSDK_AUTH_ACCESS_TOKEN="$adc"
		if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
			export FIREBASE_TOKEN="$adc"
		fi
		echo "gcloud: user token expired — using application-default credentials"
		return
	fi

	echo "gcloud cannot get a token (user expired, ADC missing). Run:"
	echo "  gcloud auth login"
	echo "  gcloud auth application-default login"
	exit 1
}

ACTION=$1
VERSION=$2
ENV=${3:-staging}
# Default ship is backend + Vite hosting. Pass a comma list to ship a subset.
# Headless repos: drop @app/frontend-vite from this default.
DEFAULT_UNITS="@app/backend,@app/frontend-vite"
BACKEND_UNIT="@app/backend"
UNITS=${4:-$DEFAULT_UNITS}

if [ -z "$ACTION" ] || [ -z "$VERSION" ]; then
	echo "Usage: deploy.sh <build|deploy|full> <version> [env] [units]"
	echo ""
	echo "  build  <version> [env] [units]  — Build and push images/packages to Artifact Registry"
	echo "  deploy <version> [env] [units]  — Deploy an existing tag to the target env"
	echo "  full   <version> [env] [units]  — Build, push, and deploy in one step"
	echo ""
	echo "  env defaults to 'staging'. Prod requires DEPLOY_CONFIRM_PROD=yes."
	echo "  units defaults to: ${DEFAULT_UNITS}"
	echo "  Pass a comma list to ship a subset, e.g. ${BACKEND_UNIT}"
	echo "  Always passes -se=<env> so BAI Prepare writes config for that plane"
	echo "  before compile. After the live action (success or fail) restores"
	echo "  -se=local so the working tree is back on the emulator plane."
	echo "  deploy/full, when ${BACKEND_UNIT} is in the unit list: after that"
	echo "  Cloud Run revision is serving, walk releases/<semver>.json from the"
	echo "  previous version up to this tag and PATCH /_config/default and"
	echo "  /_config/app. build does not. The same tag twice does not patch again."
	echo ""
	echo "  Self-bootstraps gcloud (PATH + ADC fallback). Callers do not export PATH."
	echo "  Do not call bai --build-push-image / --deploy-image yourself."
	exit 1
fi

if [ "$ENV" = "local" ]; then
	echo "Refusing -se=local. This script is for staging/prod only."
	exit 1
fi

if [ "$ENV" = "prod" ] && [ "${DEPLOY_CONFIRM_PROD:-}" != "yes" ]; then
	echo "Refusing prod. Set DEPLOY_CONFIRM_PROD=yes only after an explicit user yes."
	exit 1
fi

ensure_gcloud

# Force-move the env-pointer tag (env/<env>) to the deployed version and push it.
# Version tags (v<x.y.z>) are immutable history; env/<env> is a moving pointer that
# always marks which version is currently live on a given environment.
tag_env_pointer() {
	local env_tag="env/${ENV}"
	echo "Tagging ${env_tag} -> v${VERSION} (force-moving deploy pointer)..."
	git tag -f "$env_tag" "v${VERSION}"
	git push --tags --force
}

# Live -se writes staging/prod config into the tree.
# Snap back to local so the next emulator run is not pointed at the live plane.
restore_local() {
	echo "Restoring working tree to -se=local..."
	bash build-and-install.sh -se=local -nb
}

# Config deltas are git recipes (releases/<semver>.json at v<semver>).
# Run only after the backend revision that will restart into the patch is serving,
# and before env/<env> moves — that tag is still the previous version until then.
backend_was_deployed() {
	local unit
	IFS=',' read -ra UNIT_ARR <<< "$UNITS"
	for unit in "${UNIT_ARR[@]}"; do
		unit="${unit// /}"
		if [ "$unit" = "$BACKEND_UNIT" ]; then
			return 0
		fi
	done
	return 1
}

apply_rtdb_config_deltas() {
	if ! backend_was_deployed; then
		echo "RTDB config walk skipped — ${BACKEND_UNIT} was not in this deploy."
		return 0
	fi
	local root
	root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
	# Firebase Hosting must not see FIREBASE_TOKEN (it beats ADC and cannot
	# list the project). Mint a token only for this process.
	local token="${FIREBASE_TOKEN:-}"
	if [ -z "$token" ]; then
		token=$(gcloud auth print-access-token 2>/dev/null || true)
	fi
	if [ -z "$token" ]; then
		token=$(gcloud auth application-default print-access-token 2>/dev/null || true)
	fi
	if [ -z "$token" ]; then
		echo "RTDB config walk failed. No access token. env/${ENV} not moved."
		exit 1
	fi
	echo "RTDB config-delta walk -> v${VERSION} (${ENV})..."
	if ! FIREBASE_TOKEN="$token" python3 "${root}/deploy_rtdb_deltas.py" --version "$VERSION" --env "$ENV" --repo "$root"; then
		echo "RTDB config walk failed. env/${ENV} not moved."
		exit 1
	fi
}

# One BAI invocation per unit so a Cloud Run miss does not skip Hosting.
run_units() {
	local failed=0
	local unit
	IFS=',' read -ra UNIT_ARR <<< "$UNITS"
	for unit in "${UNIT_ARR[@]}"; do
		unit="${unit// /}"
		[ -z "$unit" ] && continue
		echo "=== ${ACTION} ${unit} (v${VERSION} ${ENV}) ==="
		if ! bash build-and-install.sh "$@" -se="$ENV" -up="$unit"; then
			echo "FAILED: ${unit}"
			failed=1
		fi
	done
	return "$failed"
}

trap restore_local EXIT

# -se MUST be on every action. Without it, Prepare leaves local config on disk
# and the image/package bakes localhost into the artifact.
case "$ACTION" in
	build)
		echo "Building and pushing v${VERSION} (env: ${ENV}; units: ${UNITS})..."
		run_units --build-push-image="$VERSION"
		;;
	deploy)
		echo "Deploying v${VERSION} to ${ENV} (units: ${UNITS})..."
		if ! run_units --deploy-image="$VERSION" -nb; then
			echo "One or more units failed. env/${ENV} not moved."
			exit 1
		fi
		apply_rtdb_config_deltas
		tag_env_pointer
		;;
	full)
		echo "Building, pushing, and deploying v${VERSION} to ${ENV} (units: ${UNITS})..."
		if ! run_units --build-push-image="$VERSION" --deploy-image="$VERSION"; then
			echo "One or more units failed. env/${ENV} not moved."
			exit 1
		fi
		apply_rtdb_config_deltas
		tag_env_pointer
		;;
	*)
		echo "Unknown action: $ACTION"
		echo "Use: build, deploy, or full"
		exit 1
		;;
esac
