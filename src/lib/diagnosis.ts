/**
 * 薄弱点诊断引擎（纯函数，无 IO，可单测）
 *
 * 核心思想：把两类证据折算到同一"货币"——时间加权失败质量（failMass）：
 *   - 真实错题：按掌握度给失败权重（未掌握 1.0 / 复习中 0.6 / 已掌握 0.2），
 *     并按时间半衰期（45 天）衰减——"现在的弱点"权重高，"过去的弱点"降权
 *   - 已归因的练习结果（P2 起 PracticeRecord 带 tagId）：答错 = 一道新鲜的
 *     满权重未掌握伪错题；答对 = 一道已掌握伪错题（弱证据）
 *
 * 评分（每个知识点 0-100，三通道固定权重归一）：
 *   A. 错误积累 0.6：failMass 在该用户所有考点内按最大值归一（相对强度，
 *      天然免疫"题量大的章节错得多"）
 *   B. 复发度 0.2：考点跨自然周出现的广度（反复错 > 一次性错）
 *   C. 未掌握占比 0.2：错题 + 练习伪证据的掌握状态分布
 *
 * 置信度 = failMass 饱和映射；证据不足（<2 道错题或置信度过低）的知识点
 * 不进 Top-K，UI 显示"证据积累中"。趋势 = 近 30 天 vs 前 60 天的失败质量比。
 */

const HALF_LIFE_DAYS = 45;
const MS_PER_DAY = 86400000;

/** 复发度：考点错题出现在 ≥3 个不同自然周即视为满复发 */
const RECURRENCE_FULL_WEEKS = 3;
/** 置信度：failMass 达到该值记满分（衰减后约 3.5 道未掌握错题的权重） */
const CONFIDENCE_SATURATION = 3.5;
/** 进入 Top-K 的最低门槛：至少 2 道错题且置信度过半 */
export const READY_MIN_ERRORS = 2;
export const READY_MIN_CONFIDENCE = 0.5;

const MASTERY_WEIGHT: Record<number, number> = { 0: 1.0, 1: 0.6, 2: 0.2 };
const CHANNEL_WEIGHTS = { failMass: 0.6, recurrence: 0.2, unmastered: 0.2 };

export interface DiagnosisTagRef {
    id: string;
    name: string;
    parentId: string | null;
}

export interface DiagnosisErrorItem {
    id: string;
    createdAt: Date | string;
    masteryLevel: number;
    tags: DiagnosisTagRef[];
}

export interface DiagnosisPracticeRecord {
    tagId?: string | null;
    difficulty?: string | null;
    isCorrect?: boolean | null;
    createdAt: Date | string;
}

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
    /** 按权重排序的锚定错题 id（供定向出题取材） */
    evidenceErrorItemIds: string[];
    ready: boolean;
}

export interface ChapterDiagnosis {
    tagId: string;
    name: string;
    kpCount: number;
    errorCount: number;
    score: number;
    ready: boolean;
}

export interface WeaknessReport {
    generatedAt: string;
    totalErrorItems: number;
    readyKpCount: number;
    kps: KpDiagnosis[];
    chapters: ChapterDiagnosis[];
    topKps: KpDiagnosis[];
}

function toDate(v: Date | string): Date {
    return v instanceof Date ? v : new Date(v);
}

function decayWeight(createdAt: Date, now: Date): number {
    const days = Math.max(0, (now.getTime() - createdAt.getTime()) / MS_PER_DAY);
    return Math.pow(0.5, days / HALF_LIFE_DAYS);
}

function weekKey(d: Date): string {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    // 按自纪元起的天数/7 分桶，足够区分"不同自然周"
    return String(Math.floor(t.getTime() / (7 * MS_PER_DAY)));
}

export interface BuildReportInput {
    errorItems: DiagnosisErrorItem[];
    practiceRecords?: DiagnosisPracticeRecord[];
    now?: Date;
}

