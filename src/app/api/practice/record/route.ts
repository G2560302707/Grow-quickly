import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@/lib/api-errors";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return unauthorized();
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
        return internalError("Failed to save record");
    }
}
