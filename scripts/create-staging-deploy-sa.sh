#!/usr/bin/env bash
# Create a staging-only deploy SA in nu-art-dev-ops and write its JSON key
# under $HOME/.config/gcloud — never under the git worktree.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLUG="${1:-}"
STAGING_PROJECT="${2:-}"
DEVOPS_PROJECT="${3:-nu-art-dev-ops}"

if [[ -z "$SLUG" || -z "$STAGING_PROJECT" ]]; then
  echo "Usage: bash scripts/create-staging-deploy-sa.sh <slug> <staging-project-id> [artifact-project-id]"
  echo "  Writes the key to \$HOME/.config/gcloud/<slug>-staging-deploy.json"
  echo "  Refuses to write inside the repo."
  exit 1
fi

export PATH="${HOME}/google-cloud-sdk/bin:${PATH}"
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
if [[ -z "${CLOUDSDK_AUTH_ACCESS_TOKEN:-}" ]]; then
  export CLOUDSDK_AUTH_ACCESS_TOKEN="$(gcloud auth application-default print-access-token)"
fi

SA_ID="${SLUG}-staging-deploy"
SA_EMAIL="${SA_ID}@${DEVOPS_PROJECT}.iam.gserviceaccount.com"
KEY_DIR="${HOME}/.config/gcloud"
KEY_FILE="${KEY_DIR}/${SA_ID}.json"

case "$KEY_FILE" in
  "${ROOT}"/*)
    echo "Refusing to write a service-account key inside the repo: $KEY_FILE" >&2
    exit 1
    ;;
esac
if git -C "$ROOT" check-ignore -q "$KEY_FILE" 2>/dev/null; then
  :
fi
if [[ "$KEY_FILE" == "$ROOT"* ]]; then
  echo "Refusing to write a service-account key inside the repo: $KEY_FILE" >&2
  exit 1
fi

DEVOPS_NUM="$(gcloud projects describe "$DEVOPS_PROJECT" --format='value(projectNumber)')"
STAGING_NUM="$(gcloud projects describe "$STAGING_PROJECT" --format='value(projectNumber)')"
CB_RUNTIME="${DEVOPS_NUM}-compute@developer.gserviceaccount.com"
COMPUTE_SA="${STAGING_NUM}-compute@developer.gserviceaccount.com"
RUN_AGENT="service-${STAGING_NUM}@serverless-robot-prod.iam.gserviceaccount.com"

gcloud services enable \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project="$DEVOPS_PROJECT"
gcloud services enable \
  run.googleapis.com \
  firebase.googleapis.com \
  firebasehosting.googleapis.com \
  firebasedatabase.googleapis.com \
  iam.googleapis.com \
  --project="$STAGING_PROJECT"

if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$DEVOPS_PROJECT" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_ID" \
    --project="$DEVOPS_PROJECT" \
    --display-name="${SLUG} staging deploy" \
    --description="Staging-only Cloud Build + Cloud Run + Firebase Hosting/RTDB"
fi

gcloud projects add-iam-policy-binding "$DEVOPS_PROJECT" --member="serviceAccount:${SA_EMAIL}" --role="roles/cloudbuild.builds.editor" --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$DEVOPS_PROJECT" --member="serviceAccount:${SA_EMAIL}" --role="roles/serviceusage.serviceUsageConsumer" --condition=None >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$CB_RUNTIME" --project="$DEVOPS_PROJECT" --member="serviceAccount:${SA_EMAIL}" --role="roles/iam.serviceAccountUser" >/dev/null
gcloud artifacts repositories add-iam-policy-binding web-apps --project="$DEVOPS_PROJECT" --location=us-central1 --member="serviceAccount:${SA_EMAIL}" --role="roles/artifactregistry.writer" >/dev/null
gcloud artifacts repositories add-iam-policy-binding hosting-builds --project="$DEVOPS_PROJECT" --location=us-central1 --member="serviceAccount:${SA_EMAIL}" --role="roles/artifactregistry.writer" >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://${DEVOPS_PROJECT}_cloudbuild" --member="serviceAccount:${SA_EMAIL}" --role="roles/storage.admin" >/dev/null
gcloud artifacts repositories add-iam-policy-binding web-apps --project="$DEVOPS_PROJECT" --location=us-central1 --member="serviceAccount:${CB_RUNTIME}" --role="roles/artifactregistry.writer" >/dev/null
gcloud artifacts repositories add-iam-policy-binding web-apps --project="$DEVOPS_PROJECT" --location=us-central1 --member="serviceAccount:${RUN_AGENT}" --role="roles/artifactregistry.reader" >/dev/null

gcloud projects add-iam-policy-binding "$STAGING_PROJECT" --member="serviceAccount:${SA_EMAIL}" --role="roles/run.developer" --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$STAGING_PROJECT" --member="serviceAccount:${SA_EMAIL}" --role="roles/firebasehosting.admin" --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$STAGING_PROJECT" --member="serviceAccount:${SA_EMAIL}" --role="roles/firebasedatabase.admin" --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$STAGING_PROJECT" --member="serviceAccount:${SA_EMAIL}" --role="roles/serviceusage.serviceUsageConsumer" --condition=None >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$COMPUTE_SA" --project="$STAGING_PROJECT" --member="serviceAccount:${SA_EMAIL}" --role="roles/iam.serviceAccountUser" >/dev/null

mkdir -p "$KEY_DIR"
umask 077
if [[ -f "$KEY_FILE" ]]; then
  echo "Key already at $KEY_FILE (not rotated, not printed)"
else
  gcloud iam service-accounts keys create "$KEY_FILE" --iam-account="$SA_EMAIL" --project="$DEVOPS_PROJECT" >/dev/null
  chmod 600 "$KEY_FILE"
  echo "Key written to $KEY_FILE (not printed)"
fi

echo "SA: $SA_EMAIL"
echo "Put that file in a Cursor secret. Do not copy it into the repo."
