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
    origin?: string | null; // 来源渠道: similar/smart/practice
    userNotes: string | null;
    masteryLevel: number;
    gradeSemester?: string | null;
    originalImageUrl: string;
    knowledgePoints: string | null;
    createdAt?: string;
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

// ---------- 学习概览（新增独立聚合路由，不影响网页端） ----------

export interface OverviewStats {
    totalItems: number;
    unmastered: number;
    reviewing: number;
    mastered: number;
    masteryRate: number;
    notebookCount: number;
    weekAdded: number;
}

export function getOverviewStats(): Promise<OverviewStats> {
    return request<OverviewStats>("/api/error-items/overview");
}

export interface PracticeSummary {
    total: number;
    correct: number;
    rate: number;
}

/** 复用网页端已有的 /api/stats/practice，仅取 overallStats 汇总部分 */
export async function getPracticeSummary(): Promise<PracticeSummary> {
    const res = await request<{
        overallStats?: { total?: number; correct?: number; rate?: number | string };
    }>("/api/stats/practice");
    const o = res?.overallStats || {};
    return {
        total: Number(o.total) || 0,
        correct: Number(o.correct) || 0,
        rate: Number(o.rate) || 0,
    };
}

export interface PracticeStats {
    subjectStats: { name: string; value: number }[];
    activityStats: { date: string; total: number; correct: number }[];
    difficultyStats: { name: string; value: number }[];
    overallStats: { total?: number; correct?: number; rate?: number | string };
}

/** 完整练习统计（学习统计页使用，复用网页端已有接口） */
export function getPracticeStats(): Promise<PracticeStats> {
    return request<PracticeStats>("/api/stats/practice");
}

// ---------- 反馈 ----------

export type FeedbackType = "feature" | "bug" | "other";

export function submitFeedback(data: {
    type: FeedbackType;
    content: string;
    contact?: string;
}): Promise<{ success: boolean; id: string }> {
    return request("/api/feedback", { method: "POST", data });
}

// ---------- 薄弱点诊断与定向出题 ----------

export interface KpDiagnosis {
    tagId: string;
    name: string;
    chapterId: string | null;
    chapterName: string | null;
    errorCount: number;
    unmasteredShare: number;
    recurrence: number;
    practiceAttempts: number;
    practiceAccuracy: number | null;
    score: number;
    confidence: number;
    trend: "worsening" | "flat" | "improving" | "unknown";
    evidenceErrorItemIds: string[];
    ready: boolean;
}

export interface WeaknessReport {
    generatedAt: string;
    totalErrorItems: number;
    readyKpCount: number;
    kps: KpDiagnosis[];
    chapters: { tagId: string; name: string; kpCount: number; errorCount: number; score: number }[];
    topKps: KpDiagnosis[];
}

export function getWeaknessReport(): Promise<WeaknessReport> {
    return request<WeaknessReport>("/api/diagnosis/weakness");
}

export type SmartDifficulty = "easy" | "medium" | "hard" | "harder";

export interface SmartQuestion extends ParsedQuestion {
    meta?: {
        mode: string;
        tagId: string;
        tagName: string;
        anchorCount: number;
        primaryErrorItemId: string | null;
        difficulty: SmartDifficulty;
        difficultySource?: "explicit" | "elo";
        elo?: { rating: number; attempts: number };
        source: string;
        duplicate?: boolean;
    };
}

/** 薄弱点定向出题（不传 tagId 时后端自动取诊断 Top1） */
export function smartGenerate(params: {
    tagId?: string;
    difficulty?: SmartDifficulty;
}): Promise<SmartQuestion> {
    return request("/api/practice/smart", { method: "POST", data: params });
}

// ---------- 系统公告 ----------

export interface AnnouncementItem {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    read?: boolean;
}

export function getAnnouncements(): Promise<{ announcements: AnnouncementItem[] }> {
    return request("/api/announcements");
}

export function markAnnouncementsRead(): Promise<{ success: boolean; marked: number }> {
    return request("/api/announcements/read-all", { method: "POST", data: {} });
}

// ---------- 账户 ----------

export function registerAccount(data: {
    email: string;
    password: string;
    name: string;
}): Promise<{ user?: unknown; message?: string }> {
    return request("/api/register", { method: "POST", data });
}

/** 注册开关（后端配置控制，与网页端注册页一致） */
export function getRegisterStatus(): Promise<{ allowRegistration: boolean }> {
    return request("/api/register/status");
}

export interface UserProfile {
    id?: string;
    name: string | null;
    email: string | null;
    educationStage?: string | null;
    enrollmentYear?: number | null;
}

export function getUserProfile(): Promise<UserProfile> {
    return request("/api/user");
}

/** 更新资料（姓名/密码，与网页端设置-账户共用接口；改名后全站即时生效） */
export function updateUserProfile(data: {
    name?: string;
    password?: string;
}): Promise<UserProfile> {
    return request("/api/user", { method: "PATCH", data });
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

/** 更新掌握度：0 未掌握 / 1 复习中 / 2 已掌握（复用网页端已有接口） */
export function updateErrorItemMastery(id: string, masteryLevel: number): Promise<ErrorItem> {
    return request(`/api/error-items/${id}/mastery`, {
        method: "PATCH",
        data: { masteryLevel },
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

export interface PracticeRecordItem {
    id: string;
    subject?: string;
    difficulty?: string;
    isCorrect?: boolean;
    questionText?: string;
    errorItemId?: string;
    tagId?: string;
    tag?: { name: string };
    createdAt: string;
}

export function recordPractice(
    subject: string,
    difficulty: string,
    isCorrect: boolean,
    attribution?: {
        tagId?: string;
        errorItemId?: string;
        questionText?: string;
        answerText?: string;
        analysis?: string;
        knowledgePoints?: string[];
    }
): Promise<{ savedErrorItemId?: string | null }> {
    return request("/api/practice/record", {
        method: "POST",
        data: { subject, difficulty, isCorrect, ...(attribution || {}) },
    });
}

// ---------- 专注（番茄钟/模考掐表） ----------

export interface FocusStats {
    todaySeconds: number;
    weekSeconds: number;
    streakDays: number;
    totalSessions: number;
    totalSeconds: number;
    last7Days: { date: string; seconds: number }[];
}

export function recordFocusSession(params: {
    mode: "pomodoro" | "mock" | "custom";
    moduleName?: string;
    targetSeconds: number;
    durationSeconds: number;
    completed: boolean;
}) {
    return request("/api/focus/sessions", { method: "POST", data: params });
}

export function getFocusStats(): Promise<FocusStats> {
    return request("/api/focus/stats");
}

/** 练习记录列表（分页倒序），用于练习历史窗口 */
export function listPracticeRecords(params: { page?: number; pageSize?: number } = {}): Promise<{
    total: number;
    page: number;
    pageSize: number;
    records: PracticeRecordItem[];
}> {
    const query = `?page=${params.page || 1}&pageSize=${params.pageSize || 20}`;
    return request("/api/practice/records" + query);
}
