import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-utils"

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await getServerSession(authOptions)

    if (!requireAdmin(session)) {
        return new NextResponse("Unauthorized", { status: 403 })
    }

    try {
        const body = await req.json()
        const { isActive } = body

        // Prevent disabling self
        if (id === session?.user.id) {
            return new NextResponse("Cannot disable your own account", { status: 400 })
        }

        // Prevent disabling super admin
        const targetUser = await prisma.user.findUnique({
            where: { id }
        })

        if (targetUser?.email === 'admin@localhost') {
            return new NextResponse("Cannot disable super admin", { status: 400 })
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
        console.error("[ADMIN_USERS_PATCH]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await getServerSession(authOptions)

    if (!requireAdmin(session)) {
        return new NextResponse("Unauthorized", { status: 403 })
    }

    try {
        // Prevent deleting self
        if (id === session?.user.id) {
            return new NextResponse("Cannot delete your own account", { status: 400 })
        }

        // Prevent deleting other admins (optional, but good practice)
        const targetUser = await prisma.user.findUnique({
            where: { id }
        })

        if (targetUser?.role === 'admin') {
            // For now, let's allow deleting other admins if needed, or maybe block it.
            // The plan said "admin@localhost cannot be deleted", but that's specific.
            // Let's just block deleting the specific admin@localhost if we can identify it, or just rely on "Cannot delete self" if logged in as it.
            // But if I am another admin, I might want to delete an admin.
            // Let's stick to "Cannot delete self".
            if (targetUser.email === 'admin@localhost') {
                return new NextResponse("Cannot delete super admin", { status: 400 })
            }
        }

        const user = await prisma.user.delete({
            where: {
                id
            }
        })

        return NextResponse.json(user)
    } catch (error) {
        console.error("[ADMIN_USERS_DELETE]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