/** 同义考点别名表（常见写法归一；归一化键相同的考点聚合为同一弱项） */
const TAG_ALIAS: Record<string, string> = {
    "削弱加强": "削弱论证",
    "削弱加强型": "削弱论证",
    "加强削弱型": "削弱论证",
    "行程": "行程问题",
};

/** 考点归一化键：小写、去空白与标点、全角转半角，再过别名表 */
export function normalizeTagKey(name: string): string {
    const t = (name || "")
        .toLowerCase()
        .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/[\s\u3000]+/g, "")
        .replace(/[（）()【】[\]{}「」《》<>·、，,。.:：;；!！?？\-—_]/g, "");
    return TAG_ALIAS[t] ?? t;
}

/**
 * 同义考点归并：按归一化键把"同名异写"的标签聚合到同一弱项桶。
 * 桶的 primaryTagId 取证据最多（先出现）的真实标签，供定向出题取材；
 * 显示名取出现次数最多的原始写法。
 */
interface CanonicalBucket {
    displayName: string;
    nameCounts: Map<string, number>;
    tagIdCounts: Map<string, number>;
    primaryTagId: string;
}

function canonicalizeTags(items: DiagnosisErrorItem[]): Map<string, CanonicalBucket> {
    const buckets = new Map<string, CanonicalBucket>();
    const tagIdToBucket = new Map<string, CanonicalBucket>();

    for (const item of items) {
        for (const tag of item.tags || []) {
            if (!tag?.id) continue;
            let bucket = tagIdToBucket.get(tag.id);
            if (!bucket) {
                const key = normalizeTagKey(tag.name);
                const existing = buckets.get(key);
                const created: CanonicalBucket =
                    existing ??
                    {
                        displayName: tag.name,
                        nameCounts: new Map<string, number>(),
                        tagIdCounts: new Map<string, number>(),
                        primaryTagId: tag.id,
                    };
                buckets.set(key, created);
                tagIdToBucket.set(tag.id, created);
                bucket = created;
            }
            bucket.nameCounts.set(tag.name, (bucket.nameCounts.get(tag.name) ?? 0) + 1);
            bucket.tagIdCounts.set(tag.id, (bucket.tagIdCounts.get(tag.id) ?? 0) + 1);
            // 显示名 / 主标签（供出题取材）取出现次数最多者；并列时保持先出现者
            let bestName = "";
            let bestNameCount = -1;
            for (const [n, c] of bucket.nameCounts) {
                if (c > bestNameCount) {
                    bestName = n;
                    bestNameCount = c;
                }
            }
            bucket.displayName = bestName;
            let bestTagId = "";
            let bestTagCount = -1;
            for (const [id, c] of bucket.tagIdCounts) {
                if (c > bestTagCount) {
                    bestTagId = id;
                    bestTagCount = c;
                }
            }
            bucket.primaryTagId = bestTagId;
        }
    }
    return tagIdToBucket;
}

