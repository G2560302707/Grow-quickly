import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        // 1. Total Errors
        const totalErrors = await prisma.errorItem.count({
            where: { userId: user.id },
        });

        // 2. Mastered Count
        const masteredCount = await prisma.errorItem.count({
            where: { userId: user.id, masteryLevel: { gt: 0 } },
        });

        // 3. Activity (Last 6 months)
        const activityData = [];
        for (let i = 5; i >= 0; i--) {
            const date = subMonths(new Date(), i);
            const start = startOfMonth(date);
            const end = endOfMonth(date);

            const count = await prisma.errorItem.count({
                where: {
                    userId: user.id,
                    createdAt: {
                        gte: start,
                        lte: end,
                    },
                },
            });

            activityData.push({
                date: format(date, "yyyy/MM"),
                count,
            });
        }

        return NextResponse.json({
            totalErrors,
            masteredCount,
            masteryRate: totalErrors > 0 ? Math.round((masteredCount / totalErrors) * 100) : 0,
            activityData,
        });
    } catch (error) {
        console.error("Error fetching analytics:", error);
        return NextResponse.json(
            { message: "Failed to fetch analytics" },
            { status: 500 }
        );
    }
}
