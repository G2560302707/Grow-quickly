/**
 * uni.request 统一封装
 * - 统一 JSON 头、错误码解析（对齐后端 api-errors 的 { message, code } 结构）
 * - 401 自动跳转登录页
 * - 手动维护 next-auth.* 会话 Cookie，并额外用 X-Session-Token 头传递
 *   （微信真机常忽略自定义 Cookie 头；开发者工具对 Set-Cookie 持久化也不稳定）
 */
import { BASE_URL } from "./config";

export interface RequestOptions {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    data?: any;
    header?: Record<string, string>;
    /** 超时（毫秒）。批量出题等长任务需显式加大（uni.request 默认 60s） */
    timeout?: number;
}

export class ApiError extends Error {
    constructor(public statusCode: number, public code: string | undefined, message: string) {
        super(message);
        this.name = "ApiError";
    }
}

const STORAGE_KEY = "auth_cookie_jar";
const SESSION_COOKIE_KEYS = [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
];

const cookieJar = new Map<string, string>();

function loadJar() {
    try {
        const raw = uni.getStorageSync(STORAGE_KEY);
        if (!raw || typeof raw !== "object") return;
        for (const [k, v] of Object.entries(raw as Record<string, string>)) {
            if (k.includes("next-auth.") && typeof v === "string" && v) {
                cookieJar.set(k, v);
            }
        }
    } catch {
        /* storage 不可用时忽略 */
    }
}

function persistJar() {
    try {
        const obj: Record<string, string> = {};
        cookieJar.forEach((v, k) => {
            obj[k] = v;
        });
        uni.setStorageSync(STORAGE_KEY, obj);
    } catch {
        /* ignore */
    }
}

loadJar();

function ingestCookiePair(name: string, value: string, seg: string) {
    if (!name.includes("next-auth.")) return;
    if (!value || /Expires=Thu, 01 Jan 1970/i.test(seg)) {
        cookieJar.delete(name);
    } else {
        cookieJar.set(name, value);
    }
}

function harvestCookieString(raw: string | string[] | undefined) {
    if (!raw) return;
    const parts = Array.isArray(raw) ? raw : [raw];
    for (const part of parts) {
        for (const seg of part.split(/,(?=[^;(),]+?=)/)) {
            const pair = seg.split(";")[0] ?? "";
            const eq = pair.indexOf("=");
            if (eq <= 0) continue;
            ingestCookiePair(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim(), seg);
        }
    }
}

function harvestSetCookies(header?: Record<string, unknown>, cookies?: string[]) {
    if (header) {
        harvestCookieString(
            (header["Set-Cookie"] ?? header["set-cookie"]) as string | string[] | undefined,
        );
    }
    // 微信基础库会把 Set-Cookie 拆到 res.cookies
    if (cookies?.length) {
        harvestCookieString(cookies);
    }
    persistJar();
}

function cookieHeader(): string {
    return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function sessionToken(): string {
    for (const key of SESSION_COOKIE_KEYS) {
        const v = cookieJar.get(key);
        if (v) return v;
    }
    // 兼容只收到带前缀名的情况
    for (const [k, v] of cookieJar.entries()) {
        if (k.includes("session-token") && v) return v;
    }
    return "";
}

export function clearAuthCookies() {
    cookieJar.clear();
    try {
        uni.removeStorageSync(STORAGE_KEY);
    } catch {
        /* ignore */
    }
}

export function request<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", data, header = {}, timeout } = options;
    const jar = cookieHeader();
    const token = sessionToken();
    return new Promise((resolve, reject) => {
        uni.request({
            url: `${BASE_URL}${url}`,
            // PATCH 不在 wx.request 官方类型/文档枚举中，但原生网络层实际支持；
            // 如真机验证不通过，可在后端补一个等价的 POST 别名路由
            method: method as "GET" | "POST" | "PUT" | "DELETE",
            data,
            header: {
                Accept: "application/json",
                ...(jar ? { Cookie: jar } : {}),
                // 微信端 Cookie 头常被丢弃；后端 middleware 会把该头注入为会话 Cookie
                ...(token ? { "X-Session-Token": token } : {}),
                ...header,
            },
            ...(timeout ? { timeout } : {}),
            success: (res) => {
                harvestSetCookies(
                    res.header as Record<string, unknown> | undefined,
                    (res as { cookies?: string[] }).cookies,
                );
                const statusCode = res.statusCode || 0;
                if (statusCode >= 200 && statusCode < 300) {
                    resolve(res.data as T);
                    return;
                }

                const isAuthEndpoint = url.startsWith("/api/auth/");
                if (statusCode === 401 && !isAuthEndpoint) {
                    clearAuthCookies();
                    uni.reLaunch({ url: "/pages/login/login" });
                    reject(new ApiError(statusCode, "UNAUTHORIZED", "登录已失效，请重新登录"));
                    return;
                }

                const body = res.data as any;
                if (statusCode === 401 && isAuthEndpoint) {
                    reject(new ApiError(
                        statusCode,
                        body?.code || "AUTH_FAILED",
                        body?.message || "登录失败：请检查账号密码，或服务器是否已配置 WECHAT_APP_SECRET",
                    ));
                    return;
                }
                reject(new ApiError(statusCode, body?.code, body?.message || `请求失败（${statusCode}）`));
            },
            fail: (err) => {
                const raw = err?.errMsg || "";
                let message: string;
                if (raw.includes("request:fail")) {
                    message =
                        "网络连接失败：请确认服务端已启动，且开发者工具已勾选「详情-本地设置-不校验合法域名」"
                        + "（真机调试需使用局域网 IP 或备案域名）";
                } else if (raw) {
                    message = `网络请求失败（${raw}）`;
                } else {
                    message = "网络请求失败";
                }
                reject(new ApiError(0, "NETWORK_ERROR", message));
            },
        });
    });
}

/** 表单编码请求（NextAuth 回调需要 application/x-www-form-urlencoded） */
export function postForm<T = any>(url: string, form: Record<string, string>): Promise<T> {
    const body = Object.entries(form)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&");
    return request<T>(url, {
        method: "POST",
        header: { "Content-Type": "application/x-www-form-urlencoded" },
        data: body,
    });
}
