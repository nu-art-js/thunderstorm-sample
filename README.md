# Thunderstorm Sample

Vite frontend + Storm backend in one BAI monorepo. Thunderstorm rules live in [`_thunderstorm/CLAUDE.md`](_thunderstorm/CLAUDE.md).

**Use BAI only.** Never `pnpm install` / `pnpm run build` as the workflow. `bai` is `bash build-and-install.sh` from this repo root.

## First-time setup

```bash
git clone --recurse-submodules git@github.com:nu-art-js/thunderstorm-sample.git
cd thunderstorm-sample
# If you cloned without --recurse-submodules:
git submodule update --init --recursive
```

`_thunderstorm` is a git submodule. An empty `_thunderstorm/` means the tree cannot compile.

Then from repo root:

```bash
bash build-and-install.sh init
```

This repo’s `build-and-install.sh` injects `--ts-version` from [`version-thunderstorm.json`](version-thunderstorm.json) (currently **0.500.6**). The upstream BAI wrapper still defaults to `~0.401.0` and does **not** read that file. Always go through this script.

Confirm after init:

```bash
node -p "require('./node_modules/@nu-art/build-and-install/package.json').version"
# must be 0.500.x
```

If you see `0.401.x`, you bypassed the wrapper. Re-run with the hack:

```bash
bash build-and-install.sh init --ts-version="$(python3 -c "import json; print(json.load(open('version-thunderstorm.json'))['version'])")"
# or: TS_VERSION=0.500.6 bash build-and-install.sh init
```

Never `bai -i -up=<subset>` — that rewrites a broken `pnpm-workspace.yaml`.

## Docker

**Required** for local backend (`bai -l`) and mocha e2e (`bai -t -tt=pure -up=@app/e2e$`). Those start a Mongo replica-set container and Firebase emulators.

```bash
docker info   # must succeed before launch or e2e
```

Human ports are listed in [`bai-config.json`](bai-config.json) `templateParams.params` and as matching literals in the app `__package.json` files (backend **8002**, frontend **8001**, mongo **27018**). E2E uses a dedicated zone: backend **8102**, mongo **27039**.

## GCP / JWT secrets

Password-auth session JWTs use Secret Manager (`jwt-signer--account-session`).

- Set **`GCP_PROJECT_ID`** to a **real** GCP project (ADC must be able to read that secret), **or** `gcloud config set project <id>`.
- Do **not** use the emulator id (`demo-project`, `*-local`). `GCLOUD_PROJECT` / `GOOGLE_CLOUD_PROJECT` stay on the emulator project.

```bash
export GCP_PROJECT_ID=<real-gcp-project>
```

## Daily commands

| Intent | Command |
|--------|---------|
| Build | `bai` or `bai -up=<regexp>` |
| Backend (SSL, port 8002) | `bai -nb -up=@app/backend -l` |
| Vite frontend (port 8001) | `bai -nb -up=@app/frontend-vite -lf` |
| Harness unit tests | `bai -t -nb -tt=pure -up=e2e-harness` |
| Product e2e | `bai -t -nb -tt=pure -up=@app/e2e$` |
| Firebase module tests | `bai -t -nb -tt=firebase -up=<package>` |
| Playwright | `bai -t -nb -tt=playwright -up=<package>` |
| Deploy staging | `bash deploy.sh build <version> staging` then `bash deploy.sh deploy <version> staging` |

Flags: [`_thunderstorm/.rules/operational/bai-cli.mdc`](_thunderstorm/.rules/operational/bai-cli.mdc).

## Deploy

`deploy.sh` is the only ship path. It builds in Cloud Build (no local Docker), deploys one unit at a time, applies `releases/<semver>.json` onto RTDB after the backend revision is serving, moves the `env/<env>` tag, and restores `-se=local`.

`env` defaults to `staging`. Prod refuses to run unless `DEPLOY_CONFIRM_PROD=yes`.

Before the first real deploy, replace `replace-artifact-project`, `replace-dev`, `replace-staging`, and `replace-prod` (see `.cursor/rules/deploy-policy.mdc`). `version-app.json` is the app version. Tag `v<version>`.

```bash
python3 deploy_rtdb_deltas_test.py
```
