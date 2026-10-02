import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireAdmin } from "@/lib/auth-utils";
import { unauthorized, forbidden, badRequest, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:feedback');

const ALLOWED_TYPES = ["feature", "bug", "other"];

/**
 * POST /api/feedback
 * 提交用户反馈（移动端"帮助与反馈"页使用）
 * body: { type?: "feature" | "bug" | "other", content: string, contact?: string }
 */
export async function POST(req: Request) {
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

        const body = await req.json().catch(() => null);
        const rawType = typeof body?.type === "string" ? body.type : "other";
        const content = typeof body?.content === "string" ? body.content.trim() : "";
        const contact = typeof body?.contact === "string" ? body.contact.trim().slice(0, 100) : "";

        if (content.length < 5) {
            return badRequest("反馈内容至少 5 个字");
        }
        if (content.length > 500) {
            return badRequest("反馈内容不能超过 500 字");
        }

        const feedback = await prisma.feedback.create({
            data: {
                userId: user.id,
                type: ALLOWED_TYPES.includes(rawType) ? rawType : "other",
                content,
                contact: contact || null,
            },
        });

        return NextResponse.json({ success: true, id: feedback.id }, { status: 201 });
    } catch (error) {
        logger.error({ error }, 'Error submitting feedback');
        return internalError("Failed to submit feedback");
    }
}

/**
 * PATCH /api/feedback
 * 管理员更新反馈状态：{ id: string, status: "open" | "resolved" }
 */
export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions);

    if (!requireAdmin(session)) {
        return forbidden("Admin access required");
    }

    try {
        const body = await req.json().catch(() => null);
        const id = typeof body?.id === "string" ? body.id : "";
        const status = body?.status;

        if (!id || (status !== "open" && status !== "resolved")) {
            return badRequest("参数不合法");
        }

        const existing = await prisma.feedback.findUnique({ where: { id }, select: { id: true } });
        if (!existing) {
            return badRequest("反馈不存在");
        }

        const feedback = await prisma.feedback.update({
            where: { id },
            data: { status },
        });

        return NextResponse.json(feedback);
    } catch (error) {
        logger.error({ error }, 'Error updating feedback');
        return internalError("Failed to update feedback");
    }
}

/**
 * GET /api/feedback?page=1&pageSize=20
 * 管理员查看反馈列表（设置弹窗"反馈管理"与 API 使用）
 */
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    if (!requireAdmin(session)) {
        return forbidden("Admin access required");
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

    try {
        const [total, items] = await Promise.all([
            prisma.feedback.count(),
            prisma.feedback.findMany({
                orderBy: { createdAt: "desc" },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);

        return NextResponse.json({
            items,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        });
    } catch (error) {
        logger.error({ error }, 'Error fetching feedback');
        return internalError("Failed to fetch feedback");
    }
}
