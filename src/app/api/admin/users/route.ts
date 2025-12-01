import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-utils"

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!requireAdmin(session)) {
        return new NextResponse("Unauthorized", { status: 403 })
    }

    try {
        const users = await prisma.user.findMany({
            orderBy: {
                createdAt: 'desc'
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
                _count: {
                    select: {
                        errorItems: true,
                        practiceRecords: true
                    }
                }
            }
        })

        return NextResponse.json(users)
    } catch (error) {
        console.error("[ADMIN_USERS_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
