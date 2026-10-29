# ──────────────────────────────────────────────
# Stage 1: build
# ──────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy manifests first to leverage layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies needed for tsc)
RUN npm ci

# Copy source and compile
COPY tsconfig.json ./
COPY src ./src
COPY openapi.yaml ./

RUN npm run build

# ──────────────────────────────────────────────
# Stage 2: runtime
# ──────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Copy manifests and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output and the OpenAPI spec (served at /api/docs)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/openapi.yaml ./openapi.yaml

# Run as a non-root user for security
RUN addgroup -S novaevents && adduser -S novaevents -G novaevents

# Create the default data directory for the SQLite index and the local
# image-URL store, owned by the user that actually runs the process below.
# /app itself stays root-owned, so a directory created here without an
# explicit chown would be unwritable to that user — the default
# INDEX_DB_PATH and IMAGE_STORE_PATH both resolve under it.
RUN mkdir -p data && chown -R novaevents:novaevents data

USER novaevents

EXPOSE 3001

CMD ["node", "dist/index.js"]
