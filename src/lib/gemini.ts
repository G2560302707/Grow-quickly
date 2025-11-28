import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

export interface ParsedQuestion {
    questionText: string;
    answerText: string;
    analysis: string;
    knowledgePoints: string[];
}

export async function analyzeImage(imageBase64: string, mimeType: string = "image/jpeg", language: 'zh' | 'en' = 'zh'): Promise<ParsedQuestion> {
    if (!process.env.GOOGLE_API_KEY) {
        throw new Error("GOOGLE_API_KEY is not set");
    }

    const langInstruction = language === 'zh'
        ? "Please ensure all text fields (questionText, answerText, analysis) are in Simplified Chinese."
        : "Please ensure all text fields are in English.";

    const prompt = `
    You are an expert AI tutor for middle school students.
    Analyze the provided image of a homework or exam problem.
    
    ${langInstruction}
    
    Please extract the following information and return it in valid JSON format:
    1. "questionText": The full text of the question, including any formulas (use LaTeX for formulas).
    2. "answerText": The correct answer to the question.
    3. "analysis": A step-by-step explanation of how to solve the problem.
    4. "knowledgePoints": An array of specific knowledge points or concepts tested in this question (e.g., "Pythagorean Theorem", "Linear Equations").

    If the image contains multiple questions, only analyze the first complete one.
    If the image is unclear or does not contain a question, return empty strings but valid JSON.
    
    Output ONLY the JSON object, no markdown formatting.
  `;

    const contents = [
        {
            inlineData: {
                mimeType: mimeType,
                data: imageBase64,
            },
        },
        { text: prompt },
    ];

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: contents,
        });

        // Safe text extraction for @google/genai SDK
        let text = "";
        if (response.text) {
            // @ts-ignore - SDK type inference issue
            text = typeof response.text === 'function' ? response.text() : response.text;
        } else if (response.candidates && response.candidates.length > 0) {
            const candidate = response.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                text = candidate.content.parts[0].text || "";
            }
        }

        if (!text) {
            throw new Error("Empty response from AI");
        }

        console.log("[Gemini] Raw response (first 500 chars):", text.substring(0, 500));

        // Clean up potential markdown code blocks
        let jsonString = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

        // Try to extract JSON object if embedded in other text
        const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonString = jsonMatch[0];
        }

        console.log("[Gemini] Parsed JSON (first 300 chars):", jsonString.substring(0, 300));

        // Fix common JSON escaping issues with LaTeX
        // LaTeX commands like \frac, \sqrt need to be properly escaped in JSON
        // But be careful not to break already valid escape sequences
        try {
            // First attempt: try parsing as-is
            return JSON.parse(jsonString) as ParsedQuestion;
        } catch (firstError) {
            console.log("[Gemini] First parse attempt failed, trying to fix escaping...");

            try {
                // Second attempt: fix common LaTeX escaping issues
                // This is a heuristic fix - replace single backslash with double for LaTeX commands
                const fixedJson = jsonString
                    .replace(/\\([a-zA-Z]+)/g, '\\\\$1') // \frac -> \\frac
                    .replace(/\\\\\\\\/g, '\\\\'); // Fix over-escaping (\\\\ -> \\)

                console.log("[Gemini] Attempting parse with fixed escaping...");
                return JSON.parse(fixedJson) as ParsedQuestion;
            } catch (secondError) {
                console.error("[Gemini] JSON parse failed after fix attempt:", secondError);
                console.error("[Gemini] Original JSON (first 500):", jsonString.substring(0, 500));
                console.error("[Gemini] Original JSON (last 500):", jsonString.substring(Math.max(0, jsonString.length - 500)));
                throw new Error("Invalid JSON response from AI");
            }
        }
    } catch (error) {
        console.error("Error analyzing image with Gemini:", error);

        // Provide more specific error messages
        if (error instanceof Error) {
            const errorMessage = error.message.toLowerCase();

            if (errorMessage.includes('fetch failed') ||
                errorMessage.includes('network') ||
                errorMessage.includes('econnrefused') ||
                errorMessage.includes('ssl_error')) {
                throw new Error("AI_CONNECTION_FAILED: Unable to connect to AI service. Please check your internet connection or proxy settings.");
            }

            if (errorMessage.includes('invalid json') || errorMessage.includes('parse')) {
                throw new Error("AI_RESPONSE_ERROR: AI returned invalid response. Please try again.");
            }

            if (errorMessage.includes('api key') || errorMessage.includes('unauthorized')) {
                throw new Error("AI_AUTH_ERROR: Invalid API key. Please check your configuration.");
            }
        }

        throw new Error("AI_UNKNOWN_ERROR: Failed to analyze image. Please try again later.");
    }
}

export async function generateSimilarQuestion(originalQuestion: string, knowledgePoints: string[], language: 'zh' | 'en' = 'zh'): Promise<ParsedQuestion> {
    if (!process.env.GOOGLE_API_KEY) {
        throw new Error("GOOGLE_API_KEY is not set");
    }

    const langInstruction = language === 'zh'
        ? "Please ensure all text fields are in Simplified Chinese."
        : "Please ensure all text fields are in English.";

    const prompt = `
    You are an expert AI tutor.
    Create a NEW practice problem based on the following original question and knowledge points.
    The new problem should test the same concepts but use different numbers or a slightly different scenario.
    
    ${langInstruction}
    
    Original Question: "${originalQuestion}"
    Knowledge Points: ${knowledgePoints.join(", ")}
    
    Return the result in valid JSON format with the following fields:
    1. "questionText": The text of the new question.
    2. "answerText": The correct answer.
    3. "analysis": Step-by-step solution.
    4. "knowledgePoints": The knowledge points (should match input).
    
    Output ONLY the JSON object.
  `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ text: prompt }],
        });

        // Safe text extraction
        let text = "";
        if (response.text) {
            // @ts-ignore - SDK type inference issue
            text = typeof response.text === 'function' ? response.text() : response.text;
        } else if (response.candidates && response.candidates.length > 0) {
            const candidate = response.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                text = candidate.content.parts[0].text || "";
            }
        }

        if (!text) {
            throw new Error("Empty response from AI");
        }

        const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();

        return JSON.parse(jsonString) as ParsedQuestion;
    } catch (error) {
        console.error("Error generating similar question:", error);

        // Provide more specific error messages
        if (error instanceof Error) {
            const errorMessage = error.message.toLowerCase();

            if (errorMessage.includes('fetch failed') ||
                errorMessage.includes('network') ||
                errorMessage.includes('econnrefused') ||
                errorMessage.includes('ssl_error')) {
                throw new Error("AI_CONNECTION_FAILED: Unable to connect to AI service. Please check your internet connection or proxy settings.");
            }

            if (errorMessage.includes('invalid json') || errorMessage.includes('parse')) {
                throw new Error("AI_RESPONSE_ERROR: AI returned invalid response. Please try again.");
            }

            if (errorMessage.includes('api key') || errorMessage.includes('unauthorized')) {
                throw new Error("AI_AUTH_ERROR: Invalid API key. Please check your configuration.");
            }
        }

        throw new Error("AI_UNKNOWN_ERROR: Failed to generate question. Please try again later.");
    }
}
