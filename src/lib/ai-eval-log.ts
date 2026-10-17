/**
 * AI 识别评估日志（可观测性地基 M1）
 *
 * 把每次 AI 识别调用记成一行 JSONL，落盘到 `.ai-eval/ai-eval-<YYYY-MM-DD>.jsonl`。
 * 目的：为「准确性与稳定性评估计划」（doc/AI识别准确性稳定性评估计划.md §4 台阶一）
 * 提供可回放、可统计、可归因的日志，替代"只打 console、不落盘"的现状。
 *
 * 要点：
 * - 不落图片 base64（体量大、非结构化），只记图片规格（尺寸/张数）。
 * - 记录「结构化结果」全文（questionText/answerText/analysis…），供与 golden 逐字段对照，
 *   并对 answerText/analysis 做截断（避免单行日志过长）。
 * - 任何写盘异常都静默吞掉（try/catch），绝不影响主流程。
 * - 目录可用环境变量 AI_EVAL_LOG_DIR 覆盖，默认项目根 `.ai-eval/`。
 */
import fs from "node:fs";
import path from "node:path";

export type AiEvalScene = "analyze_single" | "analyze_multi" | "reanswer" | "detect";

export interface AiEvalEntry {
    scene: AiEvalScene;
    ts: string;            // ISO 本地时间
    provider: string;      // aiProvider（openai/gemini/azure）+ 实例名
    model: string;         // 激活实例 model
    ok: boolean;           // 是否成功拿到结构化结果
    statusCode: number;    // 接口返回码（500=AI 失败等）
    durationMs: number;    // 从调用 AI 到返回的耗时
    subject?: string | null;
    imageMeta?: {          // 图片规格（不含 base64）
        width?: number;
        height?: number;
        imagesCount?: number; // 多图张数
        base64Chars?: number; // 入图 base64 长度
    };
    errorCode?: string | null;      // AI_* / INVALID_INPUT…
    errorMessage?: string | null;   // 透传的错误信息（已做截断）
    result?: Record<string, unknown> | null; // 结构化结果（长字段截断）
    rawNote?: string;      // 附加说明（如"缺必需标签"）
}

const MAX_TEXT = 1200; // 过长字段截断字符数，避免单行日志过大

function truncateText(v: unknown): unknown {
    if (typeof v === "string") {
        return v.length > MAX_TEXT ? v.slice(0, MAX_TEXT) + `…[+${v.length - MAX_TEXT}字符]` : v;
    }
    return v;
}

/** 深拷贝结构并截断长字符串字段 */
function sanitizeResult(result?: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!result) return result ?? null;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(result)) {
        if (Array.isArray(v)) {
            out[k] = v.map(item => (typeof item === "string" ? truncateText(item) : item));
        } else if (v && typeof v === "object") {
            out[k] = JSON.parse(JSON.stringify(v, (_, val) => truncateText(val)));
        } else {
            out[k] = truncateText(v);
        }
    }
    return out;
}

let _dir: string | null = null;
function resolveDir(): string {
    if (_dir) return _dir;
    _dir = process.env.AI_EVAL_LOG_DIR || path.join(process.cwd(), ".ai-eval");
    return _dir;
}

/** 写一行 JSONL（同步 append，保证并发下不串行丢行；失败静默） */
export function logAiEval(entry: AiEvalEntry): void {
    try {
        const dir = resolveDir();
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const date = entry.ts.slice(0, 10) || new Date().toISOString().slice(0, 10);
        const file = path.join(dir, `ai-eval-${date}.jsonl`);
        const line = JSON.stringify({
            ...entry,
            errorMessage: entry.errorMessage ? truncateText(entry.errorMessage) : entry.errorMessage,
            result: sanitizeResult(entry.result),
        });
        fs.appendFileSync(file, line + "\n", "utf8");
    } catch {
        // 评估日志绝不影响主流程
    }
}

/** 构造一条条目的便捷函数（route 层调用后统一写盘） */
export function newEvalEntry(scene: AiEvalScene, partial: Partial<Omit<AiEvalEntry, "scene" | "ts">> = {}): AiEvalEntry {
    return {
        scene,
        ts: new Date().toISOString(),
        ok: false,
        statusCode: 500,
        durationMs: 0,
        model: "",
        provider: "",
        ...partial,
    };
}

/** 读当前 provider/model（评估日志需要固定版本对比） */
export function readProviderLabel(): { provider: string; model: string } {
    try {
        // 动态 require 避免与 route 层耦合；拿不到就回退空串
        const config = require("@grow/shared/config").getAppConfig?.();
        const provider = config?.aiProvider || "";
        const openai = config?.openai || {};
        const active = (openai.instances || []).find((i: { id: string }) => i.id === openai.activeInstanceId);
        const model = active?.model || config?.gemini?.model || config?.azure?.model || "";
        return { provider, model };
    } catch {
        return { provider: "", model: "" };
    }
}