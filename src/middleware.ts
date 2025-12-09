import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
    // Debug logging for middleware
    console.log(`[Middleware] Processing: ${req.method} ${req.nextUrl.pathname}`);

    try {
        const token = await getToken({
            req,
            secret: process.env.NEXTAUTH_SECRET,
            cookieName: "next-auth.session-token", // Explicitly look for the standardized cookie
        });

        const isAuth = !!token;
        const isAuthPage = req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/register");

        console.log(`[Middleware] Auth Status: ${isAuth ? 'Authenticated' : 'Unauthenticated'}`, {
            path: req.nextUrl.pathname,
            isAuthPage,
            hasToken: !!token,
            cookies: req.cookies.getAll().map(c => c.name) // Log cookie names only for safety
        });

        if (isAuthPage) {
            if (isAuth) {
                console.log("[Middleware] Redirecting authenticated user to /");
                return NextResponse.redirect(new URL("/", req.url));
            }
            return null;
        }

        if (!isAuth) {
            let from = req.nextUrl.pathname;
            if (req.nextUrl.search) {
                from += req.nextUrl.search;
            }

            console.log(`[Middleware] Redirecting unauthenticated user to /login?callbackUrl=${from}`);
            return NextResponse.redirect(
                new URL(`/login?callbackUrl=${encodeURIComponent(from)}`, req.url)
            );
        }
    } catch (e) {
        console.error("[Middleware] Error processing token:", e);
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
