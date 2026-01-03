import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OpenAIProvider } from '@/lib/ai/openai-provider';
import { GeminiProvider } from '@/lib/ai/gemini-provider';
import { AzureOpenAIProvider } from '@/lib/ai/azure-provider';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api:ai:test');

// 测试用的最小 1x1 透明 PNG 图片 (Base64)
// 测试用图片：压缩后的真实数学题目图片 (约 3KB)
const TEST_IMAGE_BASE64 = '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';
const TEST_IMAGE_MIME = 'image/jpeg';

// 解析错误并返回标准化错误代码（前端负责翻译）
function parseErrorCode(error: unknown): string {
    const msg = error instanceof Error ? error.message : String(error);
    const msgLower = msg.toLowerCase();

    // 1. 首先检查是否是 AI Provider 抛出的标准错误代码（直接传递）
    const aiErrorCodes = [
        'AI_CONNECTION_FAILED', 'AI_TIMEOUT_ERROR', 'AI_QUOTA_EXCEEDED',
        'AI_PERMISSION_DENIED', 'AI_NOT_FOUND', 'AI_RESPONSE_ERROR',
        'AI_AUTH_ERROR', 'AI_SERVICE_UNAVAILABLE', 'AI_UNKNOWN_ERROR'
    ];
    for (const code of aiErrorCodes) {
        if (msg.includes(code)) {
            return code;
        }
    }

    // 2. 原始错误消息解析（用于非 AI Provider 错误）
    // 认证错误
    if (msgLower.includes('401') || msgLower.includes('unauthorized') || msgLower.includes('api key')) {
        return 'AI_AUTH_ERROR';
    }
    // 权限错误
    if (msgLower.includes('403') || msgLower.includes('forbidden')) {
        return 'AI_PERMISSION_DENIED';
    }
    // 资源不存在 / 模型不存在 / 404
    if (msgLower.includes('404') || msgLower.includes('not found')) {
        return 'AI_NOT_FOUND';
    }
    // 频率限制 / 配额
    if (msgLower.includes('429') || msgLower.includes('rate limit') || msgLower.includes('too many') || msgLower.includes('quota') || msgLower.includes('额度')) {
        return 'AI_QUOTA_EXCEEDED';
    }
    // 网络/连接错误
    if (msgLower.includes('fetch failed') || msgLower.includes('network') || msgLower.includes('connect') ||
        msgLower.includes('enotfound') || msgLower.includes('econnrefused') || msgLower.includes('etimedout') ||
        msgLower.includes('econnreset')) {
        return 'AI_CONNECTION_FAILED';
    }
    // 超时 (包括 408)
    if (msgLower.includes('timeout') || msgLower.includes('timed out') || msgLower.includes('aborted') || msgLower.includes('408')) {
        return 'AI_TIMEOUT_ERROR';
    }
    // 服务器错误
    if (msgLower.includes('500') || msgLower.includes('502') || msgLower.includes('503') || msgLower.includes('504') || msgLower.includes('overloaded')) {
        return 'AI_UNKNOWN_ERROR';
    }
    // AI 响应格式错误
    if (msgLower.includes('invalid json') || msgLower.includes('parse') || msgLower.includes('missing critical xml')) {
        return 'AI_RESPONSE_ERROR';
    }

    // 兜底：返回未知错误
    return 'AI_UNKNOWN_ERROR';
}

export interface AITestRequest {
    provider: 'openai' | 'gemini' | 'azure';
    apiKey: string;
    baseUrl?: string;
    model?: string;
    // Azure 特有
    endpoint?: string;
    deploymentName?: string;
    apiVersion?: string;
    // 语言
    language?: 'zh' | 'en';
}

export interface AITestResponse {
    success: boolean;
    textSupport: boolean;
    visionSupport: boolean;
    textError?: string;
    visionError?: string;
    modelInfo?: string;
}

