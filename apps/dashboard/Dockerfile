# Build context is the repo root (see docker-compose). Same standalone
# output structure as apps/web/Dockerfile — see that file's comment for why
# the paths below aren't what a generic single-app Next.js Dockerfile would
# use.
#
# IMPORTANT: NEXT_PUBLIC_* vars are inlined into the client JS bundle at
# BUILD time by Next.js, not read at container runtime. Setting them in
# apps/dashboard/.env does nothing for the built bundle — they must be
# passed as Docker build args (see docker-compose.yml's `build.args`),
# sourced from infra/control-plane/.env.

FROM node:20-alpine AS deps
RUN apk add --no-cache git
WORKDIR /repo
COPY package.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
RUN npm install --workspace=apps/dashboard --include-workspace-root

FROM deps AS builder
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

COPY apps/dashboard apps/dashboard
RUN npm run build --workspace=apps/dashboard

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001

COPY --from=builder /repo/apps/dashboard/.next/standalone ./
COPY --from=builder /repo/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder /repo/apps/dashboard/public ./apps/dashboard/public

EXPOSE 3001
CMD ["node", "apps/dashboard/server.js"]