export function buildWeaknessReport(input: BuildReportInput): WeaknessReport {
    const now = input.now ?? new Date();
    const errorItems = Array.isArray(input.errorItems) ? input.errorItems : [];
    const practiceRecords = Array.isArray(input.practiceRecords) ? input.practiceRecords : [];

    // 同义考点归并：同名异写的标签聚合为同一弱项桶
    const tagToBucket = canonicalizeTags(errorItems);

    // ---- 知识点聚合：错题 + 练习伪证据折算到同一套计数器 ----
    interface KpAcc {
        tagId: string;
        name: string;
        itemIds: string[];
        itemWeights: Map<string, number>;
        weeks: Set<string>;
        unmastered: number;
        reviewing: number;
        mastered: number;
        recentMass: number; // 近 30 天
        olderMass: number; // 30~90 天
        failMass: number;
        practiceAttempts: number;
        practiceCorrect: number;
    }
    const acc = new Map<string, KpAcc>();

    function ensure(tagId: string, name: string): KpAcc {
        let k = acc.get(tagId);
        if (!k) {
            k = {
                tagId,
                name,
                itemIds: [],
                itemWeights: new Map(),
                weeks: new Set(),
                unmastered: 0,
                reviewing: 0,
                mastered: 0,
                recentMass: 0,
                olderMass: 0,
                failMass: 0,
                practiceAttempts: 0,
                practiceCorrect: 0,
            };
            acc.set(tagId, k);
        }
        return k;
    }

    for (const item of errorItems) {
        const created = toDate(item.createdAt);
        const w = decayWeight(created, now);
        const mw = MASTERY_WEIGHT[item.masteryLevel] ?? 1.0;
        const bucketByTagId = new Map<string, CanonicalBucket>();
        for (const tag of item.tags || []) {
            if (!tag?.id) continue;
            const bucket = tagToBucket.get(tag.id);
            if (bucket) bucketByTagId.set(tag.id, bucket);
        }
        // 同一道错题命中多个归并后相同的桶时只计一次（取主标签桶）
        const seenBuckets = new Set<CanonicalBucket>();
        for (const tag of item.tags || []) {
            if (!tag?.id) continue;
            const bucket = bucketByTagId.get(tag.id);
            if (!bucket || seenBuckets.has(bucket)) continue;
            seenBuckets.add(bucket);
            const aggTagId = bucket.primaryTagId;
            const k = ensure(aggTagId, bucket.displayName);
            if (!k.itemWeights.has(item.id)) k.itemIds.push(item.id);
            k.itemWeights.set(item.id, Math.max(k.itemWeights.get(item.id) ?? 0, w * mw));
            k.weeks.add(weekKey(created));
            const ageDays = (now.getTime() - created.getTime()) / MS_PER_DAY;
            if (ageDays <= 30) k.recentMass += w * mw;
            else if (ageDays <= 90) k.olderMass += w * mw;
            k.failMass += w * mw;
            if (item.masteryLevel >= 2) k.mastered += 1;
            else if (item.masteryLevel === 1) k.reviewing += 1;
            else k.unmastered += 1;
        }
    }

    // 练习结果 → 伪证据：答错 = 新鲜满权重未掌握；答对 = 弱已掌握
    for (const r of practiceRecords) {
        if (!r?.tagId) continue;
        const created = toDate(r.createdAt);
        const k = ensure(r.tagId, r.tagId); // 练习-only 的考点无真实名称，路由侧回填
        k.practiceAttempts += 1;
        const correct = r.isCorrect === true;
        if (correct) k.practiceCorrect += 1;
        const mw = correct ? MASTERY_WEIGHT[2] : MASTERY_WEIGHT[0];
        const w = decayWeight(created, now) * 1.0; // 练习都是近期的，但保留衰减以支持历史回放
        k.weeks.add(weekKey(created));
        if (!correct) {
            k.recentMass += w * mw;
            k.failMass += w * mw;
        }
        if (correct) k.mastered += 1;
        else k.unmastered += 1;
    }

    const maxFailMass = Math.max(...[...acc.values()].map(k => k.failMass), 0);

    const kps: KpDiagnosis[] = [...acc.values()].map(k => {
        const totalUnits = k.unmastered + k.reviewing + k.mastered;
        const unmasteredShare = totalUnits > 0 ? (k.unmastered + 0.5 * k.reviewing) / totalUnits : 0;
        const recurrence = Math.min(1, k.weeks.size / RECURRENCE_FULL_WEEKS);
        const failMassNorm = maxFailMass > 0 ? k.failMass / maxFailMass : 0;

        const score =
            100 *
            (CHANNEL_WEIGHTS.failMass * failMassNorm +
                CHANNEL_WEIGHTS.recurrence * recurrence +
                CHANNEL_WEIGHTS.unmastered * unmasteredShare);

        const confidence = Math.min(1, k.failMass / CONFIDENCE_SATURATION);

        // 趋势：近 30 天 vs 前 60 天的加权失败质量
        let trend: KpDiagnosis["trend"] = "unknown";
        if (k.recentMass > 0 || k.olderMass > 0) {
            const ratio = k.recentMass / (k.olderMass + 1e-6);
            if (k.olderMass === 0 && k.recentMass > 0) trend = "worsening";
            else if (k.recentMass === 0) trend = "improving";
            else if (ratio > 1.2) trend = "worsening";
            else if (ratio < 0.7) trend = "improving";
            else trend = "flat";
        }

        const evidenceErrorItemIds = [...k.itemIds]
            .sort((a, b) => (k.itemWeights.get(b) ?? 0) - (k.itemWeights.get(a) ?? 0))
            .slice(0, 6);

        return {
            tagId: k.tagId,
            name: k.name,
            chapterId: null,
            chapterName: null,
            errorCount: k.itemIds.length,
            unmasteredShare: Math.round(unmasteredShare * 100) / 100,
            recurrence: Math.round(recurrence * 100) / 100,
            practiceAttempts: k.practiceAttempts,
            practiceAccuracy: k.practiceAttempts > 0 ? k.practiceCorrect / k.practiceAttempts : null,
            score: Math.round(score * 10) / 10,
            confidence: Math.round(confidence * 100) / 100,
            trend,
            evidenceErrorItemIds,
            ready: k.itemIds.length >= READY_MIN_ERRORS && confidence >= READY_MIN_CONFIDENCE,
        };
    });

    kps.sort((a, b) => b.score - a.score || b.confidence - a.confidence);

    return {
        generatedAt: now.toISOString(),
        totalErrorItems: errorItems.length,
        readyKpCount: kps.filter(k => k.ready).length,
        kps,
        chapters: [],
        topKps: kps.filter(k => k.ready).slice(0, 3),
    };
}

