import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-utils"
import { forbidden, badRequest, internalError } from "@/lib/api-errors"
import { createLogger } from "@/lib/logger"

const logger = createLogger('api:admin:users:id');

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await getServerSession(authOptions)

    if (!requireAdmin(session)) {
        return forbidden("Admin access required")
    }

    try {
        const body = await req.json()
        const { isActive } = body

        // Prevent disabling self
        if (id === session?.user.id) {
            return badRequest("Cannot disable your own account")
        }

        // Prevent disabling super admin
        const targetUser = await prisma.user.findUnique({
            where: { id }
        })

        if (targetUser?.email === 'admin@localhost') {
            return badRequest("Cannot disable super admin")
        }

        const user = await prisma.user.update({
            where: {
                id
            },
            data: {
                isActive
            }
        })

        return NextResponse.json(user)
    } catch (error) {
        logger.error({ error }, 'Error updating user');
        return internalError("Failed to update user")
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await getServerSession(authOptions)

    if (!requireAdmin(session)) {
        return forbidden("Admin access required")
    }

    try {
        // Prevent deleting self
        if (id === session?.user.id) {
            return badRequest("Cannot delete your own account")
        }

        // Prevent deleting super admin
        const targetUser = await prisma.user.findUnique({
            where: { id }
        })

        if (targetUser?.role === 'admin') {
            if (targetUser.email === 'admin@localhost') {
                return badRequest("Cannot delete super admin")
            }
        }

        const user = await prisma.user.delete({
            where: {
                id
            }
        })

        return NextResponse.json(user)
    } catch (error) {
        logger.error({ error }, 'Error deleting user');
        return internalError("Failed to delete user")
    }
}
