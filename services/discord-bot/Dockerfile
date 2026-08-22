# Build context is the repo root (see docker-compose).

FROM node:20-alpine
RUN apk add --no-cache git
WORKDIR /repo
COPY package.json ./
COPY services/discord-bot/package.json services/discord-bot/package.json
RUN npm install --workspace=services/discord-bot --include-workspace-root

COPY services/discord-bot services/discord-bot

WORKDIR /repo/services/discord-bot
EXPOSE 4200
CMD ["node", "src/index.js"]
