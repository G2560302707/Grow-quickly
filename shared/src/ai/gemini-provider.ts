import { GoogleGenAI } from "@google/genai";
import { AIService, ParsedQuestion, DetectedQuestion, DifficultyLevel, AIConfig, ReanswerQuestionResult, GeogebraAnalysisResult, BankImportItem } from "./types";
import { generateAnalyzePrompt, generateSimilarQuestionPrompt, generateGeogebraPrompt, generateDetectPrompt, generateSimilarQuestionBatchPrompt, generateBankImportPrompt, generateOcrExplainPrompt, SKIP_EXPLANATION_HINT } from './prompts';
import { safeParseParsedQuestion, parseDetectedQuestions, parseSimilarBatch, parseBankImportBatch } from './schema';
import { getAppConfig } from '../config';
import { getMathTagsFromDB, getTagsFromDB } from './tag-service';
import { GONGKAO_MODULES } from '../tag-data';
import { createLogger } from '../logger';
import { normalizeMistakeStatusForSave } from '../mistake-status';
import { AI_SUBJECT_OPTIONS } from '../subjects';
import { retryOperation } from './retry';

const logger = createLogger('ai:gemini');

type GeminiContent = string | Array<
    { text: string } |
    { inlineData: { mimeType: string; data: string } }
>;

export class GeminiProvider implements AIService {
    private ai: GoogleGenAI;
    private modelName: string;
    private baseUrl: string;

    constructor(config?: AIConfig) {
        const apiKey = config?.apiKey;
        const baseUrl = config?.baseUrl;
        const timeoutMs = config?.timeoutMs;

        if (!apiKey) {
            throw new Error("AI_AUTH_ERROR: GOOGLE_API_KEY is required for Gemini provider");
        }

        // 使用 httpOptions.baseUrl 来配置自定义 API 地址，避免全局 setDefaultBaseUrls 的竞态条件
        // 参考：@google/genai 的 GoogleGenAIOptions.httpOptions.baseUrl
        // timeout 为单次请求超时，防止请求无限挂起
        this.ai = new GoogleGenAI({
            apiKey,
            httpOptions: (baseUrl || timeoutMs) ? {
                ...(baseUrl ? { baseUrl } : {}),
                ...(timeoutMs ? { timeout: timeoutMs } : {})
            } : undefined
        });

        this.modelName = config?.model || 'gemini-2.0-flash';
        this.baseUrl = baseUrl || 'https://generativelanguage.googleapis.com';

        logger.info({
            provider: 'Gemini',
            model: this.modelName,
            baseUrl: this.baseUrl,
            apiKeyPrefix: apiKey.substring(0, 8) + '...'
        }, 'AI Provider initialized');
    }

    private extractTag(text: string, tagName: string): string | null {
        const startTag = `<${tagName}>`;
        const endTag = `</${tagName}>`;
        const startIndex = text.indexOf(startTag);
        const endIndex = text.lastIndexOf(endTag);

        if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
            return null;
        }

