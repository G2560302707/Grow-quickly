export interface ParsedQuestion {
    questionText: string;
    answerText: string;
    analysis: string;
    knowledgePoints: string[];
    subject?: string;
}

export interface AIService {
    analyzeImage(imageBase64: string, mimeType?: string, language?: 'zh' | 'en'): Promise<ParsedQuestion>;
    generateSimilarQuestion(originalQuestion: string, knowledgePoints: string[], language?: 'zh' | 'en'): Promise<ParsedQuestion>;
}
