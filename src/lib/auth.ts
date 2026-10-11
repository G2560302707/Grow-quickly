import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@grow/shared/prisma"
import { compare } from "bcryptjs"
import { createLogger } from "@grow/shared/logger"
import { fetchWechatSession, findOrCreateWechatUser } from "@/lib/wechat-auth"

const logger = createLogger('auth');

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
                password: { label: "Password", type: "password" },
                wechatCode: { label: "WeChat Code", type: "text" }
            },
            async authorize(credentials) {
                // 微信小程序登录：uni.login 的 code 换 openid，按 openid 找/建用户后走同一会话链路
                if (credentials?.wechatCode) {
                    const appid = process.env.WECHAT_APPID
                    const secret = process.env.WECHAT_APP_SECRET
                    if (!appid || !secret) {
                        logger.warn('WeChat login attempted but WECHAT_APPID/WECHAT_APP_SECRET not configured');
                        return null
                    }
                    let wechatUser
                    try {
                        const { openid } = await fetchWechatSession(credentials.wechatCode, appid, secret)
                        wechatUser = await findOrCreateWechatUser(openid)
                    } catch (error) {
                        logger.warn({ error }, 'WeChat login failed');
                        return null
                    }
                    if (!wechatUser.isActive) {
                        logger.warn({ userId: wechatUser.id }, 'WeChat user is disabled');
                        throw new Error("Account is disabled")
                    }
                    logger.info({ userId: wechatUser.id }, 'WeChat login successful');
                    return {
                        id: wechatUser.id,
                        email: wechatUser.email,
                        name: wechatUser.name,
                        role: wechatUser.role,
                    }
                }

                logger.debug({ email: credentials?.email }, 'Authorize called');
                if (!credentials?.email || !credentials?.password) {
                    logger.debug('Missing credentials');
                    return null
                }

                const user = await prisma.user.findUnique({
                    where: {
                        email: credentials.email
                    }
                })

                if (!user) {
                    logger.debug('User not found');
                    return null
                }

                // Check if user is active
                if (!user.isActive) {
                    logger.warn('User is disabled');
                    throw new Error("Account is disabled")
                }

                const isPasswordValid = await compare(credentials.password, user.password)

                if (!isPasswordValid) {
                    logger.debug('Invalid password');
                    return null
                }

                logger.info({ email: user.email }, 'Login successful');

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
            logger.error({ code, metadata }, 'NextAuth error');
        },
        warn(code) {
            logger.warn({ code }, 'NextAuth warning');
        },
        debug(code, metadata) {
            logger.debug({ code, metadata }, 'NextAuth debug');
        }
    },
    callbacks: {
        async session({ session, token }) {
            logger.debug({ userId: token.id }, 'Session callback');
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
                logger.debug({ userId: user.id }, 'JWT callback - Initial signin');
                return {
                    ...token,
                    id: user.id,
                    role: (user as any).role,
                }
            }
            // 后续调用回库刷新 name/role：用户在设置里改资料后，
            // 无需重新登录即可在全站生效（否则 JWT 固化登录时的旧名字）
            if (token.id) {
                try {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        select: { name: true, role: true },
                    })
                    if (dbUser) {
                        token.name = dbUser.name
                        token.role = dbUser.role
                    }
                } catch (e) {
                    logger.warn({ error: e }, 'JWT callback - failed to refresh user profile');
                }
            }
            logger.debug('JWT callback - Subsequent call');
            return token
        }
    }
}

// Log startup check
logger.info({
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    HAS_SECRET: !!process.env.NEXTAUTH_SECRET,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST
}, 'AuthConfig loading');
