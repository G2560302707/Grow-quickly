import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";

const logger = createLogger('api:announcements');

/**
 * GET /api/announcements
 * 学习端用户视角：启用中的公告 + 本人已读状态（铃铛与小程序首页使用）。
 * 公告的发布/编辑/下架在管理端 /api/announcements（admin 应用）。
 */
export async function GET() {
    const session = await getServerSession(authOptions);

    try {
        let user;
        if (session?.user?.email) {
            user = await prisma.user.findUnique({
                where: { email: session.user.email },
            });
        }

        if (!user) {
            return unauthorized("Authentication required");
        }

        const announcements = await prisma.announcement.findMany({
            where: { isActive: true },
            orderBy: { createdAt: "desc" },
            take: 50,
            include: {
                reads: {
                    where: { userId: user.id },
                    select: { readAt: true },
                },
            },
        });

        return NextResponse.json({
            announcements: announcements.map(a => ({
                id: a.id,
                title: a.title,
                content: a.content,
                createdAt: a.createdAt,
                read: a.reads.length > 0,
            })),
        });
    } catch (error) {
        logger.error({ error }, 'Error fetching announcements');
        return internalError("Failed to fetch announcements");
    }
}
