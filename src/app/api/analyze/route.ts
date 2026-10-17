import { NextResponse } from "next/server";
import { getAIService } from "@grow/shared/ai";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { calculateGradeNumber, inferSubjectFromName } from "@/lib/knowledge-tags";
import { calculateGrade } from "@/lib/grade-calculator";
import { prisma } from "@grow/shared/prisma";
import { badRequest, internalError, createErrorResponse, ErrorCode } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { GONGKAO_NOTEBOOKS } from "@grow/shared/subjects";
import { stitchImagesVertically, StitchImageInput, StitchResult } from "@/lib/image-stitch";
import { logAiEval, newEvalEntry, readProviderLabel, AiEvalScene } from "@/lib/ai-eval-log";

const logger = createLogger('api:analyze');

// 图片类型白名单 + 大小上限，防止任意数据/超大载荷打到 AI 上游
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// 多图拼接参数
const MAX_IMAGES = 5;                        // 最多 5 张
const MAX_IMAGE_DECODED_BYTES = 5 * 1024 * 1024; // 单张解码后 ≤ 5MB
const MAX_TOTAL_BASE64_CHARS = 60_000_000;   // 多图请求整体 base64 上限（约 45MB 解码后）

interface AnalysisContext {
    userGrade: 7 | 8 | 9 | 10 | 11 | 12 | null;
    userGradeSemester: string | null;
    subjectChinese: string | null;
}

/** 解析用户年级/学期与错题本学科（单图与多图共用） */
async function resolveAnalysisContext(session: any, subjectId?: string): Promise<AnalysisContext> {
    let userGrade: 7 | 8 | 9 | 10 | 11 | 12 | null = null;
    let userGradeSemester: string | null = null;
    let subjectName: 'math' | 'physics' | 'chemistry' | 'biology' | 'english' | 'chinese' | 'history' | 'geography' | 'politics' | null = null;

    if (session?.user?.email) {
        try {
            // 获取用户信息
            const user = await prisma.user.findUnique({
                where: { email: session.user.email },
                select: { educationStage: true, enrollmentYear: true }
            });

            if (user) {
                userGrade = calculateGradeNumber(user.educationStage, user.enrollmentYear);
                if (user.educationStage && user.enrollmentYear) {
                    userGradeSemester = calculateGrade(user.educationStage, user.enrollmentYear, new Date(), 'zh');
                }
                logger.debug({ userGrade, userGradeSemester }, 'Calculated user grade');
            }

            // 获取错题本信息以推断学科
            if (subjectId) {
                const subject = await prisma.subject.findUnique({
                    where: { id: subjectId },
                    select: { name: true }
                });

                if (subject) {
                    // 行测错题本（言语理解/判断推理/数量关系/资料分析/常识判断/申论）：
                    // 不映射到 K12 学科，走行测考点标签注入（subject='gongkao' 系统标签）
                    const isGongkaoNotebook = (GONGKAO_NOTEBOOKS as readonly string[]).includes(subject.name)
                        || /行测|申论|言语|判断|数量|资料|常识/.test(subject.name);
                    subjectName = isGongkaoNotebook ? null : inferSubjectFromName(subject.name);
                    logger.debug({ subjectName, subjectDisplayName: subject.name, isGongkaoNotebook }, 'Inferred subject');
                }
            }
        } catch (error) {
            logger.error({ error }, 'Error fetching user/subject info');
            // 继续执行，不传递年级参数（会返回所有年级的标签）
        }
    }

    // 将内部科目名称转换为中文科目名称
    const subjectNameMapping: Record<string, string> = {
        'math': '数学',
        'physics': '物理',
        'chemistry': '化学',
        'biology': '生物',
        'english': '英语',
        'chinese': '语文',
        'history': '历史',
        'geography': '地理',
        'politics': '政治',
    };
    const subjectChinese = subjectName ? subjectNameMapping[subjectName] : null;

    return { userGrade, userGradeSemester, subjectChinese };
}

