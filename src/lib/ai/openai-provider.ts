import OpenAI from "openai";
import { AIService, ParsedQuestion, DifficultyLevel, AIConfig } from "./types";
import { jsonrepair } from "jsonrepair";

export class OpenAIProvider implements AIService {
    private openai: OpenAI;
    private model: string;

    constructor(config?: AIConfig) {
        const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
        const baseURL = config?.baseUrl || process.env.OPENAI_BASE_URL;

        if (!apiKey) {
            console.warn("OPENAI_API_KEY is not set, OpenAI provider will fail if used.");
        }

        this.openai = new OpenAI({
            apiKey: apiKey || "dummy-key", // Prevent crash on init if key missing but provider not used
            baseURL: baseURL || undefined,
        });

        this.model = config?.model || process.env.OPENAI_MODEL || "gpt-4o";
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
        const langInstruction = language === 'zh'
            ? "IMPORTANT: For the 'analysis' field, use Simplified Chinese. For 'questionText' and 'answerText', YOU MUST USE THE SAME LANGUAGE AS THE ORIGINAL QUESTION. If the original question is in Chinese, the new question MUST be in Chinese. If the original is in English, keep it in English."
            : "Please ensure all text fields are in English.";

        const systemPrompt = `
    You are an expert AI tutor for middle school students.
    Analyze the provided image of a homework or exam problem.
    
    ${langInstruction}
    
    Please extract the following information and return it in valid JSON format:
    1. "questionText": The full text of the question. Use Markdown format for better readability. Use LaTeX notation for mathematical formulas (inline: $formula$, block: $$formula$$).
    2. "answerText": The correct answer to the question. Use Markdown and LaTeX where appropriate.
    3. "analysis": A step-by-step explanation of how to solve the problem. 
       - Use Markdown formatting (headings, lists, bold, etc.) for clarity
       - Use LaTeX for all mathematical formulas and expressions
       - Example: "The solution is $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$"
       - For block formulas, use $$...$$
    4. "subject": The subject of the question. Choose ONE from: "数学", "物理", "化学", "生物", "英语", "语文", "历史", "地理", "政治", "其他".
    5. "knowledgePoints": An array of knowledge points. STRICTLY use EXACT terms from the standard list below:
       
       **数学标签 (Math Tags):**
       - 方程: "一元一次方程", "一元二次方程", "分式方程"
       - 几何: "勾股定理", "相似三角形", "全等三角形", "圆", "三视图", "平行四边形", "矩形", "菱形"
       - 函数: "二次函数", "一次函数", "反比例函数", "二次函数的图像", "二次函数的性质"
       - 数值: "绝对值", "有理数", "实数", "科学计数法"
       - 统计: "概率", "平均数", "中位数", "方差"
       
       **物理标签 (Physics Tags):**
       - 力学: "匀速直线运动", "变速运动", "牛顿第一定律", "牛顿第二定律", "牛顿第三定律", "力", "压强", "浮力"
       - 电学: "欧姆定律", "串联电路", "并联电路", "电功率", "电功"
       - 光学: "光的反射", "光的折射", "凸透镜", "凹透镜"
       - 热学: "温度", "内能", "比热容", "热机效率"
       
       **化学标签 (Chemistry Tags):**
       - "化学方程式", "氧化还原反应", "酸碱盐", "中和反应", "金属", "非金属", "溶解度"
       
       **英语标签 (English Tags):**
       - "语法", "词汇", "阅读理解", "完形填空", "写作", "听力", "翻译"

       **其他学科 (Other Subjects):**
       - If the subject is NOT Math, Physics, or Chemistry, you may use appropriate general tags (e.g., "历史事件", "地理常识", "古诗文").
       
       **IMPORTANT RULES:**
       - For Math/Physics/Chemistry, use EXACT matches from the list above.
       - For English and other subjects, use the provided tags or relevant standard terms.
       - For "三视图" questions, use ONLY "三视图", NOT "左视图", "主视图", or "俯视图"
       - For force questions, use specific tags like "力", "牛顿第一定律", NOT generic "力学"
       - Maximum 5 tags per question
       
    CRITICAL FORMATTING REQUIREMENTS:  
    - Return ONLY the JSON object, nothing else
    - Do NOT add any text before or after the JSON
    - Do NOT wrap the JSON in markdown code blocks
    - Do NOT add explanatory text like "The final answer is..."
    - Ensure all backslashes in LaTeX are properly escaped (use \\\\ instead of \\)
    - Ensure all strings are properly escaped
    - NO literal newlines in strings. Use \\n for newlines.
    
    IMPORTANT: 
    - If the image contains a question with multiple sub-questions (like (1), (2), (3)), include ALL sub-questions in the questionText field.
    - If the image contains completely separate questions (different question numbers), only analyze the first complete question with all its sub-questions.
    - If the image is unclear or does not contain a question, return empty strings but valid JSON.
  `;

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
        const langInstruction = language === 'zh'
            ? "IMPORTANT: For the 'analysis' field, use Simplified Chinese. For 'questionText' and 'answerText', YOU MUST USE THE SAME LANGUAGE AS THE ORIGINAL QUESTION. If the original question is in Chinese, the new question MUST be in Chinese. If the original is in English, keep it in English."
            : "Please ensure all text fields are in English.";

        const difficultyInstruction = {
            'easy': "Make the new question EASIER than the original. Use simpler numbers and more direct concepts.",
            'medium': "Keep the difficulty SIMILAR to the original question.",
            'hard': "Make the new question HARDER than the original. Combine multiple concepts or use more complex numbers.",
            'harder': "Make the new question MUCH HARDER (Challenge Level). Require deeper understanding and multi-step reasoning."
        }[difficulty];

        const systemPrompt = `
    You are an expert AI tutor.
    Create a NEW practice problem based on the following original question and knowledge points.
    
    DIFFICULTY LEVEL: ${difficulty.toUpperCase()}
    ${difficultyInstruction}
    
    ${langInstruction}

    IMPORTANT: 
    1. The "Original Question" provided below is in **Markdown format** and contains **LaTeX formulas**.
    2. You must **parse the semantic meaning** of the text and formulas first. convert it to plain text in your mind to understand the core concept.
    3. Do NOT let the raw Markdown/LaTeX syntax influence the structure of the new question.
    4. The new question MUST be solvable purely by text and math formulas. DO NOT generate questions that require looking at an image or diagram (e.g., geometry problems relying on visual figures).
    
    Return the result in valid JSON format with the following fields:
    1. "questionText": The text of the new question. IMPORTANT: If the original question is a multiple-choice question, you MUST include the options (A, B, C, D) in this field as well. Format them clearly (e.g., using \\n for new lines).
    2. "answerText": The correct answer.
    3. "analysis": Step-by-step solution.
    4. "knowledgePoints": The knowledge points (should match input).
    
    CRITICAL FORMATTING REQUIREMENTS:
    - Return ONLY the JSON object, nothing else
    - Do NOT add any text before or after the JSON
    - Do NOT wrap the JSON in markdown code blocks
    - NO literal newlines in strings. Use \\n for newlines.
  `;

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
