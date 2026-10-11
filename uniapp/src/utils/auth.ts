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
import { request, postForm, clearAuthCookies } from "./request";
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
    const result = await postForm<{ url?: string; error?: string }>("/api/auth/callback/credentials", {
        email,
        password,
        csrfToken: csrf.csrfToken,
        callbackUrl: BASE_URL || "/",
        json: "true",
    });

    // NextAuth 失败时常仍返回 200，并把 error 放在 url 查询串或 body.error
    const errHint = result?.error
        || (typeof result?.url === "string" && /[?&]error=/i.test(result.url)
            ? decodeURIComponent((result.url.match(/[?&]error=([^&]+)/i) || [])[1] || "")
            : "");
    if (errHint) {
        if (/CredentialsSignin|credentials/i.test(errHint)) {
            throw new Error("邮箱或密码错误");
        }
        throw new Error(`登录失败（${errHint}）`);
    }

    const session = await getSession();
    if (!session?.user) {
        throw new Error("登录未建立会话，请重试（若反复失败请检查 Cookie/合法域名配置）");
    }
    return session;
}

/**
 * 微信一键登录（仅微信小程序）：uni.login 取 code，
 * 交给后端 Credentials 授权的 wechatCode 分支换 openid 建会话（secret 不落前端）。
 */
export async function loginWithWeChat(): Promise<Session> {
    const code = await new Promise<string>((resolve, reject) => {
        uni.login({
            provider: "weixin",
            success: (res) => {
                if (res.code) resolve(res.code);
                else reject(new Error("未获取到微信登录凭证"));
            },
            fail: () => reject(new Error("微信登录失败，请确认微信环境可用")),
        });
    });

    const csrf = await request<{ csrfToken: string }>("/api/auth/csrf");
    await postForm("/api/auth/callback/credentials", {
        wechatCode: code,
        csrfToken: csrf.csrfToken,
        callbackUrl: BASE_URL || "/",
        json: "true",
    });

    const session = await getSession();
    if (!session?.user) {
        throw new Error("微信登录失败，请确认服务端已配置 WECHAT_APPID/WECHAT_APP_SECRET");
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
        clearAuthCookies();
        uni.reLaunch({ url: "/pages/login/login" });
    }
}