/** 多图模式：校验 → 拼接 → 整体识别，返回结构化题目 + 拼接图 base64 */
async function handleMultiImageAnalysis(
    images: any[],
    language: 'zh' | 'en' | undefined,
    ctx: AnalysisContext,
    explainMode: 'ai' | 'skip' = 'ai'
): Promise<NextResponse> {
    if (images.length > MAX_IMAGES) {
        return createErrorResponse(
            `图片数量超过限制：最多 ${MAX_IMAGES} 张`,
            400,
            ErrorCode.INVALID_INPUT,
            `Maximum ${MAX_IMAGES} images allowed`
        );
    }

    const inputs: StitchImageInput[] = [];
    let totalBase64 = 0;

    for (let i = 0; i < images.length; i++) {
        const raw = images[i];
        if (!raw || typeof raw !== 'object') {
            return badRequest(`第 ${i + 1} 张图片数据无效`);
        }
        let { base64, mimeType } = raw as { base64?: string; mimeType?: string };

        if (typeof base64 !== 'string' || !base64) {
            return badRequest(`第 ${i + 1} 张图片数据缺失`);
        }

        // 解析 Data URL（兼容 data:image/jpeg;base64,...）
        if (base64.startsWith('data:')) {
            const matches = base64.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                base64 = matches[2];
            }
        }

        const mime = (mimeType || '').toLowerCase();
        if (!ALLOWED_MIME_TYPES.includes(mime)) {
            return createErrorResponse(
                `第 ${i + 1} 张图片格式不支持，仅支持 JPEG/PNG/WebP/GIF`,
                400,
                ErrorCode.INVALID_INPUT
            );
        }

        const decodedBytes = (base64.length * 3) / 4;
        if (decodedBytes > MAX_IMAGE_DECODED_BYTES) {
            return createErrorResponse(
                `第 ${i + 1} 张图片过大，单张上限约 5MB`,
                400,
                ErrorCode.INVALID_INPUT
            );
        }

        totalBase64 += base64.length;
        inputs.push({ base64, mimeType: mime });
    }

    if (totalBase64 > MAX_TOTAL_BASE64_CHARS) {
        return createErrorResponse(
            '图片总量过大，请减少张数或压缩后重试',
            400,
            ErrorCode.INVALID_INPUT
        );
    }

    // 纵向拼接成一张完整题目图
    let merged: StitchResult;
    try {
        merged = await stitchImagesVertically(inputs);
    } catch (err: any) {
        logger.error({ error: err?.message || String(err) }, 'Image stitching failed');
        return createErrorResponse(
            err?.message?.includes('过长')
                ? err.message
                : '图片拼接失败，请减少图片数量或更换图片后重试',
            400,
            ErrorCode.INVALID_INPUT,
            err?.message || String(err)
        );
    }

    logger.info({
        imagesCount: inputs.length,
        mergedWidth: merged.width,
        mergedHeight: merged.height,
        mergedSize: merged.base64.length
    }, 'Multi-image stitched, calling AI');

    const aiService = getAIService();
    const startAt = Date.now();
    const analysisResult = await aiService.analyzeImage(
        merged.base64,
        merged.mimeType,
        language,
        ctx.userGrade,
        ctx.subjectChinese,
        ctx.userGradeSemester,
        explainMode
    );
    const durationMs = Date.now() - startAt;

    logger.info({ imagesCount: inputs.length }, 'Multi-image analysis successful');

    // 评估日志：记录多图识别结果（供 accuracy/stability 统计）
    logAiEval(newEvalEntry("analyze_multi", {
        ok: true,
        statusCode: 200,
        durationMs,
        ...readProviderLabel(),
        subject: ctx.subjectChinese,
        imageMeta: { imagesCount: inputs.length, width: merged.width, height: merged.height },
        result: analysisResult as unknown as Record<string, unknown>,
    }));

    return NextResponse.json({
        ...analysisResult,
        mergedImageBase64: merged.base64,
    });
}

