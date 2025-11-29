import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { AIService, ParsedQuestion, DifficultyLevel, AIConfig } from "./types";
import { jsonrepair } from 'jsonrepair';

export class GeminiProvider implements AIService {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;

    constructor(config?: AIConfig) {
        const apiKey = config?.apiKey || process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            console.warn("GOOGLE_API_KEY is not set, Gemini provider will fail if used.");
        }

        this.genAI = new GoogleGenerativeAI(apiKey || "dummy-key");
        this.model = this.genAI.getGenerativeModel({
            model: config?.model || process.env.GEMINI_MODEL || "gemini-1.5-flash"
        }, {
            baseUrl: config?.baseUrl || process.env.GEMINI_BASE_URL
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
        const langInstruction = language === 'zh'
            ? "IMPORTANT: For the 'analysis' field, use Simplified Chinese. For 'questionText' and 'answerText', YOU MUST USE THE SAME LANGUAGE AS THE ORIGINAL QUESTION. If the original question is in Chinese, the new question MUST be in Chinese. If the original is in English, keep it in English."
            : "Please ensure all text fields are in English.";

        const prompt = `
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
       - 方程: "一元一次方程", "一元二次方程", "二元一次方程组", "分式方程"
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
       
       **IMPORTANT RULES:**
       - Use EXACT matches from the list above - do NOT create variations
       - For "三视图" questions, use ONLY "三视图", NOT "左视图", "主视图", or "俯视图"
       - For force questions, use specific tags like "力", "牛顿第一定律", NOT generic "力学"
       - Maximum 5 tags per question
       - Each tag must be from the standard list

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
        const langInstruction = language === 'zh'
            ? "IMPORTANT: For the 'analysis' field, use Simplified Chinese. For 'questionText' and 'answerText', YOU MUST USE THE SAME LANGUAGE AS THE ORIGINAL QUESTION. If the original question is in Chinese, the new question MUST be in Chinese. If the original is in English, keep it in English."
            : "Please ensure all text fields are in English.";

        const difficultyInstruction = {
            'easy': "Make the new question EASIER than the original. Use simpler numbers and more direct concepts.",
            'medium': "Keep the difficulty SIMILAR to the original question.",
            'hard': "Make the new question HARDER than the original. Combine multiple concepts or use more complex numbers.",
            'harder': "Make the new question MUCH HARDER (Challenge Level). Require deeper understanding and multi-step reasoning."
        }[difficulty];

        const prompt = `
    You are an expert AI tutor.
    Create a NEW practice problem based on the following original question and knowledge points.
    
    DIFFICULTY LEVEL: ${difficulty.toUpperCase()}
    ${difficultyInstruction}
    
    ${langInstruction}
    
    Original Question: "${originalQuestion}"
    Knowledge Points: ${knowledgePoints.join(", ")}
    
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
