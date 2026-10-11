/**
 * 题库通用工具：原文切分、去重哈希、难度档位。
 * 学习端（出题检索）与管理端（导入解析）共用，保持口径一致。
 */
import { createHash } from "crypto";
import { GONGKAO_MODULES } from "./tag-data";

/** 题库可出题的科目（行测五大模块；申论与其他科目仅收录不出题） */
export const BANK_SUBJECTS = GONGKAO_MODULES;

export const BANK_DIFFICULTIES = ["easy", "medium", "hard", "harder"] as const;
export type BankDifficulty = (typeof BANK_DIFFICULTIES)[number];

const DIFFICULTY_ORDER: Record<string, number> = {
    easy: 0,
    medium: 1,
    hard: 2,
    harder: 3,
};

/**
 * 目标难度 ± 一档的可接受区间（题库检索用）。
 * 例：medium → [easy, medium, hard]；easy → [easy, medium]。
 */
export function adjacentDifficulties(difficulty: string): BankDifficulty[] {
    const idx = DIFFICULTY_ORDER[difficulty];
    if (idx === undefined) return ["medium"];
    return BANK_DIFFICULTIES.filter((_, i) => Math.abs(i - idx) <= 1);
}

/** 归一化非法难度值；返回 null 表示无法识别 */
export function normalizeDifficulty(value: unknown): BankDifficulty | null {
    const v = String(value ?? "").trim().toLowerCase();
    return (BANK_DIFFICULTIES as readonly string[]).includes(v) ? (v as BankDifficulty) : null;
}

export type BankQuestionType = "single" | "multiple" | "subjective";

export function normalizeQuestionType(value: unknown): BankQuestionType {
    const v = String(value ?? "").trim().toLowerCase();
    if (v === "multiple" || v === "多选") return "multiple";
    if (v === "subjective" || v === "主观" || v === "主观题") return "subjective";
    return "single";
}

/** 题干去重键：去掉全部空白与中英文标点后的小写文本 */
export function normalizeQuestionKey(text: string): string {
    return (text || "")
        .replace(/\s+/g, "")
        .replace(/[，。、；：？！“”‘’（）()【】\[\]《》<>""''…—\-_.:;,?!%]/g, "")
        .toLowerCase();
}

/** 题干内容哈希（contentHash 唯一约束挡精确重复） */
export function hashQuestionText(text: string): string {
    return createHash("sha1").update(normalizeQuestionKey(text)).digest("hex");
}

/** 字符二元组 Jaccard 相似度（近重复检测） */
export function bigramSimilarity(a: string, b: string): number {
    const sa = (a || "").replace(/\s+/g, "");
    const sb = (b || "").replace(/\s+/g, "");
    if (sa.length < 2 || sb.length < 2) return 0;
    const grams = (s: string) => {
        const set = new Set<string>();
        for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
        return set;
    };
    const ga = grams(sa);
    const gb = grams(sb);
    let inter = 0;
    for (const g of ga) if (gb.has(g)) inter += 1;
    const union = ga.size + gb.size - inter;
    return union === 0 ? 0 : inter / union;
}

/** 题号行：行首 1-3 位数字 + 分隔符（1. / 2、 / 12．），排除选项行与数值开头的普通句子 */
const QUESTION_START_RE = /^\s*(\d{1,3})\s*[.、．,，]\s*\S/;
const OPTION_LINE_RE = /^\s*[A-Da-d]\s*[.、．,，]/;
/** 答案/解析区起始行，作为题目块的组成部分保留 */
const SECTION_HINT_RE = /^(参考答案|【答案】|答案[:：]|【解析】|解析[:：])/;

/** 单次导入的切分上限（防止超长文本拖垮解析） */
export const MAX_BLOCKS_PER_IMPORT = 500;
export const MAX_BLOCK_CHARS = 5000;

/**
 * 把粘贴的题册/整卷文本按题号切分为题目块。
 * 规则：以"题号行"为界开新块，选项行与答案/解析行并入当前块。
 * 全文没有任何题号行时返回单块（交由 AI 兜底判断）。
 */
export function splitQuestionBlocks(rawText: string): string[] {
    const lines = (rawText || "").replace(/\r\n/g, "\n").split("\n");
    const blocks: string[] = [];
    let current: string[] = [];
    let hasQuestionStart = false;

    const flush = () => {
        const text = current.join("\n").trim();
        if (text) blocks.push(text);
        current = [];
    };

    for (const line of lines) {
        const isOption = OPTION_LINE_RE.test(line) && !QUESTION_START_RE.test(line);
        const isQuestionStart = QUESTION_START_RE.test(line) && !isOption && !SECTION_HINT_RE.test(line);
        if (isQuestionStart) {
            hasQuestionStart = true;
            flush();
        }
        current.push(line);
        if (current.join("\n").length > MAX_BLOCK_CHARS * 2) flush(); // 畸形长块兜底
    }
    flush();

    if (!hasQuestionStart) {
        // 无题号可依：整段作为单块，让 AI 自行判断
        const whole = (rawText || "").trim();
        return whole ? [whole.slice(0, MAX_BLOCK_CHARS * 2)] : [];
    }

    return blocks
        .map(b => (b.length > MAX_BLOCK_CHARS ? b.slice(0, MAX_BLOCK_CHARS) + "…（原文超长截断）" : b))
        .filter(b => b.trim().length > 0)
        .slice(0, MAX_BLOCKS_PER_IMPORT);
}
