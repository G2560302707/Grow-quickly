/**
 * uni.request 统一封装
 * - 统一 JSON 头、错误码解析（对齐后端 api-errors 的 { message, code } 结构）
 * - 401 自动跳转登录页
 * - 手动维护 next-auth.* 会话 Cookie（开发者工具/真机对 Set-Cookie 的自动持久化不可靠，
 *   不做这一层 NextAuth 登录后 getSession 拿不到用户）；H5 由浏览器自动维护
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

/**
 * 手动 Cookie 管理（NextAuth 登录态的关键）
 * 微信开发者工具与真机对 wx.request 的 Set-Cookie 自动持久化行为不一致：
 * 实测工具 2.01.x 不会把会话 Cookie 回传到后续请求，导致登录回调 200 但 getSession 拿不到用户。
 * 这里在请求层手动收割/回传 Cookie（只保留 next-auth.* 会话相关字段），后端零改动。
 */
const cookieJar = new Map<string, string>();

function harvestSetCookies(header?: Record<string, unknown>) {
    if (!header) return;
    const raw = (header["Set-Cookie"] ?? header["set-cookie"]) as string | string[] | undefined;
    if (!raw) return;
    const parts = Array.isArray(raw) ? raw : [raw];
    for (const part of parts) {
        // 一个头可能以逗号拼接多条 Cookie；NextAuth 的会话 Cookie 无 Expires 日期，
        // 按「逗号后紧跟 token=」启发式切分，且只收 next-auth.* 白名单，避开日期里的逗号
        for (const seg of part.split(/,(?=[^;(),]+?=)/)) {
            const pair = seg.split(";")[0] ?? "";
            const eq = pair.indexOf("=");
            if (eq <= 0) continue;
            const name = pair.slice(0, eq).trim();
            const value = pair.slice(eq + 1).trim();
            if (!name.startsWith("next-auth.")) continue;
            if (!value || /Expires=Thu, 01 Jan 1970/i.test(seg)) {
                cookieJar.delete(name);
            } else {
                cookieJar.set(name, value);
            }
        }
    }
}

function cookieHeader(): string {
    return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

export function request<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", data, header = {}, timeout } = options;
    const jar = cookieHeader();
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
                ...header,
            },
            ...(timeout ? { timeout } : {}),
            success: (res) => {
                harvestSetCookies(res.header as Record<string, unknown> | undefined);
                const statusCode = res.statusCode || 0;
                if (statusCode >= 200 && statusCode < 300) {
                    resolve(res.data as T);
                    return;
                }

                if (statusCode === 401) {
                    cookieJar.clear();
                    uni.reLaunch({ url: "/pages/login/login" });
                    reject(new ApiError(statusCode, "UNAUTHORIZED", "登录已失效，请重新登录"));
                    return;
                }

                const body = res.data as any;
                reject(new ApiError(statusCode, body?.code, body?.message || `请求失败（${statusCode}）`));
            },
            fail: (err) => {
                const raw = err?.errMsg || "";
                // 原始 errMsg（如 request:fail）对用户无意义，转成可操作的提示
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
