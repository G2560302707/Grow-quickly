import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";

const logger = createLogger('api:focus:stats');

/**
 * GET /api/focus/stats — 专注统计
 * todaySeconds 今日专注 / weekSeconds 近 7 天 / streakDays 连续打卡天数 /
 * last7Days 每日秒数(含今日) / totalSessions / totalSeconds 累计 /
 * dailyGoalMin 每日目标(分钟,跨端持久化) /
 * byMode 分模式洞察(wave-2)：各模式累计秒数/次数/完成次数
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return unauthorized();
    }

    try {
        // @ts-ignore
        const userId = session.user.id;

        // 会话量级有限（个人每天几次），直接取全量在内存聚合，避免多时区 groupBy 复杂度
        const [sessions, user] = await Promise.all([
            prisma.focusSession.findMany({
                where: { userId },
                select: { durationSeconds: true, createdAt: true, completed: true, mode: true },
            }),
            prisma.user.findUnique({
                where: { id: userId },
                select: { focusDailyGoalMin: true },
            }),
        ]);

        const dayKey = (d: Date) => {
            const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            return Math.floor(t.getTime() / 86_400_000);
        };

        const today = dayKey(new Date());
        const perDay = new Map<number, number>();
        let totalSeconds = 0;
        let totalSessions = 0;
        const byMode: Record<string, { seconds: number; sessions: number; completed: number }> = {};

        for (const s of sessions) {
            const k = dayKey(s.createdAt);
            const dur = s.durationSeconds || 0;
            perDay.set(k, (perDay.get(k) || 0) + dur);
            totalSeconds += dur;
            totalSessions += 1;
            const bucket = (byMode[s.mode] ||= { seconds: 0, sessions: 0, completed: 0 });
            bucket.seconds += dur;
            bucket.sessions += 1;
            if (s.completed) bucket.completed += 1;
        }

        const todaySeconds = perDay.get(today) || 0;

        // 近 7 天（含今日，旧 → 新）
        const last7Days: { date: string; seconds: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const k = today - i;
            const d = new Date(k * 86_400_000);
            last7Days.push({
                date: `${d.getMonth() + 1}/${d.getDate()}`,
                seconds: perDay.get(k) || 0,
            });
        }
        const weekSeconds = last7Days.reduce((sum, d) => sum + d.seconds, 0);

        // 连续打卡：从今天往回数有专注记录的天数；今天还没有则从昨天起算
        let streakDays = 0;
        let cursor = perDay.has(today) ? today : today - 1;
        while (perDay.has(cursor)) {
            streakDays += 1;
            cursor -= 1;
        }

        return NextResponse.json({
            todaySeconds,
            weekSeconds,
            streakDays,
            totalSessions,
            totalSeconds,
            last7Days,
            dailyGoalMin: user?.focusDailyGoalMin ?? 120,
            byMode,
        });
    } catch (error) {
        logger.error({ error }, 'Error fetching focus stats');
        return internalError("Failed to fetch focus stats");
    }
}
