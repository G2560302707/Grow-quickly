import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, notFound, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";

const logger = createLogger('api:error-items:notes');

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    try {
        let user;
        if (session?.user?.email) {
            user = await prisma.user.findUnique({
                where: { email: session.user.email },
            });
        }

        if (!user) {
            return unauthorized("Authentication required");
        }

        const { userNotes } = await req.json();

        // 属主校验：只能修改自己的错题笔记
        const existingItem = await prisma.errorItem.findFirst({
            where: {
                id: id,
                userId: user.id,
            },
        });

        if (!existingItem) {
            return notFound("Item not found");
        }

        const errorItem = await prisma.errorItem.update({
            where: {
                id: existingItem.id,
            },
            data: {
                userNotes: userNotes,
            },
        });

        return NextResponse.json(errorItem);
    } catch (error) {
        logger.error({ error }, 'Error updating notes');
        return internalError("Failed to update notes");
    }
}
