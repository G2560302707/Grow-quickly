import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireAdmin } from "@grow/shared/auth-utils";
import { unauthorized, forbidden, badRequest, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";

const logger = createLogger('api:announcements');

/**
 * GET /api/announcements[?all=true]
 * 普通用户：启用中的公告 + 本人已读状态（铃铛与小程序首页使用）
 * 管理员（all=true）：全部公告（含已下架）+ 阅读数
 */
export async function GET(req: Request) {
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

        const { searchParams } = new URL(req.url);
        const wantAll = searchParams.get("all") === "true";
        const isAdmin = requireAdmin(session);

        if (wantAll) {
            if (!isAdmin) {
                return forbidden("Admin access required");
            }
            const announcements = await prisma.announcement.findMany({
                orderBy: { createdAt: "desc" },
                include: { _count: { select: { reads: true } } },
                take: 100,
            });
            return NextResponse.json({
                announcements: announcements.map(a => ({
                    id: a.id,
                    title: a.title,
                    content: a.content,
                    isActive: a.isActive,
                    createdAt: a.createdAt,
                    readCount: a._count.reads,
                })),
            });
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

/**
 * POST /api/announcements
 * 管理员发布公告：{ title: string, content: string }
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!requireAdmin(session)) {
        return forbidden("Admin access required");
    }

    try {
        const body = await req.json().catch(() => null);
        const title = typeof body?.title === "string" ? body.title.trim() : "";
        const content = typeof body?.content === "string" ? body.content.trim() : "";

        if (!title || !content) {
            return badRequest("标题和内容不能为空");
        }
        if (title.length > 100 || content.length > 2000) {
            return badRequest("标题不能超过 100 字，内容不能超过 2000 字");
        }

        const announcement = await prisma.announcement.create({
            data: { title, content },
        });

        return NextResponse.json({ success: true, id: announcement.id }, { status: 201 });
    } catch (error) {
        logger.error({ error }, 'Error creating announcement');
        return internalError("Failed to create announcement");
    }
}
