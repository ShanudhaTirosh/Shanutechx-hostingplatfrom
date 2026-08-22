# Build context is the repo root (see docker-compose).
#
# Using Debian slim rather than Alpine here specifically because this image
# needs the `railpack` CLI (a prebuilt Rust binary) and `git`, and Alpine's
# musl libc occasionally causes friction with prebuilt Rust binaries that
# expect glibc. The npm dependencies themselves (dockerode, systeminformation,
# js-yaml) are pure JS and would run fine on Alpine — this choice is purely
# about railpack compatibility.
#
# NOTE: this install step could not be verified in the environment this
# Dockerfile was authored in (network access to mise's and railpack's
# install endpoints was blocked there). Test `docker build` for this
# service specifically once you're on a real host with internet access,
# before relying on it. Railpack also needs a running BuildKit instance to
# build against — see the `buildkit` service and BUILDKIT_HOST in
# docker-compose.yml / .env.example, both required for `railpack build` to
# work at all, unlike Nixpacks which bundled its own build mechanism.

FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git curl ca-certificates \
  && curl -sSL https://mise.run | sh \
  && /root/.local/bin/mise install github:railwayapp/railpack@latest \
  && /root/.local/bin/mise use -g github:railwayapp/railpack@latest \
  && apt-get purge -y curl \
  && rm -rf /var/lib/apt/lists/*

ENV PATH="/root/.local/share/mise/shims:/root/.local/bin:${PATH}"

WORKDIR /repo
COPY package.json ./
COPY services/node-agent/package.json services/node-agent/package.json
RUN npm install --workspace=services/node-agent --include-workspace-root

COPY services/node-agent services/node-agent

WORKDIR /repo/services/node-agent
EXPOSE 5000
CMD ["node", "src/index.js"]
