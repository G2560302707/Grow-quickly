import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const { subject, difficulty, isCorrect } = await req.json();

        // @ts-ignore
        const userId = session.user.id;

        const record = await prisma.practiceRecord.create({
            data: {
                userId,
                subject,
                difficulty,
                isCorrect,
            },
        });

        return NextResponse.json(record);
    } catch (error) {
        console.error("Error saving practice record:", error);
        return NextResponse.json(
            { message: "Failed to save record" },
            { status: 500 }
        );
    }
}
