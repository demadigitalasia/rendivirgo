# ------------------------------------------------------------------ build
FROM node:24-bookworm-slim AS builder

ARG NODE_ENV

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY prisma ./prisma
COPY prisma7.config.ts nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate && npm run build

# ------------------------------------------------------------------ runtime
FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000 \
    UPLOAD_DIR=uploads \
    PRISMA_SKIP_POSTINSTALL_GENERATE=true

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/generated ./generated
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
COPY prisma7.config.ts ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p uploads

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD curl -fsS http://127.0.0.1:4000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
