# Build context is the repo root (see docker-compose), for consistency with
# the other services even though this one has no workspace dependency.

FROM node:22-alpine
RUN apk add --no-cache git
WORKDIR /repo
# The lockfile is copied and installed with `npm ci` so the image gets exactly the dependency versions CI tested
# (`npm install` without it re-resolved the latest in-range versions on every build).
COPY package.json package-lock.json ./
COPY services/whatsapp-bot/package.json services/whatsapp-bot/package.json
RUN npm ci --workspace=services/whatsapp-bot --include-workspace-root

COPY services/whatsapp-bot services/whatsapp-bot

WORKDIR /repo/services/whatsapp-bot
EXPOSE 4100
CMD ["node", "src/index.js"]
