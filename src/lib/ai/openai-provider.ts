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

        // Try to match standard markdown code block
        const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1].trim();
        }

        // Try to match start of code block without end (truncated)
        const startMatch = jsonString.match(/```(?:json)?\s*([\s\S]*)/);
        if (startMatch) {
            jsonString = startMatch[1].trim();
        }

        // Find first '{' and last '}'
        const firstOpen = jsonString.indexOf('{');
        const lastClose = jsonString.lastIndexOf('}');

        if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
            return jsonString.substring(firstOpen, lastClose + 1);
        }

        // If we found a start but no end, and it looks like JSON, return from start
        if (firstOpen !== -1) {
            return jsonString.substring(firstOpen);
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

    async analyzeImage(imageBase64: string, mimeType: string = "image/jpeg", language: 'zh' | 'en' = 'zh'): Promise<ParsedQuestion> {
        const systemPrompt = generateAnalyzePrompt(language);

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
            if (!text) throw new Error("Empty response from AI");
            return this.parseResponse(text);

        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    async generateSimilarQuestion(originalQuestion: string, knowledgePoints: string[], language: 'zh' | 'en' = 'zh', difficulty: DifficultyLevel = 'medium'): Promise<ParsedQuestion> {
        const systemPrompt = generateSimilarQuestionPrompt(language, originalQuestion, knowledgePoints, difficulty);

        const userPrompt = `
    Original Question: "${originalQuestion}"
    Knowledge Points: ${knowledgePoints.join(", ")}
        `;

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
            console.log("OpenAI Raw Response:", text); // Debug logging
            if (!text) throw new Error("Empty response from AI");
            return this.parseResponse(text);

        } catch (error) {
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
