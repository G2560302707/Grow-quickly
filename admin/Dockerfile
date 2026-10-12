# 管理后台镜像：构建上下文必须为仓库根目录（compose 已设置 context: .）
FROM node:22-bookworm-slim AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY admin/package.json admin/
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install OpenSSL for Prisma
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Generate Prisma Client（schema 在仓库根 prisma/）
ENV DATABASE_URL="file:/app/prisma/dev.db"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate && cd admin && npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# Prisma client + CLI
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Standalone output（tracing root 锚定仓库根，server.js 位于 admin/ 下）
COPY --from=builder --chown=nextjs:nodejs /app/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/admin/.next/static ./admin/.next/static

# Prisma schema（客户端按 schema 位置解析 file: 相对路径）
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# 创建持久化目录（db 与 config 由 compose 卷挂载覆盖）
RUN mkdir -p /app/data /app/config && chown -R nextjs:nodejs /app/data /app/config

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/data/dev.db"
ENV APP_CONFIG_PATH=/app/config/app-config.json
ENV AUTH_TRUST_HOST=true

# 管理端不做迁移/seed（由学习端容器负责），直接启动
CMD ["node", "admin/server.js"]
