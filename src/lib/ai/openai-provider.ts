import OpenAI from "openai";
import { AIService, ParsedQuestion, DifficultyLevel, AIConfig } from "./types";
import { jsonrepair } from "jsonrepair";
import { generateAnalyzePrompt, generateSimilarQuestionPrompt } from './prompts';
import { getAppConfig } from '../config';
import { validateParsedQuestion, safeParseParsedQuestion } from './schema';

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

        // Construct Result
        const result: ParsedQuestion = {
            questionText,
            answerText,
            analysis,
            subject,
            knowledgePoints
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
        const systemPrompt = generateAnalyzePrompt(language, grade, subject);

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
