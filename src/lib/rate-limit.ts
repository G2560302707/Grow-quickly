/**
 * 内存令牌桶限流（单机部署足够；多实例部署时需替换为 Redis 等共享存储）。
 *
 * 用法：在路由内取到用户身份或 IP 后调用 rateLimit(key, { limit, windowMs })，
 * 未通过时返回 tooManyRequests(res.retryAfterSeconds)。
 */
import { NextResponse } from "next/server";

interface Bucket {
    tokens: number;
    lastRefill: number;
}

const buckets = new Map<string, Bucket>();

// 定期清理不活跃桶，防止 Map 无限增长
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();

export interface RateLimitOptions {
    /** 窗口内允许的最大请求数 */
    limit: number;
    /** 窗口时长（毫秒） */
    windowMs: number;
}

export interface RateLimitResult {
    allowed: boolean;
    retryAfterSeconds: number;
}

export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
    const now = Date.now();
    cleanupIfNeeded(now);

    let bucket = buckets.get(key);
    if (!bucket) {
        bucket = { tokens: options.limit, lastRefill: now };
        buckets.set(key, bucket);
    }

    // 随时间线性补充令牌
    const elapsed = now - bucket.lastRefill;
    if (elapsed > 0) {
        bucket.tokens = Math.min(options.limit, bucket.tokens + (elapsed / options.windowMs) * options.limit);
        bucket.lastRefill = now;
    }

    if (bucket.tokens < 1) {
        const retryAfterSeconds = Math.max(1, Math.ceil((((1 - bucket.tokens) / options.limit) * options.windowMs) / 1000));
        return { allowed: false, retryAfterSeconds };
    }

    bucket.tokens -= 1;
    return { allowed: true, retryAfterSeconds: 0 };
}

function cleanupIfNeeded(now: number) {
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;
    for (const [key, bucket] of buckets) {
        if (now - bucket.lastRefill > CLEANUP_INTERVAL_MS) {
            buckets.delete(key);
        }
    }
}

/** 清空所有限流状态（仅供测试/热重载场景使用，业务代码勿调） */
export function resetRateLimits() {
    buckets.clear();
    lastCleanup = Date.now();
}

/** 提取客户端 IP（反向代理场景取 x-forwarded-for 首段） */
export function clientIp(req: Request): string {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return req.headers.get("x-real-ip") || "unknown";
}

/** 429 响应（带 Retry-After 头） */
export function tooManyRequests(retryAfterSeconds: number, message = "请求过于频繁，请稍后再试") {
    return NextResponse.json(
        { message, code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
}
