#!/usr/bin/env bash
# Create the per-env deploy service account used by deploy.sh and Cloud Agents.
# Run from anywhere; paths are relative to this repo.
#
#   bash scripts/create-deploy-sa.sh <slug> <env> [project-id] [artifact-project-id]
#
# SA: <slug>-<env>-deploy@<artifact-project>.iam.gserviceaccount.com
# Key: $HOME/.config/gcloud/<slug>-<env>-deploy.json  (never inside the git tree)
# Cursor secret: GCP_SA_JSON
set -euo pipefail

die() { echo "$*" >&2; exit 1; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLUG="${1:-}"
ENV="${2:-}"
TARGET_PROJECT="${3:-}"
DEVOPS_PROJECT="${4:-}"

BACKEND_PKG="${REPO_ROOT}/app/backend/__package.json"
[[ -f "$BACKEND_PKG" ]] || die "Not a Thunderstorm app repo (missing $BACKEND_PKG)"

if [[ -z "$SLUG" || -z "$ENV" ]]; then
	echo "Usage: bash scripts/create-deploy-sa.sh <slug> <env> [project-id] [artifact-project-id]"
	echo "  env is a key under app/backend/__package.json unitConfig.envs (not local)"
	echo "  SA name: <slug>-<env>-deploy  (must be ≤ 30 characters total)"
	echo "  Writes \$HOME/.config/gcloud/<slug>-<env>-deploy.json"
	echo "  Prints the Cursor secret name and a file:// link to that JSON."
	exit 1
fi

[[ "$SLUG" =~ ^[a-z][a-z0-9-]{1,28}[a-z0-9]$ ]] || die "slug must be lowercase alphanumeric + hyphens: $SLUG"
[[ "$ENV" =~ ^[a-z][a-z0-9-]{0,20}$ ]] || die "env must be lowercase alphanumeric + hyphens: $ENV"
[[ "$ENV" != local ]] || die "refusing env=local — that project is not a deploy target"

SA_ID="${SLUG}-${ENV}-deploy"
(( ${#SA_ID} <= 30 )) || die "service account id is ${#SA_ID} chars (max 30): $SA_ID — shorten the slug"

if [[ -z "$TARGET_PROJECT" ]]; then
	TARGET_PROJECT="$(python3 - "$BACKEND_PKG" "$ENV" <<'PY'
import json, sys
pkg_path, env = sys.argv[1], sys.argv[2]
envs = json.load(open(pkg_path))["unitConfig"]["envs"]
if env not in envs:
	keys = ", ".join(sorted(envs))
	raise SystemExit(f"no env {env!r} in unitConfig.envs ({keys})")
project = (envs[env] or {}).get("projectId") or ""
if not project:
	raise SystemExit(f"unitConfig.envs.{env} has no projectId")
print(project)
PY
)"
fi
if [[ -z "$DEVOPS_PROJECT" ]]; then
	DEVOPS_PROJECT="$(python3 -c "import json; print(json.load(open('$BACKEND_PKG'))['unitConfig']['containerDeployment']['artifactRegistry']['projectId'])")"
fi
# Image region (Artifact Registry repos) vs Cloud Run region (runRegion, falls back to the image region)
IMAGE_REGION="$(python3 -c "import json; print(json.load(open('$BACKEND_PKG'))['unitConfig']['containerDeployment']['artifactRegistry']['region'])")"
[[ -n "$IMAGE_REGION" ]] || die "containerDeployment.artifactRegistry.region is empty"
RUN_REGION="$(python3 -c "import json; cd=json.load(open('$BACKEND_PKG'))['unitConfig']['containerDeployment']; print(cd.get('runRegion') or cd['artifactRegistry']['region'])")"

[[ "$TARGET_PROJECT" != replace-* && "$TARGET_PROJECT" != demo-project ]] \
	|| die "$ENV projectId is still a placeholder: $TARGET_PROJECT — fill app/backend/__package.json first"
[[ "$DEVOPS_PROJECT" != replace-* ]] \
	|| die "artifact projectId is still a placeholder: $DEVOPS_PROJECT — fill containerDeployment.artifactRegistry.projectId first"

export PATH="${HOME}/google-cloud-sdk/bin:/opt/homebrew/share/google-cloud-sdk/bin:/opt/homebrew/bin:/usr/local/bin:${PATH}"
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
command -v gcloud >/dev/null || die "gcloud is not on PATH. Install the SDK or add \$HOME/google-cloud-sdk/bin"

ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -1 || true)"
[[ -n "$ACCOUNT" ]] || die "gcloud has no active account. Run: gcloud auth login"

TOKEN="$(gcloud auth print-access-token 2>/dev/null || true)"
[[ -n "$TOKEN" && "$TOKEN" != *"ERROR"* ]] || die "gcloud auth print-access-token failed for $ACCOUNT. Run: gcloud auth login"
export CLOUDSDK_AUTH_ACCESS_TOKEN="$TOKEN"

echo "gcloud account: $ACCOUNT"
echo "env: $ENV  project: $TARGET_PROJECT  image region: $IMAGE_REGION  run region: $RUN_REGION"

gcloud projects describe "$TARGET_PROJECT" --format='value(projectId)' >/dev/null \
	|| die "no access to $ENV project $TARGET_PROJECT"
gcloud projects describe "$DEVOPS_PROJECT" --format='value(projectId)' >/dev/null \
	|| die "no access to artifact project $DEVOPS_PROJECT"

assert_perms() {
	local project="$1"
	shift
	python3 - "$TOKEN" "$project" "$@" <<'PY'
import json, sys, urllib.request, urllib.error
token, project, *needed = sys.argv[1:]
body = json.dumps({"permissions": needed}).encode()
req = urllib.request.Request(
	f"https://cloudresourcemanager.googleapis.com/v1/projects/{project}:testIamPermissions",
	data=body,
	method="POST",
	headers={
		"Authorization": f"Bearer {token}",
		"Content-Type": "application/json",
		"x-goog-user-project": project,
	},
)
try:
	with urllib.request.urlopen(req, timeout=30) as resp:
		got = set(json.load(resp).get("permissions") or [])
except urllib.error.HTTPError as exc:
	detail = exc.read().decode(errors="replace")
	print(f"testIamPermissions failed on {project} ({exc.code}): {detail[:500]}", file=sys.stderr)
	sys.exit(1)
missing = [p for p in needed if p not in got]
if missing:
	print(f"missing on {project}: {', '.join(missing)}", file=sys.stderr)
	sys.exit(1)
print(f"caller can grant on {project}")
PY
}

echo "asserting caller permissions…"
assert_perms "$DEVOPS_PROJECT" \
	resourcemanager.projects.get \
	iam.serviceAccounts.create \
	iam.serviceAccounts.get \
	iam.serviceAccountKeys.create \
	resourcemanager.projects.setIamPolicy \
	serviceusage.services.enable \
	iam.serviceAccounts.setIamPolicy
assert_perms "$TARGET_PROJECT" \
	resourcemanager.projects.get \
	resourcemanager.projects.setIamPolicy \
	serviceusage.services.enable \
	iam.serviceAccounts.setIamPolicy

SA_EMAIL="${SA_ID}@${DEVOPS_PROJECT}.iam.gserviceaccount.com"
KEY_DIR="${HOME}/.config/gcloud"
KEY_FILE="${KEY_DIR}/${SA_ID}.json"
SECRET_NAME="GCP_SA_JSON"

if [[ "$KEY_FILE" == "${REPO_ROOT}"/* ]]; then
	die "Refusing to write a service-account key inside the repo: $KEY_FILE"
fi

DEVOPS_NUM="$(gcloud projects describe "$DEVOPS_PROJECT" --format='value(projectNumber)')"
TARGET_NUM="$(gcloud projects describe "$TARGET_PROJECT" --format='value(projectNumber)')"
CB_RUNTIME="${DEVOPS_NUM}-compute@developer.gserviceaccount.com"
COMPUTE_SA="${TARGET_NUM}-compute@developer.gserviceaccount.com"
RUN_AGENT="service-${TARGET_NUM}@serverless-robot-prod.iam.gserviceaccount.com"

echo "enabling APIs…"
gcloud services enable \
	cloudbuild.googleapis.com \
	artifactregistry.googleapis.com \
	cloudresourcemanager.googleapis.com \
	firebase.googleapis.com \
	firebasehosting.googleapis.com \
	firebasedatabase.googleapis.com \
	--project="$DEVOPS_PROJECT"
gcloud services enable \
	run.googleapis.com \
	firebase.googleapis.com \
	firebasehosting.googleapis.com \
	firebasedatabase.googleapis.com \
	iam.googleapis.com \
	--project="$TARGET_PROJECT"

echo "asserting Artifact Registry repos and Cloud Build bucket…"
gcloud artifacts repositories describe web-apps --project="$DEVOPS_PROJECT" --location="$IMAGE_REGION" >/dev/null \
	|| die "missing Artifact Registry repo web-apps in $DEVOPS_PROJECT ($IMAGE_REGION)"
gcloud artifacts repositories describe hosting-builds --project="$DEVOPS_PROJECT" --location="$IMAGE_REGION" >/dev/null \
	|| die "missing Artifact Registry repo hosting-builds in $DEVOPS_PROJECT ($IMAGE_REGION)"
gcloud storage buckets describe "gs://${DEVOPS_PROJECT}_cloudbuild" >/dev/null \
	|| die "missing Cloud Build bucket gs://${DEVOPS_PROJECT}_cloudbuild"

if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$DEVOPS_PROJECT" >/dev/null 2>&1; then
	echo "creating $SA_EMAIL…"
	gcloud iam service-accounts create "$SA_ID" \
		--project="$DEVOPS_PROJECT" \
		--display-name="${SLUG} ${ENV} deploy" \
		--description="${ENV} Cloud Build + Cloud Run + Firebase Hosting/RTDB"
else
	echo "SA already exists: $SA_EMAIL"
fi

echo "granting IAM…"
gcloud projects add-iam-policy-binding "$DEVOPS_PROJECT" --member="serviceAccount:${SA_EMAIL}" --role="roles/cloudbuild.builds.editor" --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$DEVOPS_PROJECT" --member="serviceAccount:${SA_EMAIL}" --role="roles/cloudbuild.builds.builder" --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$DEVOPS_PROJECT" --member="serviceAccount:${SA_EMAIL}" --role="roles/serviceusage.serviceUsageConsumer" --condition=None >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$CB_RUNTIME" --project="$DEVOPS_PROJECT" --member="serviceAccount:${SA_EMAIL}" --role="roles/iam.serviceAccountUser" >/dev/null
gcloud artifacts repositories add-iam-policy-binding web-apps --project="$DEVOPS_PROJECT" --location="$IMAGE_REGION" --member="serviceAccount:${SA_EMAIL}" --role="roles/artifactregistry.writer" >/dev/null
gcloud artifacts repositories add-iam-policy-binding hosting-builds --project="$DEVOPS_PROJECT" --location="$IMAGE_REGION" --member="serviceAccount:${SA_EMAIL}" --role="roles/artifactregistry.writer" >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://${DEVOPS_PROJECT}_cloudbuild" --member="serviceAccount:${SA_EMAIL}" --role="roles/storage.admin" >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://${DEVOPS_PROJECT}_cloudbuild" --member="serviceAccount:${CB_RUNTIME}" --role="roles/storage.admin" >/dev/null
gcloud artifacts repositories add-iam-policy-binding web-apps --project="$DEVOPS_PROJECT" --location="$IMAGE_REGION" --member="serviceAccount:${CB_RUNTIME}" --role="roles/artifactregistry.writer" >/dev/null
gcloud artifacts repositories add-iam-policy-binding web-apps --project="$DEVOPS_PROJECT" --location="$IMAGE_REGION" --member="serviceAccount:${RUN_AGENT}" --role="roles/artifactregistry.reader" >/dev/null

gcloud projects add-iam-policy-binding "$TARGET_PROJECT" --member="serviceAccount:${SA_EMAIL}" --role="roles/run.admin" --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$TARGET_PROJECT" --member="serviceAccount:${SA_EMAIL}" --role="roles/logging.viewer" --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$TARGET_PROJECT" --member="serviceAccount:${SA_EMAIL}" --role="roles/firebasehosting.admin" --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$TARGET_PROJECT" --member="serviceAccount:${SA_EMAIL}" --role="roles/firebasedatabase.admin" --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$TARGET_PROJECT" --member="serviceAccount:${SA_EMAIL}" --role="roles/serviceusage.serviceUsageConsumer" --condition=None >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$COMPUTE_SA" --project="$TARGET_PROJECT" --member="serviceAccount:${SA_EMAIL}" --role="roles/iam.serviceAccountUser" >/dev/null

mkdir -p "$KEY_DIR"
umask 077
if [[ -f "$KEY_FILE" ]]; then
	echo "Key already at $KEY_FILE (not rotated, not printed)"
else
	gcloud iam service-accounts keys create "$KEY_FILE" --iam-account="$SA_EMAIL" --project="$DEVOPS_PROJECT" >/dev/null
	chmod 600 "$KEY_FILE"
	echo "Key written (not printed)"
fi

FILE_URL="$(python3 -c "import pathlib,sys; print(pathlib.Path(sys.argv[1]).expanduser().resolve().as_uri())" "$KEY_FILE")"

echo
echo "SA: $SA_EMAIL"
echo
echo "Cursor secret name:"
echo "  $SECRET_NAME"
echo
echo "Open this file, copy the entire JSON, paste it as that secret's value:"
echo "  $FILE_URL"
echo
echo "Do not commit the key. Do not paste it into chat."
