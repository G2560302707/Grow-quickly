import { NextResponse } from "next/server";
import { getAIService } from "@grow/shared/ai";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { badRequest, createErrorResponse, ErrorCode } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const logger = createLogger('api:reanswer');

export async function POST(req: Request) {
    logger.info('Reanswer API called');

    const session = await getServerSession(authOptions);

    // 认证检查
    if (!session) {
        logger.warn('Unauthorized access attempt');
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // 限流：AI 接口按用户每分钟 10 次，防滥用与成本失控
    const aiLimit = rateLimit(`ai:reanswer:${session.user?.email || "anon"}`, { limit: 10, windowMs: 60 * 1000 });
    if (!aiLimit.allowed) {
        return tooManyRequests(aiLimit.retryAfterSeconds, "AI 请求过于频繁，请稍后再试");
    }


    try {
        const body = await req.json();
        const { questionText, language = 'zh', subject, imageBase64, gradeSemester } = body;

        logger.debug({
            questionLength: questionText?.length,
            language,
            subject,
            hasImage: !!imageBase64,
            gradeSemester
        }, 'Reanswer request received');

        if (!questionText || questionText.trim().length === 0) {
            logger.warn('Missing question text');
            return badRequest("Missing question text");
        }

        const aiService = getAIService();

        // 根据是否有图片选择不同的重新解题方式
        const result = await aiService.reanswerQuestion(questionText, language, subject, imageBase64, gradeSemester);

        logger.info('Reanswer successful');

        return NextResponse.json(result);
    } catch (error: unknown) {
        const errorMessageFromError = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        logger.error({ error: errorMessageFromError, stack }, 'Reanswer error occurred');

        // 默认通用消息，仅透传约定的 AI_* 错误码，避免泄漏上游服务细节
        let errorMessage = "Failed to reanswer question";

        if (errorMessageFromError.includes('AI_AUTH_ERROR')) {
            errorMessage = 'AI_AUTH_ERROR';
        } else if (errorMessageFromError === 'AI_CONNECTION_FAILED') {
            errorMessage = 'AI_CONNECTION_FAILED';
        } else if (errorMessageFromError === 'AI_RESPONSE_ERROR') {
            errorMessage = 'AI_RESPONSE_ERROR';
        }

        return createErrorResponse(errorMessage, 500, ErrorCode.AI_ERROR);
    }
}
