FROM node:22-bookworm-slim AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
# better-sqlite3 预编译缺失时需 python3/make/g++ 本地编译
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Generate Prisma Client and Seed Database
# We temporarily set DATABASE_URL to a local file for the build process to generate the file
ENV DATABASE_URL="file:/app/prisma/dev.db"

# Pre-compile runtime scripts FIRST (needed for tag seeding)
RUN npx tsc scripts/rebuild-system-tags.ts scripts/seed-gongkao-tags.ts --outDir dist-scripts --esModuleInterop --resolveJsonModule --skipLibCheck --module commonjs --target ES2020

# Initialize database: generate client, run migrations, seed admin user, seed system tags
RUN npx prisma generate \
    && npx prisma migrate deploy \
    && npx prisma db seed \
    && node ./dist-scripts/scripts/rebuild-system-tags.js \
    && node ./dist-scripts/scripts/seed-gongkao-tags.js

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED=1

# Install dependencies and create user (gosu 替代 alpine 的 su-exec)
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends openssl gosu ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# Copy Prisma CLI and engine files from builder
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and migrations for runtime usage if needed (e.g. for migrations)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Create empty config directory (mounted as a volume in compose; the app-config.json
# with AI keys must NEVER be baked into the image — configure via admin UI on first run)
RUN mkdir -p /app/config && chown -R nextjs:nodejs /app/config

# Copy pre-compiled runtime scripts
COPY --from=builder --chown=nextjs:nodejs /app/dist-scripts ./dist-scripts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/seed-admin.js ./dist-scripts/scripts/seed-admin.js

# Create data directory for SQLite persistence
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Copy entrypoint script
COPY --chown=nextjs:nodejs --chmod=755 docker-entrypoint.sh ./
COPY --chown=nextjs:nodejs https-server.js ./

EXPOSE 3000

ENV PORT=3000
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

# Environment variables 
# Point to the persistent data location
ENV DATABASE_URL="file:/app/data/dev.db"
ENV AUTH_TRUST_HOST=true

# Use entrypoint script to handle DB initialization
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
