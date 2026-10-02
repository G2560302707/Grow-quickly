import { describe, it, expect } from "vitest";
import { replayElo, difficultyForRating, difficultyRating } from "../../lib/elo";

describe("replayElo", () => {
    it("无记录时返回基础分 1200", () => {
        expect(replayElo([])).toEqual({ rating: 1200, attempts: 0, correct: 0 });
    });

    it("在 medium 上连续答对会提升能力值", () => {
        const state = replayElo(
            Array.from({ length: 5 }, (_, i) => ({
                difficulty: "medium",
                isCorrect: true,
                createdAt: new Date(2026, 0, i + 1),
            }))
        );
        expect(state.rating).toBeGreaterThan(1200);
        expect(state.attempts).toBe(5);
        expect(state.correct).toBe(5);
    });

    it("在 medium 上连续答错会下降且不低于 easy 档", () => {
        const state = replayElo(
            Array.from({ length: 10 }, (_, i) => ({
                difficulty: "medium",
                isCorrect: false,
                createdAt: new Date(2026, 0, i + 1),
            }))
        );
        expect(state.rating).toBeLessThan(1100);
        expect(difficultyForRating(state.rating)).toBe("easy");
    });

    it("难度加权：hard 答对应比 easy 答对涨得多", () => {
        const hard = replayElo([{ difficulty: "hard", isCorrect: true, createdAt: new Date() }]);
        const easy = replayElo([{ difficulty: "easy", isCorrect: true, createdAt: new Date() }]);
        expect(hard.rating).toBeGreaterThan(easy.rating);
    });

    it("回放顺序影响结果（按时间排序后计算，与传入顺序无关）", () => {
        const records = [
            { difficulty: "medium", isCorrect: false, createdAt: new Date(2026, 0, 2) },
            { difficulty: "medium", isCorrect: true, createdAt: new Date(2026, 0, 1) },
        ];
        const a = replayElo(records);
        const b = replayElo([...records].reverse());
        expect(a.rating).toBe(b.rating);
    });

    it("isCorrect 为 null 的记录不参与计算", () => {
        const state = replayElo([
            { difficulty: "medium", isCorrect: null, createdAt: new Date() },
            { difficulty: "medium", isCorrect: true, createdAt: new Date() },
        ]);
        expect(state.attempts).toBe(1);
        expect(state.correct).toBe(1);
        // 1200 起步，medium 基准 1200，预期 0.5，答对 +32×0.5
        expect(state.rating).toBe(1216);
    });
});

describe("difficultyForRating", () => {
    it("能力值映射到难度档位", () => {
        expect(difficultyForRating(1000)).toBe("easy");
        expect(difficultyForRating(1150)).toBe("medium");
        expect(difficultyForRating(1350)).toBe("hard");
        expect(difficultyForRating(1500)).toBe("harder");
    });
});
