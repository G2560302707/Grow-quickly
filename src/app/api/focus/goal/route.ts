import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, badRequest, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";

const logger = createLogger('api:focus:goal');

const MIN_GOAL = 15; // 分钟
const MAX_GOAL = 480;

/** POST /api/focus/goal — 设置专注每日目标（分钟），跨端持久化 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return unauthorized();
    }

    try {
        // @ts-ignore
        const userId = session.user.id;
        const body = await req.json();
        const goalMin = Number(body?.dailyGoalMin);

        if (!Number.isInteger(goalMin) || goalMin < MIN_GOAL || goalMin > MAX_GOAL) {
            return badRequest(`每日目标需在 ${MIN_GOAL}~${MAX_GOAL} 分钟之间`);
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: { focusDailyGoalMin: goalMin },
            select: { focusDailyGoalMin: true },
        });

        return NextResponse.json({ dailyGoalMin: user.focusDailyGoalMin });
    } catch (error) {
        logger.error({ error }, 'Error saving focus daily goal');
        return internalError("Failed to save focus daily goal");
    }
}
