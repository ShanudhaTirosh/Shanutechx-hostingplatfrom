# Build context is the repo root (see docker-compose).
# Follows the monorepo workspace standalone build pattern identical to apps/dashboard and apps/web.

FROM node:22-alpine AS deps
RUN apk add --no-cache git
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/webmail/package.json apps/webmail/package.json
RUN npm ci --workspace=apps/webmail --include-workspace-root

FROM deps AS builder
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_DATABASE_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DASHBOARD_URL

ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_DATABASE_URL=$NEXT_PUBLIC_FIREBASE_DATABASE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DASHBOARD_URL=$NEXT_PUBLIC_DASHBOARD_URL

COPY apps/webmail apps/webmail
COPY packages/types packages/types
RUN npm run build --workspace=apps/webmail

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3002

COPY --from=builder /repo/apps/webmail/.next/standalone ./
COPY --from=builder /repo/apps/webmail/.next/static ./apps/webmail/.next/static
COPY --from=builder /repo/apps/webmail/public ./apps/webmail/public

EXPOSE 3002
CMD ["node", "apps/webmail/server.js"]
