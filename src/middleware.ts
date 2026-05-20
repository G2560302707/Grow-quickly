import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger('middleware');

export async function middleware(req: NextRequest) {
    // Debug logging for middleware
    logger.debug({ method: req.method, path: req.nextUrl.pathname }, 'Processing request');

    try {
        const token = await getToken({
            req,
            secret: process.env.NEXTAUTH_SECRET,
            cookieName: "next-auth.session-token", // Explicitly look for the standardized cookie
        });

        const isAuth = !!token;
        const isAuthPage = req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/register");
        const isAdminPage = req.nextUrl.pathname.startsWith("/admin");

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
            return null;
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

        // Admin route protection: only allow users with admin role
        if (isAdminPage && token?.role !== "admin") {
            logger.warn({ userId: token?.id, path: req.nextUrl.pathname }, 'Non-admin user attempting to access admin area');
            return NextResponse.redirect(new URL("/", req.url));
        }
    } catch (e) {
        logger.error({ error: e }, 'Error processing token');
        return NextResponse.next();
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
    ],
};
