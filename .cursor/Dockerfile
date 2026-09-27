# Cloud Agent image. Cursor checks out the repo; do not COPY it here.
FROM node:22-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    cpio \
    curl \
    git \
    openssh-client \
    python3 \
    rsync \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable \
  && corepack prepare pnpm@9.15.0 --activate

WORKDIR /workspace
