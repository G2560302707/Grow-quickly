import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

/**
 * 管理端页面保护：全部页面要求 admin 会话。
 * API 路由在各自 handler 内用 getServerSession + requireAdmin 二次校验。
 */
export async function middleware(req: NextRequest) {
    const token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
        cookieName: "admin-auth.session-token",
    });

    const isAuth = !!token;
    const isAdmin = token?.role === "admin";
    const isLoginPage = req.nextUrl.pathname.startsWith("/login");

    if (isLoginPage) {
        if (isAuth && isAdmin) {
            return NextResponse.redirect(new URL("/", req.url));
        }
        return null;
    }

    if (!isAuth || !isAdmin) {
        const from = req.nextUrl.pathname + (req.nextUrl.search || "");
        return NextResponse.redirect(
            new URL(`/login?callbackUrl=${encodeURIComponent(from)}`, req.url)
        );
    }

    return null;
}

export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
    ],
};
