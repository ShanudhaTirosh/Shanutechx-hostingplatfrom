# Build context is the repo root (see docker-compose). The standalone output
# path structure below (apps/web/server.js, apps/web/.next/static, etc.) was
# verified against a real build of this monorepo, not assumed from a generic
# Next.js Docker example — those examples assume a single-app repo and get
# the paths wrong here, since Next traces standalone output relative to the
# workspace root, not apps/web itself.

FROM node:22-alpine AS deps
RUN apk add --no-cache git
WORKDIR /repo
# The lockfile is copied and installed with `npm ci` so the image gets exactly the dependency versions CI tested
# (`npm install` without it re-resolved the latest in-range versions on every build).
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace=apps/web --include-workspace-root

FROM deps AS builder
ARG API_BASE_URL
ARG NEXT_PUBLIC_DASHBOARD_URL
ENV API_BASE_URL=${API_BASE_URL}
ENV NEXT_PUBLIC_DASHBOARD_URL=${NEXT_PUBLIC_DASHBOARD_URL}
COPY apps/web apps/web
RUN npm run build --workspace=apps/web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