/**
 * 章节归并与聚合（需要完整标签树做 parentId 上溯）
 * @param allTags 用户自定义 + 系统标签全集
 */
export function attachChapters(report: WeaknessReport, allTags: DiagnosisTagRef[]): WeaknessReport {
    const tagMap = new Map(allTags.map(t => [t.id, t]));
    const chapterCache = new Map<string, { id: string; name: string } | null>();

    function chapterOf(tagId: string): { id: string; name: string } | null {
        if (chapterCache.has(tagId)) return chapterCache.get(tagId)!;
        let cur = tagMap.get(tagId) ?? null;
        const seen = new Set<string>();
        let result: { id: string; name: string } | null = null;
        while (cur) {
            if (seen.has(cur.id)) break; // 防环
            seen.add(cur.id);
            if (!cur.parentId) {
                result = { id: cur.id, name: cur.name };
                break;
            }
            cur = tagMap.get(cur.parentId) ?? null;
        }
        chapterCache.set(tagId, result);
        return result;
    }

    const chapters = new Map<string, { tagId: string; name: string; kpCount: number; errorCount: number; mass: number; scoreMass: number }>();
    for (const kp of report.kps) {
        const ch = chapterOf(kp.tagId);
        kp.chapterId = ch?.id ?? null;
        kp.chapterName = ch?.name ?? null;
        if (!ch) continue;
        let c = chapters.get(ch.id);
        if (!c) {
            c = { tagId: ch.id, name: ch.name, kpCount: 0, errorCount: 0, mass: 0, scoreMass: 0 };
            chapters.set(ch.id, c);
        }
        c.kpCount += 1;
        c.errorCount += kp.errorCount;
        const m = kp.errorCount + 1; // 证据加权（+1 避免零证据考点被完全忽略）
        c.mass += m;
        c.scoreMass += kp.score * m;
    }

    report.chapters = [...chapters.values()]
        .map(c => ({
            tagId: c.tagId,
            name: c.name,
            kpCount: c.kpCount,
            errorCount: c.errorCount,
            score: Math.round((c.scoreMass / c.mass) * 10) / 10,
            ready: c.kpCount > 0,
        }))
        .sort((a, b) => b.score - a.score);

    return report;
}
