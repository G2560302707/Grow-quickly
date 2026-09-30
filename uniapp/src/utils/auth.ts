/**
 * 认证：复用后端 NextAuth 凭据登录（后端零改动）
 *
 * 流程：
 *  1. GET /api/auth/csrf 取 csrfToken（同时种下 csrf Cookie）
 *  2. POST /api/auth/callback/credentials（表单编码，json=true）→ 服务端种下会话 Cookie
 *  3. GET /api/auth/session 校验会话
 *
 * Cookie 维护：H5 由浏览器自动处理；微信小程序运行时会自动保存并回传同域名 Cookie。
 * 注意：uni.request 在 H5 下设置自定义 Content-Type 时 data 为字符串原样发送。
 */
import { request, postForm } from "./request";
import { BASE_URL } from "./config";

export interface SessionUser {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string;
}

export interface Session {
    user?: SessionUser;
    expires?: string;
}

export async function getSession(): Promise<Session | null> {
    try {
        const session = await request<Session>("/api/auth/session");
        return session?.user ? session : null;
    } catch {
        return null;
    }
}

export async function login(email: string, password: string): Promise<Session> {
    const csrf = await request<{ csrfToken: string }>("/api/auth/csrf");

    // json=true 让 NextAuth 返回 JSON 而非 302 跳转
    await postForm("/api/auth/callback/credentials", {
        email,
        password,
        csrfToken: csrf.csrfToken,
        callbackUrl: BASE_URL || "/",
        json: "true",
    });

    const session = await getSession();
    if (!session?.user) {
        throw new Error("邮箱或密码错误");
    }
    return session;
}

export async function logout(): Promise<void> {
    try {
        const csrf = await request<{ csrfToken: string }>("/api/auth/csrf");
        await postForm("/api/auth/signout", {
            csrfToken: csrf.csrfToken,
            callbackUrl: BASE_URL || "/",
            json: "true",
        });
    } finally {
        uni.reLaunch({ url: "/pages/login/login" });
    }
}
