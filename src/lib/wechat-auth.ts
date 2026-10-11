import { createLogger } from "@grow/shared/logger";
import { prisma } from "@grow/shared/prisma";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";

const logger = createLogger("wechat-auth");

export interface WechatSessionInfo {
    openid: string;
    unionid?: string;
}

/**
 * 用 uni.login 的 js_code 调微信 code2Session 换取 openid。
 * AppSecret 只在服务端使用；失败时抛 WECHAT_* 错误码（authorize 侧统一兜底为登录失败）。
 */
export async function fetchWechatSession(jsCode: string, appid: string, secret: string): Promise<WechatSessionInfo> {
    const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
    url.searchParams.set("appid", appid);
    url.searchParams.set("secret", secret);
    url.searchParams.set("js_code", jsCode);
    url.searchParams.set("grant_type", "authorization_code");

    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
        throw new Error(`WECHAT_UPSTREAM_${res.status}`);
    }
    const data = (await res.json()) as {
        openid?: string;
        unionid?: string;
        errcode?: number;
        errmsg?: string;
    };
    // code2Session 失败时 HTTP 仍为 200，错误码在 body（40029 code 无效 / 45011 频率限制 / 40226 高风险用户等）
    if (!data.openid || (typeof data.errcode === "number" && data.errcode !== 0)) {
        logger.warn({ errcode: data.errcode, errmsg: data.errmsg }, "jscode2session failed");
        throw new Error(`WECHAT_CODE_INVALID_${data.errcode ?? "UNKNOWN"}`);
    }
    return { openid: data.openid, unionid: data.unionid };
}

/**
 * 微信用户的合成邮箱：openid 稳定 ⇒ 邮箱稳定，复用 User.email 唯一约束做幂等键，无需改表。
 * 邮箱不可用于密码登录（密码为随机值），用户之后可在设置里自行设置密码。
 */
export function wechatEmailForOpenid(openid: string): string {
    return `wx-${openid}@wechat.local`;
}

/** 按 openid 查找或创建用户；已存在则直接返回 */
export async function findOrCreateWechatUser(openid: string) {
    const email = wechatEmailForOpenid(openid);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return existing;

    const password = await hash(randomBytes(24).toString("hex"), 10);
    const user = await prisma.user.create({
        data: {
            email,
            password,
            name: `微信用户${openid.slice(-4).toUpperCase()}`,
        },
    });
    logger.info({ userId: user.id }, "Created wechat user");
    return user;
}
