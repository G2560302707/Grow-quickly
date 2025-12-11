// Re-export the Zod-validated type from schema.ts
export type { ParsedQuestionFromSchema as ParsedQuestion } from './schema';
import type { ParsedQuestionFromSchema } from './schema';

// Legacy interface kept for backward compatibility (deprecated)
/** @deprecated Use ParsedQuestion from schema.ts instead */
export interface ParsedQuestionLegacy {
    questionText: string;
    answerText: string;
    analysis: string;
    knowledgePoints: string[];
    subject?: string;
}

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'harder';

export interface AIService {
    analyzeImage(imageBase64: string, mimeType?: string, language?: 'zh' | 'en', grade?: 7 | 8 | 9 | 10 | 11 | 12 | null, subject?: string | null): Promise<ParsedQuestionFromSchema>;
    generateSimilarQuestion(originalQuestion: string, knowledgePoints: string[], language?: 'zh' | 'en', difficulty?: DifficultyLevel): Promise<ParsedQuestionFromSchema>;
}

export interface AIConfig {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
}
