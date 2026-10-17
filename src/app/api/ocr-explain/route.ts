import { NextResponse } from "next/server";
import { getAIService } from "@grow/shared/ai";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { createErrorResponse, ErrorCode, badRequest } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const logger = createLogger('api:ocr-explain');

// 与 /api/analyze 一致的图片约束
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_DECODED_BYTES = 5 * 1024 * 1024; // 解码后 ≤ 5MB

/**
 * 解析图 OCR：逐字转录一张解析/解题过程图片中的文本。
 * 供小程序「上传解析图」模式使用——只转录，不解题不改写。
 * POST { imageBase64: string(data URL 或裸 base64), mimeType?: string } → { text: string }
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        let { imageBase64, mimeType } = body as { imageBase64?: string; mimeType?: string };

        if (typeof imageBase64 !== 'string' || !imageBase64) {
            return badRequest("缺少图片数据");
        }

        // 解析 Data URL（兼容裸 base64）
        if (imageBase64.startsWith('data:')) {
            const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                imageBase64 = matches[2];
            }
        }

        const mime = (mimeType || 'image/jpeg').toLowerCase();
        if (!ALLOWED_MIME_TYPES.includes(mime)) {
            return createErrorResponse(
                '图片格式不支持，仅支持 JPEG/PNG/WebP/GIF',
                400,
                ErrorCode.INVALID_INPUT
            );
        }

        const decodedBytes = (imageBase64.length * 3) / 4;
        if (decodedBytes > MAX_IMAGE_DECODED_BYTES) {
            return createErrorResponse(
                '图片过大，单张上限约 5MB，请压缩后重试',
                400,
                ErrorCode.INVALID_INPUT
            );
        }

        // 限流：与识别接口同档（每用户每分钟 10 次）
        const limit = rateLimit(`ai:ocr:${session.user?.email || "anon"}`, { limit: 10, windowMs: 60 * 1000 });
        if (!limit.allowed) {
            return tooManyRequests(limit.retryAfterSeconds, "请求过于频繁，请稍后再试");
        }

        const aiService = getAIService();
        const startAt = Date.now();
        const text = await aiService.transcribeImage(imageBase64, mime);
        logger.info({ durationMs: Date.now() - startAt, textLength: text.length }, 'OCR explain done');

        return NextResponse.json({ text });
    } catch (error: any) {
        logger.error({ error: error.message }, 'OCR explain failed');
        return createErrorResponse(error.message || "解析图识别失败，请重试", 500, ErrorCode.AI_ERROR);
    }
}
