/**
 * 业务 API 层：对接现有 Next.js 后端（接口零改动）
 */
import { request } from "../utils/request";

// ---------- 类型 ----------

export interface Notebook {
    id: string;
    name: string;
    _count?: { errorItems: number };
}

export interface ErrorItemTag {
    id: string;
    name: string;
}

export interface ErrorItem {
    id: string;
    questionText: string | null;
    answerText: string | null;
    analysis: string | null;
    wrongAnswerText: string | null;
    mistakeAnalysis: string | null;
    mistakeStatus?: string | null;
    userNotes: string | null;
    masteryLevel: number;
    gradeSemester?: string | null;
    originalImageUrl: string;
    knowledgePoints: string | null;
    subject?: { id: string; name: string } | null;
    tags?: ErrorItemTag[];
}

export interface Paginated<T> {
    items: T[];
    total: number;
    totalPages: number;
}

export interface ParsedQuestion {
    questionText?: string;
    answerText?: string;
    analysis?: string;
    subject?: string;
    knowledgePoints?: string[];
    wrongAnswerText?: string;
    mistakeAnalysis?: string;
    mistakeStatus?: string;
    requiresImage?: boolean;
}

// ---------- 错题本 ----------

export function listNotebooks(): Promise<Notebook[]> {
    return request<Notebook[]>("/api/notebooks");
}

// ---------- 错题 ----------

export function listErrorItems(params: {
    subjectId?: string;
    query?: string;
    mastery?: "0" | "1";
    page?: number;
    pageSize?: number;
}): Promise<Paginated<ErrorItem>> {
    const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "" && v !== null)
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join("&");
    return request(`/api/error-items/list?${qs}`);
}

export function getErrorItem(id: string): Promise<ErrorItem> {
    return request(`/api/error-items/${id}`);
}

export function updateErrorItemNotes(id: string, userNotes: string): Promise<ErrorItem> {
    return request(`/api/error-items/${id}/notes`, {
        method: "PATCH",
        data: { userNotes },
    });
}

export function createErrorItem(payload: {
    questionText: string;
    answerText: string;
    analysis: string;
    wrongAnswerText?: string;
    mistakeAnalysis?: string;
    mistakeStatus?: string;
    knowledgePoints: string[];
    originalImageUrl: string;
    subjectId: string;
}): Promise<ErrorItem> {
    return request("/api/error-items", { method: "POST", data: payload });
}

// ---------- AI ----------

export function analyzeImage(imageBase64: string, subjectId?: string): Promise<ParsedQuestion> {
    return request("/api/analyze", {
        method: "POST",
        data: { imageBase64, language: "zh", subjectId },
    });
}

// ---------- 举一反三 ----------

export function generatePractice(
    errorItemId: string,
    difficulty: "easy" | "medium" | "hard" = "medium"
): Promise<ParsedQuestion> {
    return request("/api/practice/generate", {
        method: "POST",
        data: { errorItemId, language: "zh", difficulty },
    });
}

export function recordPractice(subject: string, difficulty: string, isCorrect: boolean) {
    return request("/api/practice/record", {
        method: "POST",
        data: { subject, difficulty, isCorrect },
    });
}
