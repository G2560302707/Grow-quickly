/**
 * 轻量 Elo 能力估计（按 用户×知识点 维度，从练习历史确定性回放，无需持久化状态）
 *
 * 难度基准分：easy=1000 / medium=1200 / hard=1400 / harder=1500
 * 每题更新：R' = R + K × (结果 − 预期)，K=32，预期 = 1/(1+10^((D−R)/400))
 *
 * 设计取舍：题量级（个人练习几十到几百题）下，回放成本可忽略；
 * 相比落库 Elo 状态，回放永远与历史一致、可重算、可回溯。
 */

const BASE_RATING = 1200;
const K_FACTOR = 32;

const DIFFICULTY_RATING: Record<string, number> = {
    easy: 1000,
    medium: 1200,
    hard: 1400,
    harder: 1500,
};

export interface EloRecord {
    difficulty?: string | null;
    isCorrect?: boolean | null;
    createdAt?: Date | string;
}

export interface EloState {
    rating: number;
    attempts: number;
    correct: number;
}

export function difficultyRating(difficulty?: string | null): number {
    return DIFFICULTY_RATING[(difficulty || "").toLowerCase()] ?? BASE_RATING;
}

/** 从练习记录（按时间升序）回放 Elo；每题 0.5 分值平滑：首题按预期结果回缩 */
export function replayElo(records: EloRecord[]): EloState {
    let rating = BASE_RATING;
    let attempts = 0;
    let correct = 0;

    const sorted = [...records].sort(
        (a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime()
    );

    for (const r of sorted) {
        if (typeof r.isCorrect !== "boolean") continue; // 无结果的练习记录不参与
        const d = difficultyRating(r.difficulty);
        const expected = 1 / (1 + Math.pow(10, (d - rating) / 400));
        const outcome = r.isCorrect ? 1 : 0;
        rating += K_FACTOR * (outcome - expected);
        attempts += 1;
        if (r.isCorrect) correct += 1;
    }

    return { rating: Math.round(rating), attempts, correct };
}

/** 由能力值决定下一题难度档：低能力从简单起步，高能力挑战更难 */
export function difficultyForRating(rating: number): "easy" | "medium" | "hard" | "harder" {
    if (rating < 1100) return "easy";
    if (rating < 1300) return "medium";
    if (rating < 1450) return "hard";
    return "harder";
}

function toDate(v: Date | string | undefined): Date {
    if (!v) return new Date(0);
    return v instanceof Date ? v : new Date(v);
}
