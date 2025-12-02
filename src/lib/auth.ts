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
            return token
        }
    }
}
