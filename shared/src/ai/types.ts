// Re-export the Zod-validated type from schema.ts
export type { ParsedQuestionFromSchema as ParsedQuestion } from './schema';
import type { ParsedQuestionFromSchema } from './schema';

export type { DetectedQuestionFromSchema as DetectedQuestion } from './schema';
import type { DetectedQuestionFromSchema } from './schema';

// 题库导入解析结果（管理端离线批量整理用）
export type { BankImportItem } from './schema';
import type { BankImportItem } from './schema';

// Import and re-export MistakeStatus from the single source of truth
import type { MistakeStatus } from '../mistake-status';
export type { MistakeStatus };

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'harder';

export interface ReanswerQuestionResult {
    answerText: string;
    analysis: string;
    knowledgePoints: string[];
    wrongAnswerText: string;
    mistakeAnalysis: string;
    mistakeStatus: MistakeStatus;
}

export interface GeogebraAnalysisResult {
    suitable: boolean;
    commands: string[];
    description: string;
}

export interface AIService {
    analyzeImage(imageBase64: string, mimeType?: string, language?: 'zh' | 'en', grade?: 7 | 8 | 9 | 10 | 11 | 12 | null, subject?: string | null, gradeSemester?: string | null, explainMode?: 'ai' | 'skip'): Promise<ParsedQuestionFromSchema>;
    /** 解析图 OCR：逐字转录图片中的解析文本（不解题不改写），供「上传解析图」模式 */
    transcribeImage(imageBase64: string, mimeType?: string): Promise<string>;
    /** 整页题目定位：返回每道题的题号与百分比包围盒，供前端框选后走单题识别 */
    detectQuestions(imageBase64: string, mimeType?: string): Promise<DetectedQuestionFromSchema[]>;
    generateSimilarQuestion(originalQuestion: string, knowledgePoints: string[], language?: 'zh' | 'en', difficulty?: DifficultyLevel, gradeSemester?: string | null): Promise<ParsedQuestionFromSchema>;
    /** 举一反三批量出题：一次 AI 调用生成 count 道同考点变式题 */
    generateSimilarQuestions(brief: string, knowledgePoints: string[], language?: 'zh' | 'en', difficulty?: DifficultyLevel, count?: number, gradeSemester?: string | null): Promise<ParsedQuestionFromSchema[]>;
    reanswerQuestion(questionText: string, language?: 'zh' | 'en', subject?: string | null, imageBase64?: string, gradeSemester?: string | null): Promise<ReanswerQuestionResult>;
    analyzeForGeogebra(questionText: string, answerText: string, analysis: string, previousErrors?: string): Promise<GeogebraAnalysisResult>;
    /** 题库导入：把切分好的原始题目片段批量整理成结构化条目（纯文本调用，管理端离线用） */
    parseBankQuestions(blocks: string[], tagNames: string[]): Promise<BankImportItem[]>;
}

export interface AIConfig {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    // 单次 AI 请求超时（毫秒），来自 app 配置的 timeouts.analyze
    timeoutMs?: number;
    // Azure OpenAI 特有字段
    azureDeployment?: string;   // Azure 部署名称
    azureApiVersion?: string;   // API 版本 (如 2024-02-15-preview)
}
