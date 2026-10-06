import { NextResponse } from "next/server";
import { getAIService } from "@grow/shared/ai";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { badRequest, createErrorResponse, ErrorCode } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const logger = createLogger('api:analyze:detect');

/**
 * 整页题目定位：输入整页照片，返回每道题的题号与百分比包围盒。
 * 只做检测不做解答；前端框选某题后裁图走现有 /api/analyze 单题识别。
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        logger.warn('Unauthorized access attempt');
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        let { imageBase64, mimeType } = body;

        if (!imageBase64) {
            return badRequest("Missing image data");
        }

        // 限流：与 /api/analyze 同级的 AI 接口按用户每分钟 10 次
        const aiLimit = rateLimit(`ai:detect:${session.user?.email || "anon"}`, { limit: 10, windowMs: 60 * 1000 });
        if (!aiLimit.allowed) {
            return tooManyRequests(aiLimit.retryAfterSeconds, "AI 请求过于频繁，请稍后再试");
        }

        // Parse Data URL if present
        if (imageBase64.startsWith('data:')) {
            const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                imageBase64 = matches[2];
            }
        }

        // 与 /api/analyze 一致的图片类型白名单 + 大小上限
        const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType)) {
            return NextResponse.json(
                { message: '不支持的图片格式，仅支持 JPEG/PNG/WebP/GIF', code: 'INVALID_INPUT' },
                { status: 400 }
            );
        }
        if (imageBase64.length > 12_000_000) {
            return NextResponse.json(
                { message: '图片过大，请压缩后重试（上限约 9MB）', code: 'INVALID_INPUT' },
                { status: 400 }
            );
        }

        const questions = await getAIService().detectQuestions(imageBase64, mimeType);
        logger.info({ count: questions.length }, 'Question detect successful');

        return NextResponse.json({ questions });
    } catch (error) {
        const errMessage = error instanceof Error ? error.message : String(error);
        const errStack = error instanceof Error ? error.stack : undefined;
        logger.error({
            error: errMessage,
            stack: errStack
        }, 'Question detect error occurred');

        // 与 /api/analyze 相同的错误类型透传策略，前端按已有映射展示
        let errorMessage = errMessage || "Failed to detect questions";
        if (errorMessage && (
            errorMessage === 'AI_CONNECTION_FAILED' ||
            errorMessage === 'AI_RESPONSE_ERROR' ||
            errorMessage.includes('AI_AUTH_ERROR') ||
            errorMessage === 'AI_TIMEOUT_ERROR' ||
            errorMessage === 'AI_QUOTA_EXCEEDED' ||
            errorMessage === 'AI_PERMISSION_DENIED' ||
            errorMessage === 'AI_NOT_FOUND' ||
            errorMessage === 'AI_SERVICE_UNAVAILABLE' ||
            errorMessage === 'AI_UNKNOWN_ERROR'
        )) {
            if (errorMessage.includes('AI_AUTH_ERROR')) {
                errorMessage = 'AI_AUTH_ERROR';
            }
        } else if (errorMessage.includes('Zod') || errorMessage.includes('validate')) {
            errorMessage = 'AI_RESPONSE_ERROR';
        }

        return createErrorResponse(errorMessage, 500, ErrorCode.AI_ERROR);
    }
}
