# Build context for this Dockerfile is the REPO ROOT (see docker-compose's
# `context: ../.. , dockerfile: apps/api/Dockerfile`), not apps/api itself —
# required so npm workspaces can resolve the @shanutechx/db dependency,
# which is a symlink into packages/db, not a published package.

FROM node:20-alpine AS deps
RUN apk add --no-cache git
WORKDIR /repo
COPY package.json ./
COPY packages/db/package.json packages/db/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace=apps/api --workspace=packages/db --include-workspace-root

FROM deps AS builder
COPY packages/db packages/db
COPY apps/api apps/api
COPY templates templates
RUN npx prisma generate --schema packages/db/prisma/schema.prisma
RUN npm run build --workspace=apps/api

FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages/db ./packages/db
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/apps/api/package.json ./apps/api/package.json
# Audit finding C7: the self-hosted app catalog (WordPress/n8n/MongoDB/
# Redis/Lavalink/LiveKit one-click deploy) reads templates/*.yaml off disk
# at request time (see lib/catalog/catalog-manager.ts and
# routes/catalog.ts) — this directory was never copied into the runtime
# image, so the catalog silently returned empty/errored in every
# production deployment built from this Dockerfile.
COPY --from=builder /repo/templates ./templates

WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/index.js"]
