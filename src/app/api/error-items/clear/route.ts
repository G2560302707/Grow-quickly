import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@/lib/api-errors";

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
        console.error("Error clearing error data:", error);
        return internalError("Failed to clear error data");
    }
}
