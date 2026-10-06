import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, badRequest, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";
import { sendFeedbackNotification } from "@grow/shared/mailer";

const logger = createLogger('api:feedback');

const ALLOWED_TYPES = ["feature", "bug", "other"];

/**
 * POST /api/feedback
 * 学习端用户提交反馈（网页 + uniapp"帮助与反馈"页使用）。
 * 反馈的查看与处理在管理端 /api/feedback（admin 应用）。
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

        // 邮件通知管理员（fire-and-forget）：配置了 SMTP 才发，失败只记日志不阻塞反馈
        void sendFeedbackNotification({
            type: feedback.type,
            content: feedback.content,
            contact: feedback.contact,
            userName: user.name,
            userEmail: user.email,
            createdAt: feedback.createdAt.toISOString(),
        });

        return NextResponse.json({ success: true, id: feedback.id }, { status: 201 });
    } catch (error) {
        logger.error({ error }, 'Error submitting feedback');
        return internalError("Failed to submit feedback");
    }
}
