import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { AIService, ParsedQuestion, DifficultyLevel, AIConfig } from "./types";
import { generateAnalyzePrompt, generateSimilarQuestionPrompt } from './prompts';
import { safeParseParsedQuestion } from './schema';
import { getAppConfig } from '../config';
import { getMathTagsFromDB, getTagsFromDB } from './tag-service';

export class GeminiProvider implements AIService {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;

    constructor(config?: AIConfig) {
        const apiKey = config?.apiKey;

        if (!apiKey) {
            throw new Error("AI_AUTH_ERROR: GOOGLE_API_KEY is required for Gemini provider");
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: config?.model || 'gemini-1.5-flash' // Fallback for safety
        }, {
            baseUrl: config?.baseUrl
        });
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

    private parseResponse(text: string): ParsedQuestion {
        console.log("[Gemini] Parsing AI response, length:", text.length);

        const questionText = this.extractTag(text, "question_text");
        const answerText = this.extractTag(text, "answer_text");
        const analysis = this.extractTag(text, "analysis");
        const subjectRaw = this.extractTag(text, "subject");
        const knowledgePointsRaw = this.extractTag(text, "knowledge_points");
        const requiresImageRaw = this.extractTag(text, "requires_image");

        // Basic Validation
        if (!questionText || !answerText || !analysis) {
            console.error("[Gemini] ✗ Missing critical XML tags");
            console.log("Raw text sample:", text.substring(0, 500));
            throw new Error("Invalid AI response: Missing critical XML tags (<question_text>, <answer_text>, or <analysis>)");
        }

        // Process Subject
        let subject: ParsedQuestion['subject'] = '其他';
        const validSubjects = ["数学", "物理", "化学", "生物", "英语", "语文", "历史", "地理", "政治", "其他"];
        if (subjectRaw && validSubjects.includes(subjectRaw)) {
            subject = subjectRaw as any;
        }

        // Process Knowledge Points
        let knowledgePoints: string[] = [];
        if (knowledgePointsRaw) {
            // Split by comma or newline, trim whitespaces
            knowledgePoints = knowledgePointsRaw.split(/[,，\n]/).map(k => k.trim()).filter(k => k.length > 0);
        }

        // Process requiresImage (default to false if not present or unrecognized)
        const requiresImage = requiresImageRaw?.toLowerCase().trim() === 'true';

        // Construct Result
        const result: ParsedQuestion = {
            questionText,
            answerText,
            analysis,
            subject,
            knowledgePoints,
            requiresImage
        };

        // Final Schema Validation
        const validation = safeParseParsedQuestion(result);
        if (validation.success) {
            console.log("[Gemini] ✓ Validated successfully via XML tags");
            return validation.data;
        } else {
            console.warn("[Gemini] ⚠ Schema validation warning:", validation.error.format());
            return result;
        }
    }

