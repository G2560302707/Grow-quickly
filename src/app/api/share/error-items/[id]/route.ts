/**
 * 公开只读分享接口（无 session）
 *
 * 用途：小程序「分享给朋友 / 分享到朋友圈」的落地页取数。
 * 朋友圈单页模式（scene 1154）无登录态、wx.login 不可用，只能靠签名令牌鉴权。
 *
 * 安全边界：
 * - 必须携带与 id 绑定的 HMAC 令牌（见 src/lib/share-token.ts），默认 7 天过期
 * - 只返回白名单字段，绝不返回 userNotes / mistakeAnalysis / masteryLevel /
 *   subjectId / 用户标识等私有数据
 */
import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { forbidden, notFound, internalError, badRequest } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";
import { verifyShareToken } from "@/lib/share-token";

const logger = createLogger("api:share:error-items");

// 分享内容随错题编辑实时变化，不做静态化
export const dynamic = "force-dynamic";

export interface SharedErrorItemPayload {
    id: string;
    questionText: string | null;
    answerText: string | null;
    analysis: string | null;
    wrongAnswerText: string | null;
    imageUrl: string | null;
    subjectName: string | null;
    tagNames: string[];
    createdAt: string | null;
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    if (!id) return badRequest("缺少分享内容标识");

    const token = new URL(req.url).searchParams.get("t");
    const check = verifyShareToken(id, token);
    if (!check.ok) {
        // 统一文案，不区分「过期 / 伪造」，避免探测
        return forbidden("分享链接已失效，请让对方重新分享");
    }

    try {
        const item = await prisma.errorItem.findUnique({
            where: { id },
            select: {
                id: true,
                questionText: true,
                answerText: true,
                analysis: true,
                wrongAnswerText: true,
                originalImageUrl: true,
                createdAt: true,
                subject: { select: { name: true } },
                tags: { select: { name: true } },
            },
        });

        if (!item) return notFound("分享的内容不存在或已被删除");

        const payload: SharedErrorItemPayload = {
            id: item.id,
            questionText: item.questionText,
            answerText: item.answerText,
            analysis: item.analysis,
            wrongAnswerText: item.wrongAnswerText,
            // 图片以 data URL 存库；无题目文字时文本展示为空，需靠图片兜底
            imageUrl: item.originalImageUrl || null,
            subjectName: item.subject?.name ?? null,
            tagNames: item.tags.map((t) => t.name),
            createdAt: item.createdAt ? item.createdAt.toISOString() : null,
        };

        return NextResponse.json(payload, {
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        logger.error({ error, id }, "Error fetching shared item");
        return internalError("分享内容加载失败，请稍后重试");
    }
}
