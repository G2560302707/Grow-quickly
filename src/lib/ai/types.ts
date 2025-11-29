export interface ParsedQuestion {
    questionText: string;
    answerText: string;
    analysis: string;
    knowledgePoints: string[];
    subject?: string;
}

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'harder';

export interface AIService {
    analyzeImage(imageBase64: string, mimeType?: string, language?: 'zh' | 'en'): Promise<ParsedQuestion>;
    generateSimilarQuestion(originalQuestion: string, knowledgePoints: string[], language?: 'zh' | 'en', difficulty?: DifficultyLevel): Promise<ParsedQuestion>;
}

export interface AIConfig {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
}
