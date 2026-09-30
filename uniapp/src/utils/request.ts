/**
 * uni.request 统一封装
 * - 统一 JSON 头、错误码解析（对齐后端 api-errors 的 { message, code } 结构）
 * - 401 自动跳转登录页
 * - 小程序端由运行时自动维护 Cookie（NextAuth 会话依赖此机制）；H5 由浏览器自动维护
 */
import { BASE_URL } from "./config";

export interface RequestOptions {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    data?: any;
    header?: Record<string, string>;
}

export class ApiError extends Error {
    constructor(public statusCode: number, public code: string | undefined, message: string) {
        super(message);
        this.name = "ApiError";
    }
}

export function request<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", data, header = {} } = options;
    return new Promise((resolve, reject) => {
        uni.request({
            url: `${BASE_URL}${url}`,
            // PATCH 不在 wx.request 官方类型/文档枚举中，但原生网络层实际支持；
            // 如真机验证不通过，可在后端补一个等价的 POST 别名路由
            method: method as "GET" | "POST" | "PUT" | "DELETE",
            data,
            header: {
                Accept: "application/json",
                ...header,
            },
            success: (res) => {
                const statusCode = res.statusCode || 0;
                if (statusCode >= 200 && statusCode < 300) {
                    resolve(res.data as T);
                    return;
                }

                if (statusCode === 401) {
                    uni.reLaunch({ url: "/pages/login/login" });
                    reject(new ApiError(statusCode, "UNAUTHORIZED", "登录已失效，请重新登录"));
                    return;
                }

                const body = res.data as any;
                reject(new ApiError(statusCode, body?.code, body?.message || `请求失败（${statusCode}）`));
            },
            fail: (err) => {
                reject(new ApiError(0, "NETWORK_ERROR", err.errMsg || "网络请求失败"));
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
