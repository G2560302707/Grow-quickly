import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { createLogger } from "@grow/shared/logger";

const logger = createLogger('middleware');
const SESSION_COOKIE = "next-auth.session-token";

/** 小程序端 Cookie 头常被微信丢弃，改用 X-Session-Token；注入为会话 Cookie 供 getServerSession 使用 */
function injectSessionCookie(req: NextRequest): Headers {
    const headers = new Headers(req.headers);
    const headerToken = req.headers.get("x-session-token")?.trim();
    if (headerToken && !req.cookies.get(SESSION_COOKIE)?.value) {
        const existing = headers.get("cookie") || "";
        headers.set(
            "cookie",
            existing ? `${existing}; ${SESSION_COOKIE}=${headerToken}` : `${SESSION_COOKIE}=${headerToken}`,
        );
    }
    return headers;
}

export async function middleware(req: NextRequest) {
    logger.debug({ method: req.method, path: req.nextUrl.pathname }, 'Processing request');

    const headers = injectSessionCookie(req);
    const forward = () => NextResponse.next({ request: { headers } });

    // API：只做会话注入，鉴权仍由各 route 负责
    if (req.nextUrl.pathname.startsWith("/api")) {
        return forward();
    }

    try {
        const headerToken = req.headers.get("x-session-token")?.trim();
        const token = await getToken({
            req: headerToken && !req.cookies.get(SESSION_COOKIE)?.value
                ? ({ headers: { cookie: `${SESSION_COOKIE}=${headerToken}` } } as any)
                : req,
            secret: process.env.NEXTAUTH_SECRET,
            cookieName: SESSION_COOKIE,
        });

        const isAuth = !!token;
        const isAuthPage = req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/register");

        logger.debug({
            path: req.nextUrl.pathname,
            isAuth,
            isAuthPage,
            hasToken: !!token,
            cookies: req.cookies.getAll().map(c => c.name)
        }, 'Auth status');

        if (isAuthPage) {
            if (isAuth) {
                logger.debug('Redirecting authenticated user to /');
                return NextResponse.redirect(new URL("/", req.url));
            }
            return forward();
        }

        if (!isAuth) {
            let from = req.nextUrl.pathname;
            if (req.nextUrl.search) {
                from += req.nextUrl.search;
            }

            logger.debug({ callbackUrl: from }, 'Redirecting unauthenticated user to login');
            return NextResponse.redirect(
                new URL(`/login?callbackUrl=${encodeURIComponent(from)}`, req.url)
            );
        }
        return forward();
    } catch (e) {
        logger.error({ error: e }, 'Error processing token');
        return forward();
    }
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};
