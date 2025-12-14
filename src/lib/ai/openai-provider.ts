import OpenAI from "openai";
import { AIService, ParsedQuestion, DifficultyLevel, AIConfig } from "./types";
import { jsonrepair } from "jsonrepair";
import { generateAnalyzePrompt, generateSimilarQuestionPrompt } from './prompts';
import { getAppConfig } from '../config';
import { validateParsedQuestion, safeParseParsedQuestion } from './schema';
import { getMathTagsFromDB, getTagsFromDB } from './tag-service';

export class OpenAIProvider implements AIService {
    private openai: OpenAI;
    private model: string;

    constructor(config?: AIConfig) {
        const apiKey = config?.apiKey;
        const baseURL = config?.baseUrl;

        if (!apiKey) {
            throw new Error("AI_AUTH_ERROR: OPENAI_API_KEY is required for OpenAI provider");
        }

        this.openai = new OpenAI({
            apiKey: apiKey,
            baseURL: baseURL || undefined,
            defaultHeaders: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        this.model = config?.model || 'gpt-4o'; // Fallback for safety
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
        console.log("[OpenAI] Parsing AI response, length:", text.length);

        const questionText = this.extractTag(text, "question_text");
        const answerText = this.extractTag(text, "answer_text");
        const analysis = this.extractTag(text, "analysis");
        const subjectRaw = this.extractTag(text, "subject");
        const knowledgePointsRaw = this.extractTag(text, "knowledge_points");
        const requiresImageRaw = this.extractTag(text, "requires_image");

        // Basic Validation
        if (!questionText || !answerText || !analysis) {
            console.error("[OpenAI] ✗ Missing critical XML tags");
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

        // Final Schema Validation (just to be safe, though likely compliant by now)
        const validation = safeParseParsedQuestion(result);
        if (validation.success) {
            console.log("[OpenAI] ✓ Validated successfully via XML tags");
            return validation.data;
        } else {
            console.warn("[OpenAI] ⚠ Schema validation warning:", validation.error.format());
            // We still return it as we trust our extraction more than the schema at this point (or we can throw)
            // Let's return the extracted data to be permissive
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

        const systemPrompt = generateAnalyzePrompt(language, grade, subject, {
            customTemplate: config.prompts?.analyze,
            prefetchedMathTags,
            prefetchedPhysicsTags,
            prefetchedChemistryTags,
            prefetchedBiologyTags,
            prefetchedEnglishTags,
        });

        console.log("\n" + "=".repeat(80));
        console.log("[OpenAI] 🔍 AI Image Analysis Request");
        console.log("=".repeat(80));
        console.log("[OpenAI] Image size:", imageBase64.length, "bytes");
        console.log("[OpenAI] MimeType:", mimeType);
        console.log("[OpenAI] Model:", this.model);
        console.log("[OpenAI] Language:", language);
        console.log("[OpenAI] Grade:", grade || "all");
        console.log("-".repeat(80));
        console.log("[OpenAI] 📝 Full System Prompt:");
        console.log(systemPrompt);
        console.log("=".repeat(80) + "\n");

        try {
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,${imageBase64}`,
                                },
                            },
                        ],
                    },
                ],
                // response_format: { type: "json_object" }, // Removing to improve compatibility with 3rd party providers
                max_tokens: 4096,
            });

            // 调试：打印完整响应对象
            console.log("\n[OpenAI] 📦 Full API Response:");
            console.log("Response object:", response);
            console.log("Response stringified:", JSON.stringify(response, null, 2));

            // 检查响应是否有效
            if (!response || !response.choices || response.choices.length === 0) {
                console.error("[OpenAI] ❌ Invalid API response - no choices array");
                console.error("[OpenAI] Response was:", JSON.stringify(response));
                throw new Error("AI_RESPONSE_ERROR: API returned empty or invalid response");
            }

            const text = response.choices[0]?.message?.content || "";

            console.log("\n" + "=".repeat(80));
            console.log("[OpenAI] 🤖 AI Raw Response");
            console.log("=".repeat(80));
            console.log(text);
            console.log("=".repeat(80) + "\n");

            if (!text) throw new Error("Empty response from AI");
            const parsedResult = this.parseResponse(text);

            console.log("\n" + "=".repeat(80));
            console.log("[OpenAI] ✅ Parsed & Validated Result");
            console.log("=".repeat(80));
            console.log(JSON.stringify(parsedResult, null, 2));
            console.log("=".repeat(80) + "\n");

            return parsedResult;

        } catch (error) {
            console.error("\n" + "=".repeat(80));
            console.error("[OpenAI] ❌ Error during AI analysis");
            console.error("=".repeat(80));
            console.error(error);
            console.error("=".repeat(80) + "\n");
            this.handleError(error);
            throw error;
        }
    }

    async generateSimilarQuestion(originalQuestion: string, knowledgePoints: string[], language: 'zh' | 'en' = 'zh', difficulty: DifficultyLevel = 'medium'): Promise<ParsedQuestion> {
        const config = getAppConfig();
        const systemPrompt = generateSimilarQuestionPrompt(language, originalQuestion, knowledgePoints, difficulty, {
            customTemplate: config.prompts?.similar
        });
        const userPrompt = `\nOriginal Question: "${originalQuestion}"\nKnowledge Points: ${knowledgePoints.join(", ")}\n    `;

        console.log("\n" + "=".repeat(80));
        console.log("[OpenAI] 🎯 Generate Similar Question Request");
        console.log("=".repeat(80));
        console.log("[OpenAI] Original Question:", originalQuestion.substring(0, 100) + "...");
        console.log("[OpenAI] Knowledge Points:", knowledgePoints);
        console.log("[OpenAI] Difficulty:", difficulty);
        console.log("[OpenAI] Language:", language);
        console.log("-".repeat(80));
        console.log("[OpenAI] 📝 Full System Prompt:");
        console.log(systemPrompt);
        console.log("-".repeat(80));
        console.log("[OpenAI] 📝 User Prompt:");
        console.log(userPrompt);
        console.log("=".repeat(80) + "\n");

        try {
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                // response_format: { type: "json_object" }, // Removing to improve compatibility with 3rd party providers
                max_tokens: 4096,
            });

            const text = response.choices[0]?.message?.content || "";

            console.log("\n" + "=".repeat(80));
            console.log("[OpenAI] 🤖 AI Raw Response");
            console.log("=".repeat(80));
            console.log(text);
            console.log("=".repeat(80) + "\n");

            if (!text) throw new Error("Empty response from AI");
            const parsedResult = this.parseResponse(text);

            console.log("\n" + "=".repeat(80));
            console.log("[OpenAI] ✅ Parsed & Validated Result");
            console.log("=".repeat(80));
            console.log(JSON.stringify(parsedResult, null, 2));
            console.log("=".repeat(80) + "\n");

            return parsedResult;

        } catch (error) {
            console.error("\n" + "=".repeat(80));
            console.error("[OpenAI] ❌ Error during question generation");
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
        console.log("[OpenAI] 🔄 Reanswer Question Request");
        console.log("=".repeat(80));
        console.log("[OpenAI] Question length:", questionText.length);
        console.log("[OpenAI] Subject:", subject || "auto");
        console.log("[OpenAI] Has image:", !!imageBase64);
        console.log("-".repeat(80));
        console.log("[OpenAI] 📝 Full Prompt:");
        console.log(prompt);
        console.log("=".repeat(80) + "\n");

        try {
            // 根据是否有图片构建不同的消息内容
            let userContent: any = "请根据上述题目提供答案和解析。";
            if (imageBase64) {
                // 如果有图片，构建多模态消息
                const imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
                console.log("[OpenAI] 🖼️ 图片已添加到请求中，图片数据长度:", imageUrl.length);
                userContent = [
                    { type: "text", text: "请结合图片和题目描述提供答案和解析。" },
                    { type: "image_url", image_url: { url: imageUrl } }
                ];
            } else {
                console.log("[OpenAI] ⚠️ 没有图片数据，imageBase64 为:", typeof imageBase64, imageBase64 ? "有值" : "空");
            }

            // 打印请求参数
            const requestParams = {
                model: this.model,
                messages: [
                    { role: "system", content: prompt.substring(0, 200) + "..." },
                    { role: "user", content: typeof userContent === 'string' ? userContent : "[包含图片的多模态消息]" }
                ],
                max_tokens: 4096
            };
            console.log("\n[OpenAI] 📤 Request Parameters:");
            console.log(JSON.stringify(requestParams, null, 2));

            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    { role: "system", content: prompt },
                    { role: "user", content: userContent }
                ],
                max_tokens: 4096,
            });

            // 打印完整响应
            console.log("\n[OpenAI] 📥 Full API Response:");
            console.log("Response type:", typeof response);
            console.log("Response:", JSON.stringify(response, null, 2));

            // 检查响应是否有效
            if (!response || !response.choices || response.choices.length === 0) {
                console.error("[OpenAI] ❌ Invalid API response - no choices array");
                console.error("[OpenAI] Response was:", JSON.stringify(response));
                throw new Error("AI_RESPONSE_ERROR: API returned empty or invalid response");
            }

            const text = response.choices[0]?.message?.content || "";

            console.log("\n" + "=".repeat(80));
            console.log("[OpenAI] 🤖 AI Raw Response");
            console.log("=".repeat(80));
            console.log(text);
            console.log("=".repeat(80) + "\n");

            if (!text) throw new Error("Empty response from AI");

            // 解析响应
            const answerText = this.extractTag(text, "answer_text") || "";
            const analysis = this.extractTag(text, "analysis") || "";
            const knowledgePointsRaw = this.extractTag(text, "knowledge_points") || "";
            const knowledgePoints = knowledgePointsRaw.split(/[,，\n]/).map(k => k.trim()).filter(k => k.length > 0);

            console.log("[OpenAI] ✅ Reanswer parsed successfully");

            return { answerText, analysis, knowledgePoints };

        } catch (error) {
            console.error("[OpenAI] ❌ Error during reanswer");
            console.error(error);
            this.handleError(error);
            throw error;
        }
    }

    private handleError(error: unknown) {
        console.error("OpenAI Error:", error);
        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            if (msg.includes('fetch failed') || msg.includes('network') || msg.includes('connect')) {
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

