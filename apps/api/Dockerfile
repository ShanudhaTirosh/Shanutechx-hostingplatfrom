# Build context for this Dockerfile is the REPO ROOT (see docker-compose's
# `context: ../.. , dockerfile: apps/api/Dockerfile`), not apps/api itself —
# required so npm workspaces can resolve the @shanutechx/db dependency,
# which is a symlink into packages/db, not a published package.

FROM node:20-alpine AS deps
RUN apk add --no-cache git
WORKDIR /repo
# The lockfile is copied and installed with `npm ci` so the image gets exactly the dependency versions CI tested
# (`npm install` without it re-resolved the latest in-range versions on every build).
COPY package.json package-lock.json ./
COPY packages/db/package.json packages/db/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm ci --workspace=apps/api --workspace=packages/db --include-workspace-root

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
COPY --from=builder /repo/templates ./templates

WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/index.js"]
