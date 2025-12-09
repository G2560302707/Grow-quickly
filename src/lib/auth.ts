import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import { compare } from "bcryptjs"

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    session: {
        strategy: "jwt",
    },
    // @ts-expect-error trustHost is a valid option in newer NextAuth versions but types might be lagging
    trustHost: true,
    pages: {
        signIn: "/login",
    },
    // Force using a single cookie name to avoid HTTP/HTTPS mismatches in proxy environments
    // This allows running without NEXTAUTH_URL behind Cloudflare Tunnel
    cookies: {
        sessionToken: {
            name: "next-auth.session-token",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                // Only use secure cookies if explicitly running on HTTPS (via NEXTAUTH_URL)
                // This enables HTTP local IP access in Docker/Production if NEXTAUTH_URL is unset
                secure: process.env.NODE_ENV === "production" && process.env.NEXTAUTH_URL?.startsWith("https"),
            },
        },
    },
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                console.log("Authorize called with:", credentials?.email);
                if (!credentials?.email || !credentials?.password) {
                    console.log("Missing credentials");
                    return null
                }

                const user = await prisma.user.findUnique({
                    where: {
                        email: credentials.email
                    }
                })

                if (!user) {
                    console.log("User not found");
                    return null
                }

                // Check if user is active
                if (!user.isActive) {
                    console.log("User is disabled");
                    throw new Error("Account is disabled")
                }

                const isPasswordValid = await compare(credentials.password, user.password)

                if (!isPasswordValid) {
                    console.log("Invalid password");
                    return null
                }

                console.log("Login successful for:", user.email);

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                }
            }
        })
    ],
    // Enable debug messages in the console
    debug: true,
    logger: {
        error(code, metadata) {
            console.error(`[NextAuth][Error] ${code}`, metadata)
        },
        warn(code) {
            console.warn(`[NextAuth][Warn] ${code}`)
        },
        debug(code, metadata) {
            console.log(`[NextAuth][Debug] ${code}`, metadata)
        }
    },
    callbacks: {
        async session({ session, token }) {
            console.log("[NextAuth] Session callback", { userId: token.id });
            return {
                ...session,
                user: {
                    ...session.user,
                    id: token.id,
                    role: token.role,
                }
            }
        },
        async jwt({ token, user, account, profile }) {
            if (user) {
                console.log("[NextAuth] JWT callback - Initial signin", { userId: user.id });
                return {
                    ...token,
                    id: user.id,
                    role: (user as any).role,
                }
            }
            console.log("[NextAuth] JWT callback - Subsequent call");
            return token
        }
    }
}

// Log startup check
console.log("[AuthConfig] Loading...", {
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    HAS_SECRET: !!process.env.NEXTAUTH_SECRET,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST
});
