import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:stats:practice:clear');

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return unauthorized();
    }

    // @ts-ignore
    const userId = session.user.id;

    try {
        const result = await prisma.practiceRecord.deleteMany({
            where: { userId },
        });

        return NextResponse.json({
            message: "Practice history cleared successfully",
            count: result.count
        });
    } catch (error) {
        logger.error({ error }, 'Error clearing practice stats');
        return internalError("Failed to clear stats");
    }
}
