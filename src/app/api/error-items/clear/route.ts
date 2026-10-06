import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";

const logger = createLogger('api:error-items:clear');

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return unauthorized();
    }

    // @ts-ignore
    const userId = session.user.id;

    try {
        // Delete all error items for this user
        await prisma.errorItem.deleteMany({
            where: { userId }
        });

        return NextResponse.json({ message: "Error data cleared successfully" });
    } catch (error) {
        logger.error({ error }, 'Error clearing error data');
        return internalError("Failed to clear error data");
    }
}
