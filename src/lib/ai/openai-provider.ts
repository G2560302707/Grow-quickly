import OpenAI from "openai";
import { AIService, ParsedQuestion, DifficultyLevel, AIConfig } from "./types";
import { jsonrepair } from "jsonrepair";
import { generateAnalyzePrompt, generateSimilarQuestionPrompt } from './prompts';
import { validateParsedQuestion, safeParseParsedQuestion } from './schema';

export class OpenAIProvider implements AIService {
    private openai: OpenAI;
    private model: string;

    constructor(config?: AIConfig) {
        const apiKey = config?.apiKey;
        const baseURL = config?.baseUrl;

        if (!apiKey) {
            throw new Error("OPENAI_API_KEY is required for OpenAI provider");
        }

        this.openai = new OpenAI({
            apiKey: apiKey,
            baseURL: baseURL || undefined,
        });

        this.model = config?.model || 'gpt-4o'; // Fallback for safety
    }

    private extractJson(text: string): string {
        let jsonString = text.trim();

        // 首先尝试移除 markdown 代码块标记（包括可能不完整的）
        // 匹配 ```json 或 ``` 开头，以及可能的 ``` 结尾
        const codeBlockPattern = /^```(?:json)?\s*\n?([\s\S]*?)(?:\n?```)?$/;
        const match = jsonString.match(codeBlockPattern);
        if (match) {
            jsonString = match[1].trim();
            console.log("[OpenAI] Removed markdown code block wrapper");
        }

        // 如果还有 ``` 在开头或结尾，再清理一次
        if (jsonString.startsWith('```')) {
            jsonString = jsonString.substring(3).trim();
        }
        if (jsonString.endsWith('```')) {
            jsonString = jsonString.substring(0, jsonString.length - 3).trim();
        }

        // 找到第一个 { 和最后一个 }
        const firstOpen = jsonString.indexOf('{');
        const lastClose = jsonString.lastIndexOf('}');

        if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
            jsonString = jsonString.substring(firstOpen, lastClose + 1);
        }

        return jsonString;
    }

    private parseResponse(text: string): ParsedQuestion {
        console.log("[OpenAI] Parsing AI response, length:", text.length);

        try {
            // With JSON mode enabled, response should be valid JSON
            const parsed = JSON.parse(text);

            // Validate with Zod schema
            const result = safeParseParsedQuestion(parsed);

            if (result.success) {
                console.log("[OpenAI] ✓ Direct parse and validation succeeded");
                return result.data;
            } else {
                console.warn("[OpenAI] ⚠ Validation failed:", result.error.format());
                // Try to extract JSON from potential markdown wrapping
                const extracted = this.extractJson(text);
                const parsedExtracted = JSON.parse(extracted);
                return validateParsedQuestion(parsedExtracted);
            }
        } catch (error) {
            console.warn("[OpenAI] ⚠ Direct parse failed, attempting extraction");

            try {
                // Fallback: extract JSON from markdown or text
                const jsonString = this.extractJson(text);
                const parsed = JSON.parse(jsonString);
                return validateParsedQuestion(parsed);
            } catch (extractError) {
                console.warn("[OpenAI] ⚠ Extraction failed, trying jsonrepair");

                try {
                    // Last resort: use jsonrepair
                    const jsonString = this.extractJson(text);
                    const repairedJson = jsonrepair(jsonString);
                    const parsed = JSON.parse(repairedJson);
                    return validateParsedQuestion(parsed);
                } catch (finalError) {
                    console.error("[OpenAI] ✗ All parsing attempts failed");
                    console.error("[OpenAI] Original text (first 500 chars):", text.substring(0, 500));
                    throw new Error("Invalid JSON response from AI: Unable to parse or validate");
                }
            }
        }
    }

    async analyzeImage(imageBase64: string, mimeType: string = "image/jpeg", language: 'zh' | 'en' = 'zh', grade?: 7 | 8 | 9 | null, subject?: string | null): Promise<ParsedQuestion> {
        const systemPrompt = generateAnalyzePrompt(language, grade, subject);

        console.log("\n" + "=".repeat(80));
        console.log("[OpenAI] 🔍 AI Image Analysis Request");
        console.log("=".repeat(80));
        console.log("[OpenAI] Image size:", imageBase64.length, "bytes");
        console.log("[OpenAI] MimeType:", mimeType);
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
                response_format: { type: "json_object" },
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
        const systemPrompt = generateSimilarQuestionPrompt(language, originalQuestion, knowledgePoints, difficulty);
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
                response_format: { type: "json_object" },
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