export async function POST(request: NextRequest) {
    try {
        // 验证登录
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body: AITestRequest = await request.json();
        const { provider, apiKey, baseUrl, model, endpoint, deploymentName, apiVersion, language = 'zh' } = body;

        if (!provider || !apiKey) {
            return NextResponse.json({ error: 'Missing provider or apiKey' }, { status: 400 });
        }

        logger.info({ provider, model, baseUrl: baseUrl || endpoint }, 'AI 连接测试开始');

        let textSupport = false;
        let visionSupport = false;
        let textError: string | undefined;
        let visionError: string | undefined;
        let modelInfo: string | undefined;

        // 辅助函数：判断错误是否为配置/连接问题（不应继续文本测试）
        const isConfigError = (errorCode: string) => {
            return ['AI_AUTH_ERROR', 'AI_CONNECTION_FAILED', 'AI_TIMEOUT_ERROR',
                'AI_QUOTA_EXCEEDED', 'AI_PERMISSION_DENIED', 'AI_SERVICE_UNAVAILABLE'].includes(errorCode);
        };

        // 优化策略：先视觉测试，成功则一步完成；失败则根据错误类型决定是否进行文本测试
        // 测试 1: 视觉（多模态）能力
        try {
            if (provider === 'openai') {
                const openai = new OpenAIProvider({ apiKey, baseUrl, model });
                const result = await openai.analyzeImage(TEST_IMAGE_BASE64, TEST_IMAGE_MIME, language);
                if (result.questionText || result.analysis) {
                    // 视觉成功 → 文本和视觉都支持，一步完成
                    textSupport = true;
                    visionSupport = true;
                    modelInfo = model || 'gpt-4o';
                }
            } else if (provider === 'gemini') {
                const gemini = new GeminiProvider({ apiKey, baseUrl, model });
                const result = await gemini.analyzeImage(TEST_IMAGE_BASE64, TEST_IMAGE_MIME, language);
                if (result.questionText || result.analysis) {
                    textSupport = true;
                    visionSupport = true;
                    modelInfo = model || 'gemini-2.0-flash';
                }
            } else if (provider === 'azure') {
                if (!endpoint || !deploymentName) {
                    return NextResponse.json({ error: 'Azure 需要 endpoint 和 deploymentName' }, { status: 400 });
                }
                const azure = new AzureOpenAIProvider({
                    apiKey,
                    endpoint,
                    deploymentName,
                    apiVersion,
                    model
                });
                const result = await azure.analyzeImage(TEST_IMAGE_BASE64, TEST_IMAGE_MIME, language);
                if (result.questionText || result.analysis) {
                    textSupport = true;
                    visionSupport = true;
                    modelInfo = model || deploymentName;
                }
            }
        } catch (error) {
            const errCode = parseErrorCode(error);
            const errMsg = error instanceof Error ? error.message : String(error);

            logger.info({ error: errMsg, errorCode: errCode, provider }, '视觉测试失败');

            // 如果是配置/连接问题，直接返回错误，不再测试文本
            if (isConfigError(errCode)) {
                textError = errCode;
                visionError = errCode;
                logger.warn({ errorCode: errCode, provider }, '配置错误，跳过文本测试');
            } else {
                // 非配置错误（如模型不支持多模态），标记为视觉不支持
                visionError = 'VISION_NOT_SUPPORTED';
            }
        }

        // 测试 2: 文本生成能力（仅在视觉失败且非配置错误时进行）
        if (!textSupport && !textError) {
            try {
                if (provider === 'openai') {
                    const openai = new OpenAIProvider({ apiKey, baseUrl, model });
                    const result = await openai.generateSimilarQuestion(
                        '1+1=?',
                        ['基础算术'],
                        language,
                        'easy'
                    );
                    if (result.questionText) {
                        textSupport = true;
                        modelInfo = model || 'gpt-4o';
                    }
                } else if (provider === 'gemini') {
                    const gemini = new GeminiProvider({ apiKey, baseUrl, model });
                    const result = await gemini.generateSimilarQuestion(
                        '1+1=?',
                        ['基础算术'],
                        language,
                        'easy'
                    );
                    if (result.questionText) {
                        textSupport = true;
                        modelInfo = model || 'gemini-2.0-flash';
                    }
                } else if (provider === 'azure') {
                    const azure = new AzureOpenAIProvider({
                        apiKey,
                        endpoint,
                        deploymentName,
                        apiVersion,
                        model
                    });
                    const result = await azure.generateSimilarQuestion(
                        '1+1=?',
                        ['基础算术'],
                        language,
                        'easy'
                    );
                    if (result.questionText) {
                        textSupport = true;
                        modelInfo = model || deploymentName;
                    }
                }
            } catch (error) {
                textError = parseErrorCode(error);
                logger.warn({ error, provider }, '文本生成测试失败');
            }
        }

        const response: AITestResponse = {
            success: textSupport,
            textSupport,
            visionSupport,
            textError,
            visionError,
            modelInfo
        };

        logger.info({ response }, 'AI 连接测试完成');

        return NextResponse.json(response);

    } catch (error) {
        logger.error({ error }, 'AI 测试 API 异常');
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
