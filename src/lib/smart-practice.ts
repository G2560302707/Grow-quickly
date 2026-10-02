/**
 * 定向出题辅助：把"用户在该考点下的多道错题 + 错因"组合成结构化锚文本，
 * 通过现有 generateSimilarQuestion 管道实现接地生成（AI 层零改动）。
 */

export interface AnchorExemplar {
    id: string;
    questionText: string | null;
    mistakeAnalysis: string | null;
    masteryLevel?: number;
}

const ANCHOR_MAX_CHARS_PER_ITEM = 400;

function clip(text: string | null | undefined, max = ANCHOR_MAX_CHARS_PER_ITEM): string {
    const t = (text || "").trim();
    return t.length > max ? t.slice(0, max) + "…" : t;
}

/**
 * 组合锚文本。设计要点：
 * 1. 逐题给出"考点侧写"：AI 错因分析是最强的个性化信号
 * 2. 明确要求避开原题表面形式，考察同一考点的不同侧面
 * 3. 紧凑分隔符代替换行（上游模板会把换行转义成字面 \n）
 */
export function buildTargetedAnchor(opts: {
    tagName: string;
    chapterName?: string | null;
    exemplars: AnchorExemplar[];
    extraInstruction?: string;
}): string {
    const { tagName, chapterName, exemplars, extraInstruction } = opts;
    const parts: string[] = [];
    parts.push(`【定向出题简报】目标考点：${tagName}${chapterName ? `（所属章节：${chapterName}）` : ""}`);
    parts.push(`以下为学生本考点下的 ${exemplars.length} 道真实错题摘录及其错因，出题必须针对这些暴露出的薄弱细节：`);

    exemplars.forEach((ex, i) => {
        const masteryHint =
            ex.masteryLevel === undefined
                ? ""
                : ex.masteryLevel >= 2
                    ? "（已掌握，作为参考）"
                    : ex.masteryLevel === 1
                        ? "（复习中）"
                        : "（未掌握，重点针对）";
        parts.push(`原题${i + 1}${masteryHint}：${clip(ex.questionText)}`);
        if (ex.mistakeAnalysis) parts.push(`该题错因：${clip(ex.mistakeAnalysis, 200)}`);
    });

    if (exemplars.length > 0) {
        parts.push(
            "要求：新题与上述错题考察同一考点、命中同样的易错细节，但必须更换材料/情境/问法，严禁与任何一道原题表面相似；正确答案唯一且解析需点破该易错细节。"
        );
    } else {
        parts.push("要求：出一道该考点的标准变式题，正确答案唯一，解析点明核心易错点。");
    }

    if (extraInstruction) parts.push(`附加要求：${extraInstruction}`);
    return parts.join(" | ");
}

/** 字符二元组 Jaccard 相似度（定向出题去重用） */
export function bigramSimilarity(a: string, b: string): number {
    const norm = (s: string) => (s || "").replace(/\s+/g, "");
    const sa = norm(a);
    const sb = norm(b);
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
