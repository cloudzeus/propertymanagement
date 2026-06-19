# syntax=docker/dockerfile:1

# Production image for the Next.js 16 app. Uses official Node 24 (Prisma 7 needs
# Node 20.19+/22.12+/24+), avoiding the nixpacks node-version limitation.

FROM node:24-slim AS base
WORKDIR /app
# Prisma needs openssl at runtime; ca-certificates for outbound TLS.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# ── Build stage ──────────────────────────────────────────────────────────────
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time vars (NEXT_PUBLIC_* are inlined into the client bundle at build).
# Coolify passes these as build args when marked "Available at Buildtime".
ARG DATABASE_URL
ARG AUTH_SECRET
ARG NEXTAUTH_URL
ARG MAPTILER_API_KEY
ARG NEXT_PUBLIC_MAPTILER_API_KEY
ARG GOOGLE_LOCATION_KEY

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Copy the full built app (no `output: standalone`, so `next start` needs the
# .next output, node_modules, config, public, and runtime files).
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "run", "start"]
