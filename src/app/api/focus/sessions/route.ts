import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, badRequest, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:focus:sessions');

const MODES = ["pomodoro", "mock", "custom"] as const;
const MAX_SECONDS = 4 * 60 * 60; // 单次上报上限 4 小时

/** POST /api/focus/sessions — 上报一次专注会话（番茄钟/模考掐表结束或放弃时） */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return unauthorized();
    }

    try {
        // @ts-ignore
        const userId = session.user.id;
        const body = await req.json();
        const mode = String(body?.mode || "");
        const moduleName = typeof body?.moduleName === "string" && body.moduleName.trim() ? body.moduleName.trim().slice(0, 20) : null;
        const targetSeconds = Number(body?.targetSeconds);
        const durationSeconds = Number(body?.durationSeconds);
        const completed = Boolean(body?.completed);

        if (!MODES.includes(mode as typeof MODES[number])) {
            return badRequest("无效的专注模式");
        }
        if (!Number.isFinite(targetSeconds) || targetSeconds < 60 || targetSeconds > MAX_SECONDS) {
            return badRequest("计划时长超出范围");
        }
        if (!Number.isFinite(durationSeconds) || durationSeconds < 0 || durationSeconds > MAX_SECONDS) {
            return badRequest("专注时长超出范围");
        }
        // 专注不足 60 秒视为误触，不入库
        if (durationSeconds < 60) {
            return NextResponse.json({ skipped: true });
        }

        const record = await prisma.focusSession.create({
            data: {
                userId,
                mode,
                moduleName,
                targetSeconds: Math.round(targetSeconds),
                durationSeconds: Math.round(durationSeconds),
                completed,
            },
        });

        return NextResponse.json(record);
    } catch (error) {
        logger.error({ error }, 'Error saving focus session');
        return internalError("Failed to save focus session");
    }
}

/** GET /api/focus/sessions — 最近会话（调试与后续周报使用） */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return unauthorized();
    }

    try {
        // @ts-ignore
        const userId = session.user.id;
        const sessions = await prisma.focusSession.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 20,
        });
        return NextResponse.json(sessions);
    } catch (error) {
        logger.error({ error }, 'Error fetching focus sessions');
        return internalError("Failed to fetch focus sessions");
    }
}