export async function POST(req: Request) {
    logger.info('Analyze API called');
    const requestStart = Date.now();

    const session = await getServerSession(authOptions);

    // 认证检查
    if (!session) {
        logger.warn('Unauthorized access attempt');
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // 评估日志错误路径用：在 try 外声明，catch 里才能引用（try 内是块级作用域）
    let evalMeta: { scene: AiEvalScene; imageMeta?: Record<string, unknown> } = { scene: "analyze_single" };

    try {
        const body = await req.json();
        let { imageBase64, mimeType, language, subjectId, images } = body;
        // 解析方式：ai=AI 生成解析（默认，兼容旧调用）；skip=用户将上传解析图，AI 只识别题干与答案
        const explainMode: 'ai' | 'skip' = body.explainMode === 'skip' ? 'skip' : 'ai';

        evalMeta.scene = (Array.isArray(images) && images.length > 0) ? "analyze_multi" : "analyze_single";
        evalMeta.imageMeta = (Array.isArray(images) && images.length > 0)
            ? { imagesCount: images.length }
            : { base64Chars: (typeof imageBase64 === "string" ? imageBase64.length : undefined) };

        logger.debug({
            imageLength: imageBase64?.length,
            mimeType,
            language,
            subjectId,
            imagesCount: Array.isArray(images) ? images.length : 0
        }, 'Request received');

        // 限流：AI 接口按用户每分钟 10 次，防滥用与成本失控
        const aiLimit = rateLimit(`ai:analyze:${session.user?.email || "anon"}`, { limit: 10, windowMs: 60 * 1000 });
        if (!aiLimit.allowed) {
            return tooManyRequests(aiLimit.retryAfterSeconds, "AI 请求过于频繁，请稍后再试");
        }

        // 多图拼接模式（单题跨多张）：images[] 纵向拼接后整体识别
        if (Array.isArray(images) && images.length > 0) {
            const ctx = await resolveAnalysisContext(session, subjectId);
            return await handleMultiImageAnalysis(images, language, ctx, explainMode);
        }

        if (!imageBase64) {
            logger.warn('Missing image data');
            return badRequest("Missing image data");
        }

        // Parse Data URL if present
        if (imageBase64.startsWith('data:')) {
            const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                imageBase64 = matches[2];
                logger.debug({ mimeType, base64Length: imageBase64.length }, 'Parsed Data URL');
            }
        }

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

        const ctx = await resolveAnalysisContext(session, subjectId);

        logger.info({ userGrade: ctx.userGrade, userGradeSemester: ctx.userGradeSemester, subject: ctx.subjectChinese }, 'Calling AI service for image analysis');
        const aiService = getAIService();
        const startAt = Date.now();
        const analysisResult = await aiService.analyzeImage(imageBase64, mimeType, language, ctx.userGrade, ctx.subjectChinese, ctx.userGradeSemester, explainMode);
        const durationMs = Date.now() - startAt;

        logger.debug({
            knowledgePointsCount: analysisResult.knowledgePoints?.length,
            knowledgePointsType: typeof analysisResult.knowledgePoints,
            isArray: Array.isArray(analysisResult.knowledgePoints)
        }, 'AI returned knowledge points');

        // AI 现在从数据库获取标签列表，返回的标签已经是标准化的，不需要额外处理
        if (!analysisResult.knowledgePoints || analysisResult.knowledgePoints.length === 0) {
            logger.warn('Knowledge points is empty or null');
        }

        logger.info('AI analysis successful');

        // 评估日志：记录单图识别结果（供 accuracy/stability 统计）
        logAiEval(newEvalEntry("analyze_single", {
            ok: true,
            statusCode: 200,
            durationMs,
            ...readProviderLabel(),
            subject: ctx.subjectChinese,
            imageMeta: { base64Chars: imageBase64?.length },
            result: analysisResult as unknown as Record<string, unknown>,
        }));

        return NextResponse.json(analysisResult);
    } catch (error: any) {
        logger.error({
            error: error.message,
            stack: error.stack
        }, 'Analysis error occurred');

        // 返回具体的错误类型，便于前端显示详细提示
        let errorMessage = error.message || "Failed to analyze image";

        // 识别特定错误类型
        if (error.message && (
            error.message === 'AI_CONNECTION_FAILED' ||
            error.message === 'AI_RESPONSE_ERROR' ||
            error.message.includes('AI_AUTH_ERROR') ||
            error.message === 'AI_TIMEOUT_ERROR' ||
            error.message === 'AI_QUOTA_EXCEEDED' ||
            error.message === 'AI_PERMISSION_DENIED' ||
            error.message === 'AI_NOT_FOUND' ||
            error.message === 'AI_SERVICE_UNAVAILABLE' ||
            error.message === 'AI_UNKNOWN_ERROR'
        )) {
            // 直接传递 AI Provider 定义的错误类型 (如果是 AI_AUTH_ERROR，提取出来)
            if (error.message.includes('AI_AUTH_ERROR')) {
                errorMessage = 'AI_AUTH_ERROR';
            } else {
                errorMessage = error.message;
            }
        } else if (error.message?.includes('Zod') || error.message?.includes('validate')) {
            // Zod 验证错误
            errorMessage = 'AI_RESPONSE_ERROR';
        }

        // 原始错误已记录日志，details 不回传客户端以免泄漏上游 AI 服务信息
        logAiEval(newEvalEntry(evalMeta.scene, {
            ok: false,
            statusCode: 500,
            durationMs: Date.now() - requestStart,
            ...readProviderLabel(),
            imageMeta: evalMeta.imageMeta,
            errorCode: ErrorCode.AI_ERROR,
            errorMessage,
            rawNote: error.message?.includes('Missing critical XML tags')
                ? 'PARSE_FAILED: missing critical XML tags'
                : undefined,
        }));
        return createErrorResponse(errorMessage, 500, ErrorCode.AI_ERROR);
    }
}
