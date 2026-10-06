import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@grow/shared/prisma"
import { compare } from "bcryptjs"
import { createLogger } from "@grow/shared/logger"

const logger = createLogger('admin:auth');

/**
 * 管理端独立 NextAuth：
 * - 复用学习端 User 表的 role 字段，但只有 admin 角色能登录成功
 * - cookie 名与学习端（next-auth.session-token）不同，两端口令互不干扰
 */
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
    cookies: {
        sessionToken: {
            name: "admin-auth.session-token",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
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
                if (!credentials?.email || !credentials?.password) {
                    return null
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email }
                })

                if (!user) {
                    logger.warn({ email: credentials.email }, 'Admin login failed: user not found');
                    return null
                }

                if (!user.isActive) {
                    logger.warn({ email: user.email }, 'Admin login failed: user disabled');
                    return null
                }

                const isPasswordValid = await compare(credentials.password, user.password)
                if (!isPasswordValid) {
                    logger.warn({ email: user.email }, 'Admin login failed: invalid password');
                    return null
                }

                // 关键差异：非 admin 一律拒绝，普通用户无法在管理端取得会话
                if (user.role !== "admin") {
                    logger.warn({ email: user.email }, 'Admin login rejected: not an admin');
                    return null
                }

                logger.info({ email: user.email }, 'Admin login successful');
                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                }
            }
        })
    ],
    logger: {
        error(code, metadata) {
            logger.error({ code, metadata }, 'Admin NextAuth error');
        },
        warn(code) {
            logger.warn({ code }, 'Admin NextAuth warning');
        },
    },
    callbacks: {
        async session({ session, token }) {
            return {
                ...session,
                user: {
                    ...session.user,
                    id: token.id,
                    role: token.role,
                }
            }
        },
        async jwt({ token, user }) {
            if (user) {
                return {
                    ...token,
                    id: user.id,
                    role: (user as any).role,
                }
            }
            // 会话期间角色被撤销则立即失效
            if (token.id) {
                try {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        select: { role: true, isActive: true },
                    })
                    if (!dbUser || dbUser.role !== "admin" || !dbUser.isActive) {
                        return { ...token, role: "user" }
                    }
                    token.role = dbUser.role
                } catch (e) {
                    logger.warn({ error: e }, 'Admin JWT callback - failed to refresh role');
                }
            }
            return token
        }
    }
}
