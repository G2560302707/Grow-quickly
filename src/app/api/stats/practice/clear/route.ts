import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
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
        console.error("Error clearing practice stats:", error);
        return NextResponse.json(
            { message: "Failed to clear stats" },
            { status: 500 }
        );
    }
}
