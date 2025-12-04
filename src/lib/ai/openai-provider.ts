import OpenAI from "openai";
import { AIService, ParsedQuestion, DifficultyLevel, AIConfig } from "./types";
import { jsonrepair } from "jsonrepair";
import { generateAnalyzePrompt, generateSimilarQuestionPrompt } from './prompts';

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

    private cleanJson(text: string): string {
        // Fix multi-line strings: Replace literal newlines inside quotes with \n
        return text.replace(/"((?:[^"\\]|\\.)*)"/g, (match) => {
            return match.replace(/\n/g, "\\n").replace(/\r/g, "");
        });
    }

    private parseResponse(text: string): ParsedQuestion {
        const jsonString = this.extractJson(text);
        try {
            // First try parsing as is
            return JSON.parse(jsonString) as ParsedQuestion;
        } catch (error) {
            try {
                // Try using jsonrepair
                const repaired = jsonrepair(jsonString);
                return JSON.parse(repaired) as ParsedQuestion;
            } catch (repairError) {
                try {
                    // Fallback to manual cleaning if repair fails
                    // Fix: Only escape backslashes that are NOT followed by valid JSON escape characters
                    // Specifically handle \u: only consider it valid if followed by 4 hex digits
                    let fixedJson = this.cleanJson(jsonString);
                    fixedJson = fixedJson.replace(/\\(?!(["\\/bfnrt]|u[0-9a-fA-F]{4}))/g, '\\\\');

                    return JSON.parse(fixedJson) as ParsedQuestion;
                } catch (finalError) {
                    console.error("JSON parse failed:", finalError);
                    console.error("Original text:", text);
                    console.error("Extracted text:", jsonString);

                    // Log to file for debugging
                    try {
                        const fs = require('fs');
                        const path = require('path');
                        const logPath = path.join(process.cwd(), 'debug_ai_response.log');
                        const logContent = `\n\n--- ${new Date().toISOString()} ---\nError: ${finalError}\nOriginal: ${text}\nExtracted: ${jsonString}\n`;
                        fs.appendFileSync(logPath, logContent);
                    } catch (e) {
                        console.error("Failed to write debug log:", e);
                    }

                    throw new Error("Invalid JSON response from AI");
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
