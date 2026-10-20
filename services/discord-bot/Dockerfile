# Build context is the repo root (see docker-compose).

FROM node:20-alpine
RUN apk add --no-cache git
WORKDIR /repo
# The lockfile is copied and installed with `npm ci` so the image gets exactly the dependency versions CI tested
# (`npm install` without it re-resolved the latest in-range versions on every build).
COPY package.json package-lock.json ./
COPY services/discord-bot/package.json services/discord-bot/package.json
RUN npm ci --workspace=services/discord-bot --include-workspace-root

COPY services/discord-bot services/discord-bot

WORKDIR /repo/services/discord-bot
EXPOSE 4200
CMD ["node", "src/index.js"]