        return text.substring(startIndex + startTag.length, endIndex).trim();
    }

    private parseResponse(text: string, explainMode: 'ai' | 'skip' = 'ai'): ParsedQuestion {
        logger.debug({ textLength: text.length }, 'Parsing AI response');

        const questionText = this.extractTag(text, "question_text");
        const answerText = this.extractTag(text, "answer_text");
        const analysis = this.extractTag(text, "analysis");
        const subjectRaw = this.extractTag(text, "subject");
        const knowledgePointsRaw = this.extractTag(text, "knowledge_points");
        const requiresImageRaw = this.extractTag(text, "requires_image");
        const wrongAnswerText = this.extractTag(text, "wrong_answer_text") || "";
        const mistakeAnalysis = this.extractTag(text, "mistake_analysis") || "";
        const mistakeStatusRaw = this.extractTag(text, "mistake_status");

        // Basic Validation（skip 模式：解析由用户上传解析图提供，允许 AI 省略 <analysis>）
        if (!questionText || !answerText || (explainMode !== 'skip' && !analysis)) {
            logger.error({ rawTextSample: text.substring(0, 500) }, 'Missing critical XML tags');
            throw new Error("Invalid AI response: Missing critical XML tags (<question_text>, <answer_text>, or <analysis>)");
        }

        // Process Subject
        let subject: ParsedQuestion['subject'] = '其他';
        const validSubjects: ParsedQuestion['subject'][] = [...AI_SUBJECT_OPTIONS];
        if (subjectRaw && (validSubjects as string[]).includes(subjectRaw)) {
            subject = subjectRaw as ParsedQuestion['subject'];
        }

        // Process Knowledge Points
        let knowledgePoints: string[] = [];
        if (knowledgePointsRaw) {
            knowledgePoints = knowledgePointsRaw.split(/[,，\n]/).map(k => k.trim()).filter(k => k.length > 0);
        }

        // Process requiresImage
        const requiresImage = requiresImageRaw?.toLowerCase().trim() === 'true';
        const mistakeStatus = normalizeMistakeStatusForSave(mistakeStatusRaw, wrongAnswerText);

        // Construct Result
        const result: ParsedQuestion = {
            questionText,
            answerText,
            analysis: analysis || "",
            wrongAnswerText,
            mistakeAnalysis,
            mistakeStatus,
            subject,
            knowledgePoints,
            requiresImage
        };

        // Final Schema Validation
        const validation = safeParseParsedQuestion(result);
        if (validation.success) {
            logger.debug('Validated successfully via XML tags');
            return validation.data;
        } else {
            logger.warn({ validationError: validation.error.format() }, 'Schema validation warning');
            return result;
        }
    }

    async analyzeImage(imageBase64: string, mimeType: string = "image/jpeg", language: 'zh' | 'en' = 'zh', grade?: 7 | 8 | 9 | 10 | 11 | 12 | null, subject?: string | null, gradeSemester?: string | null, explainMode: 'ai' | 'skip' = 'ai'): Promise<ParsedQuestion> {
        const config = getAppConfig();

        // 从数据库获取各学科标签
        const prefetchedMathTags = (subject === '数学' || !subject) ? await getMathTagsFromDB(grade || null) : [];
        const prefetchedPhysicsTags = (subject === '物理' || !subject) ? await getTagsFromDB('physics') : [];
        const prefetchedChemistryTags = (subject === '化学' || !subject) ? await getTagsFromDB('chemistry') : [];
        const prefetchedBiologyTags = (subject === '生物' || !subject) ? await getTagsFromDB('biology') : [];
        const prefetchedEnglishTags = (subject === '英语' || !subject) ? await getTagsFromDB('english') : [];
        // 行测考点标签：未指定学科（行测错题本/自动识别）时注入，供行测题精确打标
        const prefetchedGongkaoTags = (!subject || GONGKAO_MODULES.includes(subject)) ? await getTagsFromDB('gongkao') : [];

        const prompt = generateAnalyzePrompt(language, grade, subject, {
            customTemplate: config.prompts?.analyze,
            prefetchedMathTags,
            prefetchedPhysicsTags,
            prefetchedChemistryTags,
            prefetchedBiologyTags,
            prefetchedEnglishTags,
            prefetchedGongkaoTags,
            providerHints: explainMode === 'skip' ? SKIP_EXPLANATION_HINT : '',
        }, gradeSemester);

        logger.box('🔍 AI Image Analysis Request', {
            provider: 'Gemini',
            endpoint: `${this.baseUrl}/v1beta/models/${this.modelName}:generateContent`,
            imageSize: `${imageBase64.length} bytes`,
            mimeType,
            model: this.modelName,
            language,
            grade: grade || 'all'
        });
        logger.box('📝 Full Prompt', prompt);

        try {
            // 构建请求参数（用于日志显示）
            const requestParamsForLog = {
                model: this.modelName,
                contents: [
                    {
                        text: prompt
                    },
                    {
                        inlineData: {
                            data: `[...${imageBase64.length} bytes base64 data...]`,
                            mimeType: mimeType
                        }
                    }
                ]
            };

            logger.box('📤 API Request (发送给 AI 的原始请求)', JSON.stringify(requestParamsForLog, null, 2));

            const startTime = Date.now();
            const response = await retryOperation(() => this.ai.models.generateContent({
                model: this.modelName,
                contents: [
                    {
                        text: prompt
                    },
                    {
                        inlineData: {
                            data: imageBase64,
                            mimeType: mimeType
                        }
                    }
                ]
            }), { label: 'gemini:analyzeImage' });

            const durationMs = Date.now() - startTime;
            const usage = response.usageMetadata;
            logger.info({
                provider: 'Gemini',
                model: this.modelName,
                durationMs,
                promptTokens: usage?.promptTokenCount,
                completionTokens: usage?.candidatesTokenCount,
                totalTokens: usage?.totalTokenCount,
            }, 'Gemini analyzeImage completed');

            logger.box('📦 Full API Response Metadata', {
                usageMetadata: response.usageMetadata
            });

            const text = response.text || '';

            logger.box('🤖 AI Raw Response', text);

            if (!text) throw new Error("Empty response from AI");
            const parsedResult = this.parseResponse(text, explainMode);

            logger.box('✅ Parsed & Validated Result', JSON.stringify(parsedResult, null, 2));

            return parsedResult;

        } catch (error) {
            logger.box('❌ Error during AI analysis', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            this.handleError(error);
            throw error;
        }
    }

    async detectQuestions(imageBase64: string, mimeType: string = "image/jpeg"): Promise<DetectedQuestion[]> {
        const config = getAppConfig();
        const prompt = generateDetectPrompt({ customTemplate: config.prompts?.detect });

        logger.box('📍 Question Detect Request', {
            provider: 'Gemini',
            endpoint: `${this.baseUrl}/v1beta/models/${this.modelName}:generateContent`,
            imageSize: `${imageBase64.length} bytes`,
            mimeType,
            model: this.modelName,
        });

        let text = "";
        try {
            const startTime = Date.now();
            const response = await retryOperation(() => this.ai.models.generateContent({
                model: this.modelName,
                contents: [
                    { text: prompt },
                    { inlineData: { data: imageBase64, mimeType } }
                ]
            }), { label: 'gemini:detectQuestions' });

            logger.info({
                provider: 'Gemini',
                model: this.modelName,
                durationMs: Date.now() - startTime,
            }, 'Gemini detectQuestions completed');

            text = response.text || '';
            logger.box('🤖 Detect Raw Response', text);

            if (!text) throw new Error("Empty response from AI");
        } catch (error) {
            logger.box('❌ Error during question detect', {
                error: error instanceof Error ? error.message : String(error),
            });
            this.handleError(error);
            throw error;
        }

        // 解析放在 try 外：解析失败直接抛 AI_RESPONSE_ERROR，避免被 handleError 映射成 AI_UNKNOWN_ERROR
        try {
            return parseDetectedQuestions(text);
        } catch (error) {
            logger.error({ error }, 'Detect response parse failed');
            throw new Error("AI_RESPONSE_ERROR");
        }
    }

    async generateSimilarQuestion(originalQuestion: string, knowledgePoints: string[], language: 'zh' | 'en' = 'zh', difficulty: DifficultyLevel = 'medium', gradeSemester?: string | null): Promise<ParsedQuestion> {
        const config = getAppConfig();
        const prompt = generateSimilarQuestionPrompt(language, originalQuestion, knowledgePoints, difficulty, {
            customTemplate: config.prompts?.similar
        }, gradeSemester);

        logger.box('🎯 Generate Similar Question Request', {
            provider: 'Gemini',
            endpoint: `${this.baseUrl}/v1beta/models/${this.modelName}:generateContent`,
            originalQuestion: originalQuestion.substring(0, 100) + '...',
            knowledgePoints: knowledgePoints.join(', '),
            difficulty,
            language
        });
        logger.box('📝 Full Prompt', prompt);

        try {
            const startTime = Date.now();
            const response = await retryOperation(() => this.ai.models.generateContent({
                model: this.modelName,
                contents: prompt
            }), { label: 'gemini:generateSimilarQuestion' });

            logger.info({
                provider: 'Gemini',
                model: this.modelName,
                durationMs: Date.now() - startTime,
                totalTokens: response.usageMetadata?.totalTokenCount,
            }, 'Gemini generateSimilarQuestion completed');

            const text = response.text || '';

            logger.box('🤖 AI Raw Response', text);

            if (!text) throw new Error("Empty response from AI");
            const parsedResult = this.parseResponse(text);

            logger.box('✅ Parsed & Validated Result', JSON.stringify(parsedResult, null, 2));

            return parsedResult;

        } catch (error) {
            logger.box('❌ Error during question generation', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            this.handleError(error);
            throw error;
        }
    }

    async generateSimilarQuestions(brief: string, knowledgePoints: string[], language: 'zh' | 'en' = 'zh', difficulty: DifficultyLevel = 'medium', count: number = 1, gradeSemester?: string | null): Promise<ParsedQuestion[]> {
        const config = getAppConfig();
        const total = Math.min(Math.max(Math.round(count) || 1, 1), 10);
        const prompt = generateSimilarQuestionBatchPrompt(brief, knowledgePoints, language, difficulty, total, {
            customTemplate: config.prompts?.similarBatch,
        }, gradeSemester);

        logger.box('🎯 Generate Similar Questions (batch) Request', {
            provider: 'Gemini',
            endpoint: `${this.baseUrl}/v1beta/models/${this.modelName}:generateContent`,
            model: this.modelName,
            count: total,
            difficulty,
            language
        });

        try {
            const startTime = Date.now();
            const response = await retryOperation(() => this.ai.models.generateContent({
                model: this.modelName,
                contents: prompt
            }), { label: 'gemini:generateSimilarQuestions' });

            logger.info({
                provider: 'Gemini',
                model: this.modelName,
                durationMs: Date.now() - startTime,
            }, 'Gemini generateSimilarQuestions (batch) completed');

            const text = response.text || '';
            logger.box('🤖 Batch Raw Response', text);

            if (!text) throw new Error("Empty response from AI");
            const questions = parseSimilarBatch(text);
            logger.info({ requested: total, received: questions.length }, 'Batch questions parsed');
            return questions.slice(0, total);
        } catch (error) {
            logger.box('❌ Error during batch question generation', {
                error: error instanceof Error ? error.message : String(error),
            });
            this.handleError(error);
            throw error;
        }
    }

    async reanswerQuestion(questionText: string, language: 'zh' | 'en' = 'zh', subject?: string | null, imageBase64?: string, gradeSemester?: string | null): Promise<ReanswerQuestionResult> {
        const { generateReanswerPrompt } = await import('./prompts');
        const prompt = generateReanswerPrompt(language, questionText, subject, undefined, gradeSemester);

        logger.info({
            provider: 'Gemini',
            endpoint: `${this.baseUrl}/v1beta/models/${this.modelName}:generateContent`,
            questionLength: questionText.length,
            subject: subject || 'auto',
            hasImage: !!imageBase64
        }, 'Reanswer Question Request');
        logger.debug({ prompt }, 'Full prompt');

        try {
            // 根据是否有图片构建不同的请求内容
            let contents: GeminiContent;
            if (imageBase64) {
                // 移除 data:image/xxx;base64, 前缀（如果存在）
                const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
                contents = [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
                ];
            } else {
                contents = prompt;
            }

            const startTime = Date.now();
            const response = await retryOperation(() => this.ai.models.generateContent({
                model: this.modelName,
                contents
            }), { label: 'gemini:reanswerQuestion' });

            logger.info({
                provider: 'Gemini',
                model: this.modelName,
                durationMs: Date.now() - startTime,
                totalTokens: response.usageMetadata?.totalTokenCount,
            }, 'Gemini reanswerQuestion completed');

            const text = response.text || '';

            logger.debug({ rawResponse: text }, 'AI raw response');

            if (!text) throw new Error("Empty response from AI");

            // 解析响应
            const answerText = this.extractTag(text, "answer_text") || "";
            const analysis = this.extractTag(text, "analysis") || "";
            const knowledgePointsRaw = this.extractTag(text, "knowledge_points") || "";
            const knowledgePointsParsed = knowledgePointsRaw.split(/[,，\n]/).map(k => k.trim()).filter(k => k.length > 0);
            const wrongAnswerText = this.extractTag(text, "wrong_answer_text") || "";
            const mistakeAnalysis = this.extractTag(text, "mistake_analysis") || "";
            const mistakeStatus = normalizeMistakeStatusForSave(
                this.extractTag(text, "mistake_status"),
                wrongAnswerText
            );

            logger.info('Reanswer parsed successfully');

            return { answerText, analysis, knowledgePoints: knowledgePointsParsed, wrongAnswerText, mistakeAnalysis, mistakeStatus };

        } catch (error) {
            logger.error({ error, stack: error instanceof Error ? error.stack : undefined }, 'Error during reanswer');
            this.handleError(error);
            throw error;
        }
    }

    /** 解析图 OCR：逐字转录图片中的解析文本（不解题不改写），供「上传解析图」模式 */
    async transcribeImage(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<string> {
        const prompt = generateOcrExplainPrompt();
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        logger.info({ provider: 'Gemini', imageSize: base64Data.length, mimeType }, 'OCR transcribe Request');

        try {
            const startTime = Date.now();
            const response = await retryOperation(() => this.ai.models.generateContent({
                model: this.modelName,
                contents: [
                    { text: prompt },
                    { inlineData: { mimeType, data: base64Data } },
                ],
            }), { label: 'gemini:transcribeImage' });
            logger.info({ provider: 'Gemini', durationMs: Date.now() - startTime }, 'Gemini transcribeImage completed');

            const text = (response.text || '').trim();
            if (!text) throw new Error('Empty response from AI');
            return text;
        } catch (error) {
            logger.error({ error }, 'Error during transcribeImage');
            this.handleError(error);
            throw error;
        }
    }

    async analyzeForGeogebra(questionText: string, answerText: string, analysis: string, previousErrors?: string): Promise<GeogebraAnalysisResult> {
        const prompt = generateGeogebraPrompt(questionText, answerText, analysis, previousErrors);

        logger.info({
            provider: 'Gemini',
            model: this.modelName,
            questionLength: questionText.length,
        }, 'GeoGebra Analysis Request');

        try {
            const startTime = Date.now();
            const response = await retryOperation(() => this.ai.models.generateContent({
                model: this.modelName,
                contents: prompt
            }), { label: 'gemini:analyzeForGeogebra' });

            logger.info({
                provider: 'Gemini',
                model: this.modelName,
                durationMs: Date.now() - startTime,
                totalTokens: response.usageMetadata?.totalTokenCount,
            }, 'Gemini analyzeForGeogebra completed');

            const text = response.text || '';
            logger.debug({ rawResponse: text }, 'GeoGebra AI raw response');

            if (!text) throw new Error("Empty response from AI");

            // Extract JSON from response (handle possible markdown code blocks)
            let jsonStr = text.trim();
            const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1].trim();
            }

            // Try to find JSON object
            const objStart = jsonStr.indexOf('{');
            const objEnd = jsonStr.lastIndexOf('}');
            if (objStart !== -1 && objEnd !== -1) {
                jsonStr = jsonStr.substring(objStart, objEnd + 1);
            }

            const parsed = JSON.parse(jsonStr);

            return {
                suitable: Boolean(parsed.suitable),
                commands: Array.isArray(parsed.commands) ? parsed.commands : [],
                description: parsed.description || "",
            };
        } catch (error) {
            logger.error({ error, stack: error instanceof Error ? error.stack : undefined }, 'Error during GeoGebra analysis');
            this.handleError(error);
            throw error;
        }
    }

    private handleError(error: unknown) {
        logger.error({ error }, 'Gemini error');
        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            if (msg.includes('fetch failed') || msg.includes('network') || msg.includes('connect')) {
                throw new Error("AI_CONNECTION_FAILED");
            }
            // 超时错误 (包括 408 Request Timeout)
            if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted') || msg.includes('408')) {
                throw new Error("AI_TIMEOUT_ERROR");
            }
            // 配额/频率限制错误
            if (msg.includes('quota') || msg.includes('额度') || msg.includes('rate limit') || msg.includes('429') || msg.includes('too many')) {
                throw new Error("AI_QUOTA_EXCEEDED");
            }
            // 权限/403 错误
            if (msg.includes('403') || msg.includes('forbidden') || msg.includes('permission')) {
                throw new Error("AI_PERMISSION_DENIED");
            }
            // 资源不存在/404 错误
            if (msg.includes('404') || msg.includes('not found') || msg.includes('does not exist')) {
                throw new Error("AI_NOT_FOUND");
            }
            // 服务器错误 (500/502/503/504)
            if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504') ||
                msg.includes('无可用') || msg.includes('overloaded') || msg.includes('unavailable')) {
                throw new Error("AI_SERVICE_UNAVAILABLE");
            }
            if (msg.includes('invalid json') || msg.includes('parse')) {
                throw new Error("AI_RESPONSE_ERROR");
            }
            if (msg.includes('api key') || msg.includes('unauthorized') || msg.includes('401')) {
                throw new Error("AI_AUTH_ERROR");
            }
        }
        throw new Error("AI_UNKNOWN_ERROR");
    }

    async parseBankQuestions(blocks: string[], tagNames: string[]): Promise<BankImportItem[]> {
        const systemPrompt = generateBankImportPrompt(blocks, tagNames);

        logger.box('📚 Bank Import Parse Request', {
            provider: 'Gemini',
            model: this.modelName,
            blocks: blocks.length,
        });

        try {
            const startTime = Date.now();
            const response = await retryOperation(() => this.ai.models.generateContent({
                model: this.modelName,
                contents: systemPrompt,
            }), { label: 'gemini:parseBankQuestions' });

            const text = response.text || '';
            logger.info({ blocks: blocks.length, durationMs: Date.now() - startTime }, 'Gemini parseBankQuestions completed');
            logger.box('🤖 Bank Import Raw Response', text);

            if (!text) throw new Error("Empty response from AI");
            return parseBankImportBatch(text);
        } catch (error) {
            logger.box('❌ Error during bank import parse', {
                error: error instanceof Error ? error.message : String(error),
            });
            this.handleError(error);
            throw error;
        }
    }

}
