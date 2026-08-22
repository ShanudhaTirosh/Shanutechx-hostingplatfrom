# Build context is the repo root (see docker-compose), for consistency with
# the other services even though this one has no workspace dependency.

FROM node:20-alpine
RUN apk add --no-cache git
WORKDIR /repo
COPY package.json ./
COPY services/whatsapp-bot/package.json services/whatsapp-bot/package.json
RUN npm install --workspace=services/whatsapp-bot --include-workspace-root

COPY services/whatsapp-bot services/whatsapp-bot

WORKDIR /repo/services/whatsapp-bot
EXPOSE 4100
CMD ["node", "src/index.js"]
