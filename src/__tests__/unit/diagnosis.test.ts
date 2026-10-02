import { describe, it, expect } from "vitest";
import {
    buildWeaknessReport,
    attachChapters,
    normalizeTagKey,
    READY_MIN_ERRORS,
    READY_MIN_CONFIDENCE,
    type DiagnosisErrorItem,
} from "../../lib/diagnosis";
import {
    buildTargetedAnchor,
    bigramSimilarity,
} from "../../lib/smart-practice";

const NOW = new Date("2026-10-01T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000);

function item(
    id: string,
    createdAt: Date,
    masteryLevel: number,
    tagNames: string[],
    tags: { id: string; name: string; parentId: string | null }[] = []
): DiagnosisErrorItem {
    return {
        id,
        createdAt,
        masteryLevel,
        tags: tagNames.map((name, i) => tags[i] ?? { id: `t-${name}`, name, parentId: null }),
    };
}

describe("buildWeaknessReport", () => {
    it("近期未掌握的错题比久远已掌握的得分更高", () => {
        const report = buildWeaknessReport({
            now: NOW,
            errorItems: [
                item("a1", daysAgo(3), 0, ["削弱论证"]),
                item("a2", daysAgo(5), 0, ["削弱论证"]),
                item("b1", daysAgo(200), 2, ["行程问题"]),
                item("b2", daysAgo(210), 2, ["行程问题"]),
            ],
        });
        const weak = report.kps.find(k => k.name === "削弱论证")!;
        const strong = report.kps.find(k => k.name === "行程问题")!;
        expect(weak.score).toBeGreaterThan(strong.score);
        expect(weak.ready).toBe(true);
        expect(weak.trend).toBe("worsening");
        expect(strong.trend).toBe("unknown"); // 90 天窗口外不计入趋势
    });

    it("练习折算为证据：同起点下，练习多错多卷的考点排名应上升、多对的应下降", () => {
        const errors = (name: string, prefix: string) =>
            Array.from({ length: 3 }, (_, i) => item(`${prefix}${i}`, daysAgo(i + 2), 0, [name]));
        const baseline = buildWeaknessReport({
            now: NOW,
            errorItems: [...errors("削弱论证", "a"), ...errors("图形推理", "b")],
        });
        // 同起点：两考点并列
        const s0 = baseline.kps.find(k => k.name === "削弱论证")!.score;
        const s1 = baseline.kps.find(k => k.name === "图形推理")!.score;
        expect(s0).toBe(s1);

        // 给削弱论证追加 4 次失败练习 → 应超过图形推理
        const worsened = buildWeaknessReport({
            now: NOW,
            errorItems: [...errors("削弱论证", "a"), ...errors("图形推理", "b")],
            practiceRecords: Array.from({ length: 4 }, (_, i) => ({
                tagId: "t-削弱论证",
                difficulty: "medium",
                isCorrect: false,
                createdAt: daysAgo(i),
            })),
        });
        expect(worsened.kps.find(k => k.name === "削弱论证")!.score).toBeGreaterThan(
            worsened.kps.find(k => k.name === "图形推理")!.score
        );
        expect(worsened.kps.find(k => k.name === "削弱论证")!.practiceAttempts).toBe(4);
        expect(worsened.kps.find(k => k.name === "削弱论证")!.practiceAccuracy).toBe(0);

        // 给图形推理追加 4 次全对练习 → 应降到削弱论证之下
        const improved = buildWeaknessReport({
            now: NOW,
            errorItems: [...errors("削弱论证", "a"), ...errors("图形推理", "b")],
            practiceRecords: Array.from({ length: 4 }, (_, i) => ({
                tagId: "t-图形推理",
                difficulty: "medium",
                isCorrect: true,
                createdAt: daysAgo(i),
            })),
        });
        expect(improved.kps.find(k => k.name === "图形推理")!.score).toBeLessThan(
            improved.kps.find(k => k.name === "削弱论证")!.score
        );
        expect(improved.kps.find(k => k.name === "图形推理")!.practiceAccuracy).toBe(1);
    });

    it("复发度：跨 3 个自然周反复错得满分，集中在 1 周的低分", () => {
        const recurring = buildWeaknessReport({
            now: NOW,
            errorItems: [
                item("a1", daysAgo(3), 0, ["资料分析"]),
                item("a2", daysAgo(12), 0, ["资料分析"]),
                item("a3", daysAgo(22), 0, ["资料分析"]),
            ],
        });
        const once = buildWeaknessReport({
            now: NOW,
            errorItems: [
                item("b1", daysAgo(3), 0, ["常识判断"]),
                item("b2", daysAgo(4), 0, ["常识判断"]),
                item("b3", daysAgo(5), 0, ["常识判断"]),
            ],
        });
        expect(recurring.kps.find(k => k.name === "资料分析")!.recurrence).toBe(1);
        expect(recurring.kps.find(k => k.name === "资料分析")!.score).toBeGreaterThan(
            once.kps.find(k => k.name === "常识判断")!.score
        );
    });

    it("证据不足的知识点不进 Top-K", () => {
        const report = buildWeaknessReport({
            now: NOW,
            errorItems: [
                item("solo", daysAgo(1), 0, ["定义判断"]),
                ...Array.from({ length: 3 }, (_, i) => item(`m${i}`, daysAgo(i + 2), 0, ["逻辑填空"])),
            ],
        });
        expect(report.topKps.map(k => k.name)).not.toContain("定义判断");
        expect(report.kps.find(k => k.name === "定义判断")!.ready).toBe(false);
        expect(report.readyKpCount).toBeGreaterThan(0);
    });

    it("锚题按权重排序，近期未掌握在前", () => {
        const report = buildWeaknessReport({
            now: NOW,
            errorItems: [
                item("old", daysAgo(120), 2, ["判断推理"]),
                item("new", daysAgo(2), 0, ["判断推理"]),
            ],
        });
        const kp = report.kps.find(k => k.name === "判断推理")!;
        expect(kp.evidenceErrorItemIds[0]).toBe("new");
    });

    it("无错题时返回空报告且不抛错", () => {
        const report = buildWeaknessReport({ now: NOW, errorItems: [] });
        expect(report.kps).toHaveLength(0);
        expect(report.topKps).toHaveLength(0);
        expect(report.totalErrorItems).toBe(0);
    });

    it("章节聚合：考点分数加权上卷到章节", () => {
        const tags = [
            { id: "ch1", name: "判断推理", parentId: null },
            { id: "t1", name: "削弱论证", parentId: "ch1" },
            { id: "t2", name: "图形推理", parentId: "ch1" },
        ];
        const report = buildWeaknessReport({
            now: NOW,
            errorItems: [
                { id: "e1", createdAt: daysAgo(1), masteryLevel: 0, tags: [tags[1]] },
                { id: "e2", createdAt: daysAgo(2), masteryLevel: 0, tags: [tags[2]] },
            ],
        });
        attachChapters(report, tags);
        expect(report.chapters).toHaveLength(1);
        expect(report.chapters[0].name).toBe("判断推理");
        expect(report.chapters[0].kpCount).toBe(2);
        const kp1 = report.kps.find(k => k.tagId === "t1")!;
        expect(kp1.chapterName).toBe("判断推理");
    });
});

describe("buildTargetedAnchor", () => {
    it("包含考点名、错因与反重复要求，并用分隔符避免换行", () => {
        const anchor = buildTargetedAnchor({
            tagName: "削弱论证",
            chapterName: "判断推理",
            exemplars: [
                { id: "1", questionText: "某研究发现……以下哪项削弱？", mistakeAnalysis: "混淆了相关与因果", masteryLevel: 0 },
            ],
        });
        expect(anchor).toContain("削弱论证");
        expect(anchor).toContain("判断推理");
        expect(anchor).toContain("混淆了相关与因果");
        expect(anchor).toContain("严禁与任何一道原题表面相似");
        expect(anchor).not.toContain("\n");
    });

    it("无锚题时降级为标准变式题指令", () => {
        const anchor = buildTargetedAnchor({ tagName: "行程问题", exemplars: [] });
        expect(anchor).toContain("标准变式题");
    });
});

describe("bigramSimilarity", () => {
    it("相同文本为 1，无关文本接近 0", () => {
        expect(bigramSimilarity("甲乙丙丁", "甲乙丙丁")).toBe(1);
        expect(bigramSimilarity("甲乙丙丁", "戊己庚辛")).toBeLessThan(0.1);
        expect(bigramSimilarity("甲乙", "甲乙")).toBe(1);
    });

    it("局部改动只造成中等相似度", () => {
        const sim = bigramSimilarity("下列关于行政处罚的说法正确的是", "下列关于行政许可的说法正确的是");
        expect(sim).toBeGreaterThan(0.3);
        expect(sim).toBeLessThan(0.95);
    });
});

describe("normalizeTagKey", () => {
    it("归一大小写、空白与标点，并应用别名表", () => {
        expect(normalizeTagKey("削弱加强型")).toBe(normalizeTagKey("削弱论证"));
        expect(normalizeTagKey("行程 问题")).toBe(normalizeTagKey("行程问题"));
        expect(normalizeTagKey("（图形推理）")).toBe(normalizeTagKey("图形推理"));
    });

    it("不同考点不误合并", () => {
        expect(normalizeTagKey("削弱论证")).not.toBe(normalizeTagKey("加强论证"));
    });
});

describe("buildWeaknessReport · 同义考点归并", () => {
    it("同义写法的考点归并为同一弱项，显示名取高频写法", () => {
        const report = buildWeaknessReport({
            now: NOW,
            errorItems: [
                item("a1", daysAgo(1), 0, ["削弱加强型"]),
                item("a2", daysAgo(2), 0, ["削弱论证"]),
                item("a3", daysAgo(3), 0, ["削弱论证"]),
            ],
        });
        const names = report.kps.map(k => k.name);
        expect(names).toContain("削弱论证");
        expect(names).not.toContain("削弱加强型");
        const kp = report.kps.find(k => k.name === "削弱论证")!;
        expect(kp.errorCount).toBe(3);
        expect(kp.ready).toBe(true);
    });

    it("不同考点不误合并", () => {
        const report = buildWeaknessReport({
            now: NOW,
            errorItems: [
                item("a1", daysAgo(1), 0, ["削弱论证"]),
                item("b1", daysAgo(1), 0, ["加强论证"]),
            ],
        });
        expect(report.kps).toHaveLength(2);
    });
});

describe("READY threshold constants", () => {
    it("门槛值与产品语义一致", () => {
        expect(READY_MIN_ERRORS).toBeGreaterThanOrEqual(2);
        expect(READY_MIN_CONFIDENCE).toBeGreaterThan(0);
        expect(READY_MIN_CONFIDENCE).toBeLessThanOrEqual(1);
    });
});
