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
    sourceType?: string | null; // 数据大类: manual(拍照/手动) / practice(练习收录)
    userNotes: string | null;
    masteryLevel: number;
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
    channelStats?: {
        free: { total: number; correct: number; rate: number };
        reinforced: { total: number; correct: number; rate: number };
    };
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
    questionId?: string | null; // 生成即入库的题库题 ID
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

/** 薄弱点定向出题（不传 tagId 时后端自动取诊断 Top1）；count>1 为批量（一次 AI 调用生成一组，返回 { questions }） */
export function smartGenerate(params: {
    tagId?: string;
    difficulty?: SmartDifficulty;
    count?: number;
}, options?: { timeout?: number }): Promise<SmartQuestion & { questions?: SmartQuestion[] }> {
    return request("/api/practice/smart", {
        method: "POST",
        data: params,
        ...(options?.timeout ? { timeout: options.timeout } : {}),
    });
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
    sourceType?: "manual" | "practice";
    /** 个人考点树节点 id（含子树） */
    tagId?: string;
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

export function updateErrorItem(
    id: string,
    data: { knowledgePoints?: string[]; subjectId?: string | null },
): Promise<ErrorItem> {
    return request(`/api/error-items/${id}`, { method: "PUT", data });
}

// ---------- 个人考点树 ----------

export interface TagTreeNode {
    id: string;
    name: string;
    code?: string | null;
    parentId?: string | null;
    order?: number;
    children: TagTreeNode[];
}

export interface TagLeaf {
    id: string;
    name: string;
}

/** 扁平收集树中所有节点 */
export function flattenTagTree(nodes: TagTreeNode[]): TagTreeNode[] {
    const out: TagTreeNode[] = [];
    const walk = (list: TagTreeNode[]) => {
        for (const n of list) {
            out.push(n);
            if (n.children?.length) walk(n.children);
        }
    };
    walk(nodes);
    return out;
}

/** 可选打标叶子：无子节点的节点 */
export function collectTagLeaves(nodes: TagTreeNode[]): TagLeaf[] {
    const out: TagLeaf[] = [];
    const walk = (list: TagTreeNode[]) => {
        for (const n of list) {
            if (!n.children?.length) out.push({ id: n.id, name: n.name });
            else walk(n.children);
        }
    };
    walk(nodes);
    return out;
}

export function getUserTagTree(): Promise<{
    tags: TagTreeNode[];
    needsImport: boolean;
    total?: number;
}> {
    return request("/api/tags?subject=gongkao");
}

export function importTagTemplate(mode: "merge" | "replace" = "merge"): Promise<{
    success: boolean;
    created: number;
    removed?: number;
    total: number;
    tags: TagTreeNode[];
    message?: string;
}> {
    return request("/api/tags/import-template", {
        method: "POST",
        data: { mode },
    });
}

export function createTag(payload: {
    name: string;
    parentId?: string | null;
}): Promise<{ tag: { id: string; name: string } }> {
    return request("/api/tags", { method: "POST", data: payload });
}

export function updateTag(
    id: string,
    payload: { name?: string; parentId?: string | null },
): Promise<{ tag: { id: string; name: string } }> {
    return request(`/api/tags/${id}`, { method: "PATCH", data: payload });
}

export function deleteTag(id: string): Promise<{ success: boolean; deleted: number }> {
    return request(`/api/tags?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ---------- AI ----------

export function analyzeImage(imageBase64: string, subjectId?: string): Promise<ParsedQuestion> {
    return request("/api/analyze", {
        method: "POST",
        data: { imageBase64, language: "zh", subjectId },
    });
}

/** 多图拼接识别：同一道题的多张照片交给后端纵向拼接成一张完整题目图后整体识别；返回合并图供原图保存 */
export function analyzeMultiImages(
    images: { base64: string; mimeType: string }[],
    subjectId?: string
): Promise<ParsedQuestion & { mergedImageBase64?: string }> {
    return request("/api/analyze", {
        method: "POST",
        data: { images, language: "zh", subjectId, multiStitched: true },
    });
}

/** 整页题目定位结果：bbox 为 0-100 百分比坐标 */
export interface DetectedQuestionBox {
    number: number;
    label?: string;
    bbox: { x1: number; y1: number; x2: number; y2: number };
}

/** 整页拍照后先定位题目位置，前端框选某题再走 analyzeImage 单题识别 */
export function detectQuestions(imageBase64: string): Promise<{ questions: DetectedQuestionBox[] }> {
    return request("/api/analyze/detect", {
        method: "POST",
        data: { imageBase64, language: "zh" },
    });
}

/** 重新解答结果：与后端 ReanswerQuestionResult 对齐 */
export interface ReanswerQuestionResult {
    answerText: string;
    analysis: string;
    knowledgePoints: string[];
    wrongAnswerText: string;
    mistakeAnalysis: string;
    mistakeStatus: string;
}

/** 重新解答：基于校正后的题目文本重新生成答案与解析（复用网页端 /api/reanswer） */
export function reanswerQuestion(payload: {
    questionText: string;
    language?: "zh" | "en";
    subject?: string;
    imageBase64?: string;
}, options?: { timeout?: number }): Promise<ReanswerQuestionResult> {
    return request("/api/reanswer", {
        method: "POST",
        data: { language: "zh", ...payload },
        ...(options?.timeout ? { timeout: options.timeout } : {}),
    });
}

// ---------- 举一反三 ----------

export function generatePractice(
    errorItemId: string,
    difficulty: "easy" | "medium" | "hard" = "medium"
): Promise<ParsedQuestion & { questionId?: string | null }> {
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
    answerText?: string;
    analysis?: string;
    errorItemId?: string;
    tagId?: string;
    channel?: string; // free/similar/smart（历史数据由迁移回填）
    questionId?: string;
    tag?: { name: string };
    createdAt: string;
}

/** 练习记录详情（含答案/解析快照） */
export function getPracticeRecord(id: string): Promise<PracticeRecordItem> {
    return request("/api/practice/records?id=" + id);
}

export function recordPractice(
    subject: string,
    difficulty: string,
    isCorrect: boolean,
    attribution?: {
        tagId?: string;
        errorItemId?: string;
        questionId?: string; // 题库题作答：后端联动题库状态并以其归因为权威
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

// ---------- 练习题库（生成即入库，待做/已做/已弃） ----------

export type PracticeChannel = "free" | "similar" | "smart";
export type PracticeQuestionStatus = "pending" | "answered" | "discarded";

export interface PracticeQuestionItem {
    id: string;
    channel: PracticeChannel;
    difficulty: string;
    subject?: string | null;
    tagId?: string | null;
    errorItemId?: string | null;
    bankQuestionId?: string | null;
    questionText: string;
    answerText?: string | null;
    eloRating?: number | null;
    status: PracticeQuestionStatus;
    isCorrect?: boolean | null;
    answeredAt?: string | null;
    createdAt: string;
    tag?: { name: string } | null;
    errorItem?: { id: string; questionText: string | null } | null;
}

export function listPracticeQuestions(params: {
    status?: PracticeQuestionStatus | "all";
    channel?: PracticeChannel;
    difficulty?: string;
    tagId?: string;
    errorItemId?: string;
    page?: number;
    pageSize?: number;
} = {}): Promise<{
    total: number;
    page: number;
    pageSize: number;
    pendingCount: number;
    questions: PracticeQuestionItem[];
}> {
    const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "" && v !== null)
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join("&");
    return request("/api/practice/questions" + (qs ? "?" + qs : ""));
}

export function getPracticeQuestion(id: string): Promise<PracticeQuestionItem> {
    return request(`/api/practice/questions/${id}`);
}

/** 不做这道（软删，可恢复）/ 恢复待做 */
export function patchPracticeQuestion(id: string, action: "discard" | "restore"): Promise<PracticeQuestionItem> {
    return request(`/api/practice/questions/${id}`, { method: "PATCH", data: { action } });
}

// ---------- 数据导入导出 ----------

/** 导入备份（POST /api/import，body 为导出的完整 JSON；合并语义，重复自动跳过） */
export interface ImportStats {
    subjectsCreated: number;
    tagsCreated: number;
    errorItemsCreated: number;
    reviewSchedulesCreated: number;
    practiceRecordsCreated: number;
    tagsLinked: number;
}

export function importUserData(data: unknown): Promise<{ success?: boolean; stats?: ImportStats }> {
    return request("/api/import", { method: "POST", data });
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

/** 练习记录列表（分页倒序），用于练习历史窗口；channel 可按渠道筛选 */
export function listPracticeRecords(params: {
    page?: number;
    pageSize?: number;
    channel?: PracticeChannel;
} = {}): Promise<{
    total: number;
    page: number;
    pageSize: number;
    records: PracticeRecordItem[];
}> {
    const qs = [
        `page=${params.page || 1}`,
        `pageSize=${params.pageSize || 20}`,
        ...(params.channel ? [`channel=${params.channel}`] : []),
    ].join("&");
    return request("/api/practice/records?" + qs);
}
