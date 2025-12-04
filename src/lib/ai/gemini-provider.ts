import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { AIService, ParsedQuestion, DifficultyLevel, AIConfig } from "./types";
import { jsonrepair } from 'jsonrepair';
import { generateAnalyzePrompt, generateSimilarQuestionPrompt } from './prompts';

export class GeminiProvider implements AIService {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;

    constructor(config?: AIConfig) {
        const apiKey = config?.apiKey;

        if (!apiKey) {
            throw new Error("GOOGLE_API_KEY is required for Gemini provider");
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: config?.model || 'gemini-1.5-flash' // Fallback for safety
        }, {
            baseUrl: config?.baseUrl
        });
    }

    private extractJson(text: string): string {
        let jsonString = text;

        // First try to extract from code blocks
        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
            jsonString = codeBlockMatch[1].trim();
        } else {
            // Find the first { and the MATCHING closing }
            const firstOpen = text.indexOf('{');
            if (firstOpen !== -1) {
                let braceCount = 0;
                let inString = false;
                let escapeNext = false;
                let closingIndex = -1;

                for (let i = firstOpen; i < text.length; i++) {
                    const char = text[i];

                    if (escapeNext) {
                        escapeNext = false;
                        continue;
                    }

                    if (char === '\\') {
                        escapeNext = true;
                        continue;
                    }

                    if (char === '"' && !escapeNext) {
                        inString = !inString;
                        continue;
                    }

                    if (!inString) {
                        if (char === '{') {
                            braceCount++;
                        } else if (char === '}') {
                            braceCount--;
                            if (braceCount === 0) {
                                closingIndex = i;
                                break;
                            }
                        }
                    }
                }

                if (closingIndex !== -1) {
                    jsonString = text.substring(firstOpen, closingIndex + 1);
                } else {
                    // Fallback to old method if bracket matching fails
                    const lastClose = text.lastIndexOf('}');
                    if (lastClose !== -1 && lastClose > firstOpen) {
                        jsonString = text.substring(firstOpen, lastClose + 1);
                    }
                }
            }
        }
        return jsonString;
    }

    private cleanJson(text: string): string {
        // 1. Remove markdown code blocks if present (already done by extractJson, but good to be safe)
        // 2. Fix multi-line strings: Replace literal newlines inside quotes with \n
        return text.replace(/"((?:[^"\\]|\\.)*)"/g, (match) => {
            return match.replace(/\n/g, "\\n").replace(/\r/g, "");
        });
    }

    private parseResponse(text: string): ParsedQuestion {
        const jsonString = this.extractJson(text);

        // Log for debugging
        console.log("[DEBUG] Parsing AI response");
        console.log("[DEBUG] Original text length:", text.length);
        console.log("[DEBUG] Extracted JSON length:", jsonString.length);
        console.log("[DEBUG] First 200 chars of extracted:", jsonString.substring(0, 200));

        try {
            // First try direct parse
            const parsed = JSON.parse(jsonString) as ParsedQuestion;
            console.log("[DEBUG] Direct parse succeeded");
            return parsed;
        } catch (error) {
            console.log("[DEBUG] Direct parse failed, trying jsonrepair");

            try {
                // Use jsonrepair to fix the JSON
                const repairedJson = jsonrepair(jsonString);
                console.log("[DEBUG] JSON repaired, length:", repairedJson.length);

                const parsed = JSON.parse(repairedJson) as ParsedQuestion;
                console.log("[DEBUG] Parse succeeded after repair");
                return parsed;
            } catch (repairError) {
                console.error("[ERROR] JSON repair also failed:", repairError);
                console.error("[ERROR] Original text (first 500 chars):", text.substring(0, 500));
                console.error("[ERROR] Extracted JSON (first 500 chars):", jsonString.substring(0, 500));
                throw new Error("Invalid JSON response from AI");
            }
        }
    }

    async analyzeImage(imageBase64: string, mimeType: string = "image/jpeg", language: 'zh' | 'en' = 'zh'): Promise<ParsedQuestion> {
        const prompt = generateAnalyzePrompt(language);

        try {
            const result = await this.model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: imageBase64,
                        mimeType: mimeType
                    }
                }
            ]);
            const response = await result.response;
            const text = response.text();

            if (!text) throw new Error("Empty response from AI");
            return this.parseResponse(text);

        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    async generateSimilarQuestion(originalQuestion: string, knowledgePoints: string[], language: 'zh' | 'en' = 'zh', difficulty: DifficultyLevel = 'medium'): Promise<ParsedQuestion> {
        const prompt = generateSimilarQuestionPrompt(language, originalQuestion, knowledgePoints, difficulty);

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            if (!text) throw new Error("Empty response from AI");
            return this.parseResponse(text);

        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    private handleError(error: unknown) {
        console.error("Gemini Error:", error);
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
