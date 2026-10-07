import { z } from 'zod';
import { AI_SUBJECT_OPTIONS } from '../subjects';

/**
 * Zod schema for validating AI-parsed questions
 * Ensures type safety and business rule compliance
 */
export const ParsedQuestionSchema = z.object({
    questionText: z.string().min(1, "题目文本不能为空"),
    answerText: z.string().min(1, "答案不能为空"),
    analysis: z.string().min(1, "解析不能为空"),
    wrongAnswerText: z.string().optional().default(""),
    mistakeAnalysis: z.string().optional().default(""),
    mistakeStatus: z.enum(["not_attempted", "wrong_attempt", "unknown"]).optional().default("unknown"),
    subject: z.enum(AI_SUBJECT_OPTIONS),
    knowledgePoints: z.array(z.string()).max(5, "知识点最多 5 个"),
    requiresImage: z.boolean().optional().default(false), // 题目是否依赖图片（如几何题）
});

/**
 * Type inference from Zod schema
 * Use this type instead of manually defining ParsedQuestion
 */
export type ParsedQuestionFromSchema = z.infer<typeof ParsedQuestionSchema>;

/**
 * Validates and parses AI response JSON
 * @param data - Raw JSON data from AI
 * @returns Validated ParsedQuestion object
 * @throws ZodError if validation fails
 */
export function validateParsedQuestion(data: unknown): ParsedQuestionFromSchema {
    return ParsedQuestionSchema.parse(data);
}

/**
 * Safe validation that returns success/error object
 * @param data - Raw JSON data from AI
 */
export function safeParseParsedQuestion(data: unknown) {
    return ParsedQuestionSchema.safeParse(data);
}

/**
 * 整页题目定位结果（/api/analyze/detect）
 * bbox 为 0-100 的百分比坐标，与图片实际分辨率无关
 */
export const DetectedQuestionSchema = z.object({
    number: z.number().int(),
    label: z.string().optional().default(''),
    bbox: z.object({
        x1: z.number(),
        y1: z.number(),
        x2: z.number(),
        y2: z.number(),
    }),
});

export type DetectedQuestionFromSchema = z.infer<typeof DetectedQuestionSchema>;

/** 从 AI 原始返回文本中提取并校验题目定位 JSON 数组（容忍 markdown 代码块包裹） */
export function parseDetectedQuestions(rawText: string): DetectedQuestionFromSchema[] {
    const start = rawText.indexOf('[');
    const end = rawText.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error('AI_RESPONSE_ERROR');
    }
    let data: unknown;
    try {
        data = JSON.parse(rawText.slice(start, end + 1));
    } catch {
        throw new Error('AI_RESPONSE_ERROR');
    }
    if (!Array.isArray(data)) {
        throw new Error('AI_RESPONSE_ERROR');
    }

    const questions: DetectedQuestionFromSchema[] = [];
    for (const item of data) {
        const parsed = DetectedQuestionSchema.safeParse(item);
        if (!parsed.success) continue;
        const q = parsed.data;
        // 容错：坐标反了就交换，越界则夹回 0-100
        let x1 = Math.min(Math.max(q.bbox.x1, 0), 100);
        let x2 = Math.min(Math.max(q.bbox.x2, 0), 100);
        let y1 = Math.min(Math.max(q.bbox.y1, 0), 100);
        let y2 = Math.min(Math.max(q.bbox.y2, 0), 100);
        if (x1 > x2) [x1, x2] = [x2, x1];
        if (y1 > y2) [y1, y2] = [y2, y1];
        // 丢弃退化框（宽或高不足 1%）
        if (x2 - x1 < 1 || y2 - y1 < 1) continue;
        questions.push({ number: q.number, label: q.label, bbox: { x1, y1, x2, y2 } });
    }

    return questions;
}

/**
 * 解析批量出题的 JSON 数组输出（举一反三 batch）
 * 每项映射为 ParsedQuestion 形状；缺字段的项填充默认值，无有效题干的项跳过
 */
export function parseSimilarBatch(rawText: string): ParsedQuestionFromSchema[] {
    const start = rawText.indexOf('[');
    const end = rawText.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error('AI_RESPONSE_ERROR');
    }
    let data: unknown;
    try {
        data = JSON.parse(rawText.slice(start, end + 1));
    } catch {
        throw new Error('AI_RESPONSE_ERROR');
    }
    if (!Array.isArray(data)) {
        throw new Error('AI_RESPONSE_ERROR');
    }

    const out: ParsedQuestionFromSchema[] = [];
    for (const item of data) {
        const it = (item ?? {}) as Record<string, unknown>;
        const questionText = String(it.question_text ?? it.questionText ?? '').trim();
        if (!questionText) continue;
        const answerText = String(it.answer_text ?? it.answerText ?? '').trim();
        const analysis = String(it.analysis ?? '').trim();
        const kps = Array.isArray(it.knowledge_points ?? it.knowledgePoints)
            ? ((it.knowledge_points ?? it.knowledgePoints) as unknown[])
                .map(k => String(k).trim()).filter(Boolean).slice(0, 5)
            : [];
        out.push({
            questionText,
            answerText: answerText || "需人工核对",
            analysis: analysis || "暂无解析",
            wrongAnswerText: "",
            mistakeAnalysis: "",
            mistakeStatus: "unknown",
            subject: "其他",
            knowledgePoints: kps,
            requiresImage: false,
        });
    }
    if (out.length === 0) {
        throw new Error('AI_RESPONSE_ERROR');
    }
    return out;
}
