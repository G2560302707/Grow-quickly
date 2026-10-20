/**
 * 错题分享令牌（无鉴权只读分享用）
 *
 * 背景：微信「分享到朋友圈」进入单页模式（scene 1154）时无登录态，wx.login 不可用，
 * 因此分享落地页不能依赖 session。这里用 HMAC 签名的短期令牌替代鉴权：
 *   token = `${exp}.${base64url(hmac(sha256, `${itemId}.${exp}`))}`
 *
 * 设计要点：
 * - 令牌与 itemId 绑定：A 题的令牌无法读取 B 题
 * - 带过期时间，默认 7 天；过期后需在小程序内重新分享
 * - 密钥优先取 SHARE_TOKEN_SECRET，回落 NEXTAUTH_SECRET（避免多一份必填配置）
 */
import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

function getSecret(): string {
    return process.env.SHARE_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || "";
}

function sign(itemId: string, exp: number): string {
    return createHmac("sha256", getSecret())
        .update(`${itemId}.${exp}`)
        .digest("base64url");
}

/**
 * 生成分享令牌。
 * 密钥未配置时返回空串，调用方应将其视为「当前不可分享」。
 */
export function createShareToken(itemId: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
    if (!itemId || !getSecret()) return "";
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    return `${exp}.${sign(itemId, exp)}`;
}

export type ShareTokenFailure = "missing" | "invalid" | "expired";

export type ShareTokenResult =
    | { ok: true; expiresAt: Date }
    | { ok: false; reason: ShareTokenFailure };

/** 校验分享令牌（缺少密钥一律视为无效） */
export function verifyShareToken(itemId: string, token?: string | null): ShareTokenResult {
    if (!getSecret()) return { ok: false, reason: "invalid" };
    if (!itemId) return { ok: false, reason: "missing" };
    if (!token) return { ok: false, reason: "missing" };

    const dot = token.lastIndexOf(".");
    if (dot <= 0) return { ok: false, reason: "invalid" };

    const expStr = token.slice(0, dot);
    const signature = token.slice(dot + 1);
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || !signature) return { ok: false, reason: "invalid" };

    const expected = sign(itemId, exp);
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    // 定长比较，避免时序侧信道
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return { ok: false, reason: "invalid" };
    }

    const now = Math.floor(Date.now() / 1000);
    if (exp < now) return { ok: false, reason: "expired" };

    return { ok: true, expiresAt: new Date(exp * 1000) };
}
