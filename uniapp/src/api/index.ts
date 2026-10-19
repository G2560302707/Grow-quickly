/**
 * 业务 API 层：对接现有 Next.js 后端（接口零改动）
 *
 * 游客浏览模式：未登录时读接口返回 utils/demo-data 演示数据（不发请求），
 * 写接口经 guestGuard 拦截并抛引导文案；登录后全部直连后端。
 */
import { request } from "../utils/request";
import { guestGuard, isGuest } from "../utils/guest";
import * as demo from "../utils/demo-data";

// ---------- 类型 ----------

export interface Notebook {
    id: string;
    name: string;
    iconKey?: string; // 图标键，static/notebook-icons/<key>.png
    isDefault?: boolean; // 默认本：不可删，删其它本时题目迁入
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
    explanationSource?: string | null; // 解析来源: ai / ocr
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

export async function listNotebooks(): Promise<Notebook[]> {
    if (isGuest()) return demo.demoNotebooks;
    return request<Notebook[]>("/api/notebooks");
}

export async function createNotebook(name: string, iconKey: string): Promise<Notebook> {
    await guestGuard("创建错题本");
    return request<Notebook>("/api/notebooks", { method: "POST", data: { name, iconKey } });
}

export async function updateNotebook(id: string, name: string, iconKey: string): Promise<Notebook> {
    await guestGuard("修改错题本");
    return request<Notebook>(`/api/notebooks/${id}`, { method: "PUT", data: { name, iconKey } });
}

export async function deleteNotebook(id: string): Promise<{ message: string }> {
    await guestGuard("删除错题本");
    return request<{ message: string }>(`/api/notebooks/${id}`, { method: "DELETE" });
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

export async function getOverviewStats(): Promise<OverviewStats> {
    if (isGuest()) return demo.demoOverviewStats;
    return request<OverviewStats>("/api/error-items/overview");
}

export interface PracticeSummary {
    total: number;
    correct: number;
    rate: number;
}

/** 复用网页端已有的 /api/stats/practice，仅取 overallStats 汇总部分 */
export async function getPracticeSummary(): Promise<PracticeSummary> {
    if (isGuest()) return demo.demoPracticeSummary;
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
export async function getPracticeStats(): Promise<PracticeStats> {
    if (isGuest()) return demo.demoPracticeStats;
    return request<PracticeStats>("/api/stats/practice");
}

// ---------- 反馈 ----------

export type FeedbackType = "feature" | "bug" | "other";

export async function submitFeedback(data: {
    type: FeedbackType;
    content: string;
    contact?: string;
}): Promise<{ success: boolean; id: string }> {
    await guestGuard("提交反馈");
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

export async function getWeaknessReport(): Promise<WeaknessReport> {
    if (isGuest()) return demo.demoWeaknessReport;
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
export async function smartGenerate(params: {
    tagId?: string;
    difficulty?: SmartDifficulty;
    count?: number;
}, options?: { timeout?: number }): Promise<SmartQuestion & { questions?: SmartQuestion[] }> {
    await guestGuard("生成练习题");
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

export async function getAnnouncements(): Promise<{ announcements: AnnouncementItem[] }> {
    if (isGuest()) return { announcements: demo.demoAnnouncements };
    return request("/api/announcements");
}

export async function markAnnouncementsRead(): Promise<{ success: boolean; marked: number }> {
    if (isGuest()) return { success: true, marked: 0 };
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

export async function getUserProfile(): Promise<UserProfile> {
    await guestGuard("编辑资料");
    return request("/api/user");
}

/** 更新资料（姓名/密码，与网页端设置-账户共用接口；改名后全站即时生效） */
export async function updateUserProfile(data: {
    name?: string;
    password?: string;
}): Promise<UserProfile> {
    await guestGuard("编辑资料");
    return request("/api/user", { method: "PATCH", data });
}

// ---------- 错题 ----------

export async function listErrorItems(params: {
    subjectId?: string;
    query?: string;
    mastery?: "0" | "1";
    sourceType?: "manual" | "practice";
    /** 个人考点树节点 id（含子树） */
    tagId?: string;
    page?: number;
    pageSize?: number;
}): Promise<Paginated<ErrorItem>> {
    if (isGuest()) return demo.filterDemoItems(params);
    const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "" && v !== null)
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join("&");
    return request(`/api/error-items/list?${qs}`);
}

export async function getErrorItem(id: string): Promise<ErrorItem> {
    if (isGuest()) {
        const hit = demo.findDemoItem(id);
        if (hit) return hit;
        throw new Error("演示数据中未找到该错题");
    }
    return request(`/api/error-items/${id}`);
}

export async function updateErrorItemNotes(id: string, userNotes: string): Promise<ErrorItem> {
    await guestGuard("保存笔记");
    return request(`/api/error-items/${id}/notes`, {
        method: "PATCH",
        data: { userNotes },
    });
}

/** 更新掌握度：0 未掌握 / 1 复习中 / 2 已掌握（复用网页端已有接口） */
export async function updateErrorItemMastery(id: string, masteryLevel: number): Promise<ErrorItem> {
    await guestGuard("更新掌握度");
    return request(`/api/error-items/${id}/mastery`, {
        method: "PATCH",
        data: { masteryLevel },
    });
}

export async function createErrorItem(payload: {
    questionText: string;
    answerText: string;
    analysis: string;
    wrongAnswerText?: string;
    mistakeAnalysis?: string;
    mistakeStatus?: string;
    knowledgePoints: string[];
    originalImageUrl: string;
    subjectId: string;
    explanationSource?: string | null; // 解析来源: ai(AI 生成) / ocr(解析图转录)；不上传解析时为 null
}): Promise<ErrorItem> {
    await guestGuard("保存错题");
    return request("/api/error-items", { method: "POST", data: payload });
}

export async function updateErrorItem(
    id: string,
    data: { knowledgePoints?: string[]; subjectId?: string | null },
): Promise<ErrorItem> {
    await guestGuard("更新错题");
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

export async function getUserTagTree(): Promise<{
    tags: TagTreeNode[];
    needsImport: boolean;
    total?: number;
}> {
    if (isGuest()) return { tags: demo.demoTagTree, needsImport: false, total: 10 };
    return request("/api/tags?subject=gongkao");
}

export async function importTagTemplate(mode: "merge" | "replace" = "merge"): Promise<{
    success: boolean;
    created: number;
    removed?: number;
    total: number;
    tags: TagTreeNode[];
    message?: string;
}> {
    await guestGuard("导入考点树");
    return request("/api/tags/import-template", {
        method: "POST",
        data: { mode },
    });
}

export async function createTag(payload: {
    name: string;
    parentId?: string | null;
}): Promise<{ tag: { id: string; name: string } }> {
    await guestGuard("新增考点");
    return request("/api/tags", { method: "POST", data: payload });
}

export async function updateTag(
    id: string,
    payload: { name?: string; parentId?: string | null },
): Promise<{ tag: { id: string; name: string } }> {
    await guestGuard("修改考点");
    return request(`/api/tags/${id}`, { method: "PATCH", data: payload });
}

export async function deleteTag(id: string): Promise<{ success: boolean; deleted: number }> {
    await guestGuard("删除考点");
    return request(`/api/tags?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ---------- AI ----------

export async function analyzeImage(imageBase64: string, subjectId?: string, explainMode?: "ai" | "skip"): Promise<ParsedQuestion> {
    await guestGuard("AI 识别");
    return request("/api/analyze", {
        method: "POST",
        data: { imageBase64, language: "zh", subjectId, explainMode: explainMode || "ai" },
    });
}

/** 解析图 OCR：逐字转录解析/解题过程图片（不解题不改写），供「上传解析图」模式 */
export async function ocrExplainImage(imageBase64: string): Promise<{ text: string }> {
    await guestGuard("解析图识别");
    return request("/api/ocr-explain", {
        method: "POST",
        data: { imageBase64 },
    });
}

/** 多图拼接识别：同一道题的多张照片交给后端纵向拼接成一张完整题目图后整体识别；返回合并图供原图保存 */
export async function analyzeMultiImages(
    images: { base64: string; mimeType: string }[],
    subjectId?: string,
    explainMode?: "ai" | "skip"
): Promise<ParsedQuestion & { mergedImageBase64?: string }> {
    await guestGuard("AI 识别");
    return request("/api/analyze", {
        method: "POST",
        data: { images, language: "zh", subjectId, multiStitched: true, explainMode: explainMode || "ai" },
    });
}

/** 整页题目定位结果：bbox 为 0-100 百分比坐标 */
export interface DetectedQuestionBox {
    number: number;
    label?: string;
    bbox: { x1: number; y1: number; x2: number; y2: number };
}

/** 整页拍照后先定位题目位置，前端框选某题再走 analyzeImage 单题识别 */
export async function detectQuestions(imageBase64: string): Promise<{ questions: DetectedQuestionBox[] }> {
    await guestGuard("题目定位");
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
export async function reanswerQuestion(payload: {
    questionText: string;
    language?: "zh" | "en";
    subject?: string;
    imageBase64?: string;
}, options?: { timeout?: number }): Promise<ReanswerQuestionResult> {
    await guestGuard("重新解答");
    return request("/api/reanswer", {
        method: "POST",
        data: { language: "zh", ...payload },
        ...(options?.timeout ? { timeout: options.timeout } : {}),
    });
}

// ---------- 举一反三 ----------

export async function generatePractice(
    errorItemId: string,
    difficulty: "easy" | "medium" | "hard" = "medium"
): Promise<ParsedQuestion & { questionId?: string | null }> {
    await guestGuard("生成练习题");
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
export async function getPracticeRecord(id: string): Promise<PracticeRecordItem> {
    if (isGuest()) {
        const hit = demo.demoPracticeRecords.find((r) => r.id === id);
        if (hit) return hit;
        throw new Error("演示数据中未找到该记录");
    }
    return request("/api/practice/records?id=" + id);
}

export async function recordPractice(
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
    await guestGuard("保存练习记录");
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

export async function listPracticeQuestions(params: {
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
    if (isGuest()) {
        const list = demo.demoPracticeQuestions.filter(
            (q) => !params.status || params.status === "all" || q.status === params.status,
        );
        return { total: list.length, page: 1, pageSize: 20, pendingCount: list.length, questions: list };
    }
    const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "" && v !== null)
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join("&");
    return request("/api/practice/questions" + (qs ? "?" + qs : ""));
}

export async function getPracticeQuestion(id: string): Promise<PracticeQuestionItem> {
    if (isGuest()) {
        const hit = demo.demoPracticeQuestions.find((q) => q.id === id);
        if (hit) return hit;
        throw new Error("演示数据中未找到该题目");
    }
    return request(`/api/practice/questions/${id}`);
}

/** 不做这道（软删，可恢复）/ 恢复待做 */
export async function patchPracticeQuestion(id: string, action: "discard" | "restore"): Promise<PracticeQuestionItem> {
    await guestGuard("整理题库");
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

export async function importUserData(data: unknown): Promise<{ success?: boolean; stats?: ImportStats }> {
    await guestGuard("导入数据");
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
    /** 每日目标(分钟)，后台持久化；老接口无此字段时前端用本地值兜底 */
    dailyGoalMin?: number;
    /** 分模式洞察：pomodoro(番茄钟) / mock(整卷模考) / custom(自定义) */
    byMode?: Record<string, { seconds: number; sessions: number; completed: number }>;
}

export async function recordFocusSession(params: {
    mode: "pomodoro" | "mock" | "custom";
    moduleName?: string;
    targetSeconds: number;
    durationSeconds: number;
    completed: boolean;
}) {
    await guestGuard("同步专注记录");
    return request("/api/focus/sessions", { method: "POST", data: params });
}

export async function getFocusStats(): Promise<FocusStats> {
    if (isGuest()) return demo.demoFocusStats;
    return request("/api/focus/stats");
}

/** 设置专注每日目标（分钟），跨端同步到后台 */
export async function setFocusDailyGoal(dailyGoalMin: number): Promise<{ dailyGoalMin: number }> {
    if (isGuest()) return { dailyGoalMin };
    return request("/api/focus/goal", { method: "POST", data: { dailyGoalMin } });
}

/** 练习记录列表（分页倒序），用于练习历史窗口；channel 可按渠道筛选 */
export async function listPracticeRecords(params: {
    page?: number;
    pageSize?: number;
    channel?: PracticeChannel;
} = {}): Promise<{
    total: number;
    page: number;
    pageSize: number;
    records: PracticeRecordItem[];
}> {
    if (isGuest()) {
        return {
            total: demo.demoPracticeRecords.length,
            page: 1,
            pageSize: 20,
            records: demo.demoPracticeRecords,
        };
    }
    const qs = [
        `page=${params.page || 1}`,
        `pageSize=${params.pageSize || 20}`,
        ...(params.channel ? [`channel=${params.channel}`] : []),
    ].join("&");
    return request("/api/practice/records?" + qs);
}
