import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@grow/shared/prisma"
import { requireAdmin } from "@grow/shared/auth-utils"
import { forbidden, internalError } from "@grow/shared/api-errors"
import { createLogger } from "@grow/shared/logger"

const logger = createLogger('api:admin:users');

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!requireAdmin(session)) {
        return forbidden("Admin access required")
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
        logger.error({ error }, 'Error fetching users');
        return internalError("Failed to fetch users")
    }
}