    async analyzeImage(imageBase64: string, mimeType: string = "image/jpeg", language: 'zh' | 'en' = 'zh', grade?: 7 | 8 | 9 | 10 | 11 | 12 | null, subject?: string | null): Promise<ParsedQuestion> {
        const config = getAppConfig();

        // 从数据库获取各学科标签
        // 如果指定了学科，只获取该学科；否则获取所有学科标签供 AI 判断
        const prefetchedMathTags = (subject === '数学' || !subject) ? await getMathTagsFromDB(grade || null) : [];
        const prefetchedPhysicsTags = (subject === '物理' || !subject) ? await getTagsFromDB('physics') : [];
        const prefetchedChemistryTags = (subject === '化学' || !subject) ? await getTagsFromDB('chemistry') : [];
        const prefetchedBiologyTags = (subject === '生物' || !subject) ? await getTagsFromDB('biology') : [];
        const prefetchedEnglishTags = (subject === '英语' || !subject) ? await getTagsFromDB('english') : [];

        const prompt = generateAnalyzePrompt(language, grade, subject, {
            customTemplate: config.prompts?.analyze,
            prefetchedMathTags,
            prefetchedPhysicsTags,
            prefetchedChemistryTags,
            prefetchedBiologyTags,
            prefetchedEnglishTags,
        });

        console.log("\n" + "=".repeat(80));
        console.log("[Gemini] 🔍 AI Image Analysis Request");
        console.log("=".repeat(80));
        console.log("[Gemini] Image size:", imageBase64.length, "bytes");
        console.log("[Gemini] MimeType:", mimeType);
        console.log("[Gemini] Language:", language);
        console.log("[Gemini] Grade:", grade || "all");
        console.log("-".repeat(80));
        console.log("[Gemini] 📝 Full Prompt:");
        console.log(prompt);
        console.log("=".repeat(80) + "\n");

        try {
            const result = await this.model.generateContent({
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    data: imageBase64,
                                    mimeType: mimeType
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    // responseMimeType: "application/json",  // Disable JSON mode for XML output
                }
            });
            const response = await result.response;
            const text = response.text();

            console.log("\n" + "=".repeat(80));
            console.log("[Gemini] 🤖 AI Raw Response");
            console.log("=".repeat(80));
            console.log(text);
            console.log("=".repeat(80) + "\n");

            if (!text) throw new Error("Empty response from AI");
            const parsedResult = this.parseResponse(text);

            console.log("\n" + "=".repeat(80));
            console.log("[Gemini] ✅ Parsed & Validated Result");
            console.log("=".repeat(80));
            console.log(JSON.stringify(parsedResult, null, 2));
            console.log("=".repeat(80) + "\n");

            return parsedResult;

        } catch (error) {
            console.error("\n" + "=".repeat(80));
            console.error("[Gemini] ❌ Error during AI analysis");
            console.error("=".repeat(80));
            console.error(error);
            console.error("=".repeat(80) + "\n");
            this.handleError(error);
            throw error;
        }
    }

    async generateSimilarQuestion(originalQuestion: string, knowledgePoints: string[], language: 'zh' | 'en' = 'zh', difficulty: DifficultyLevel = 'medium'): Promise<ParsedQuestion> {
        const config = getAppConfig();
        const prompt = generateSimilarQuestionPrompt(language, originalQuestion, knowledgePoints, difficulty, {
            customTemplate: config.prompts?.similar
        });

        console.log("\n" + "=".repeat(80));
        console.log("[Gemini] 🎯 Generate Similar Question Request");
        console.log("=".repeat(80));
        console.log("[Gemini] Original Question:", originalQuestion.substring(0, 100) + "...");
        console.log("[Gemini] Knowledge Points:", knowledgePoints);
        console.log("[Gemini] Difficulty:", difficulty);
        console.log("[Gemini] Language:", language);
        console.log("-".repeat(80));
        console.log("[Gemini] 📝 Full Prompt:");
        console.log(prompt);
        console.log("=".repeat(80) + "\n");

        try {
            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    // responseMimeType: "application/json",  // Disable JSON mode for XML output
                }
            });
            const response = await result.response;
            const text = response.text();

            console.log("\n" + "=".repeat(80));
            console.log("[Gemini] 🤖 AI Raw Response");
            console.log("=".repeat(80));
            console.log(text);
            console.log("=".repeat(80) + "\n");

            if (!text) throw new Error("Empty response from AI");
            const parsedResult = this.parseResponse(text);

            console.log("\n" + "=".repeat(80));
            console.log("[Gemini] ✅ Parsed & Validated Result");
            console.log("=".repeat(80));
            console.log(JSON.stringify(parsedResult, null, 2));
            console.log("=".repeat(80) + "\n");

            return parsedResult;

        } catch (error) {
            console.error("\n" + "=".repeat(80));
            console.error("[Gemini] ❌ Error during question generation");
            console.error("=".repeat(80));
            console.error(error);
            console.error("=".repeat(80) + "\n");
            this.handleError(error);
            throw error;
        }
    }

    async reanswerQuestion(questionText: string, language: 'zh' | 'en' = 'zh', subject?: string | null, imageBase64?: string): Promise<{ answerText: string; analysis: string; knowledgePoints: string[] }> {
        const { generateReanswerPrompt } = await import('./prompts');
        const prompt = generateReanswerPrompt(language, questionText, subject);

        console.log("\n" + "=".repeat(80));
        console.log("[Gemini] 🔄 Reanswer Question Request");
        console.log("=".repeat(80));
        console.log("[Gemini] Question length:", questionText.length);
        console.log("[Gemini] Subject:", subject || "auto");
        console.log("[Gemini] Has image:", !!imageBase64);
        console.log("-".repeat(80));
        console.log("[Gemini] 📝 Full Prompt:");
        console.log(prompt);
        console.log("=".repeat(80) + "\n");

        try {
            // 根据是否有图片构建不同的请求内容
            let parts: any[] = [{ text: prompt }];
            if (imageBase64) {
                // 移除 data:image/xxx;base64, 前缀（如果存在）
                const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
                parts = [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
                ];
            }

            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts }],
            });
            const response = await result.response;
            const text = response.text();

            console.log("\n" + "=".repeat(80));
            console.log("[Gemini] 🤖 AI Raw Response");
            console.log("=".repeat(80));
            console.log(text);
            console.log("=".repeat(80) + "\n");

            if (!text) throw new Error("Empty response from AI");

            // 解析响应
            const answerText = this.extractTag(text, "answer_text") || "";
            const analysis = this.extractTag(text, "analysis") || "";
            const knowledgePointsRaw = this.extractTag(text, "knowledge_points") || "";
            const knowledgePoints = knowledgePointsRaw.split(/[,，\n]/).map(k => k.trim()).filter(k => k.length > 0);

            console.log("[Gemini] ✅ Reanswer parsed successfully");

            return { answerText, analysis, knowledgePoints };

        } catch (error) {
            console.error("[Gemini] ❌ Error during reanswer");
            console.error(error);
            this.handleError(error);
            throw error;
        }
    }

    private handleError(error: unknown) {
        console.error("Gemini Error:", error);
        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            if (msg.includes('fetch failed') || msg.includes('network') || msg.includes('connect') || msg.includes('503') || msg.includes('overloaded') || msg.includes('unavailable')) {
                throw new Error("AI_CONNECTION_FAILED");
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
}
