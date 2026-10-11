/**
 * 识别结果不确定度检测
 *
 * analyze/reanswer 提示词约定：AI 在看不清的内容处用 [?] 占位、表格转录不全时注明
 * “可能不完整”、常识/时政没把握时在答案后注明「需人工核对」。这里统一扫描这些信号，
 * 供识别结果页在保存前提示用户“本次识别可能不准确，请对照原图核对”。
 *
 * 注意：shared/src/ai/uncertainty.ts 有同步副本（网页端使用），规则改动必须两端同步。
 */

export interface UncertaintySignal {
    key: string;
    /** 面向用户的原因说明 */
    message: string;
}

export interface UncertaintyReport {
    uncertain: boolean;
    signals: UncertaintySignal[];
}

/** 提示词约定的模糊占位符：[?] / [??] / [？]，不匹配裸问号（数学题常见 x=?） */
const FUZZY_PLACEHOLDER = /\[\s*[?？]{1,3}\s*\]/;
/** 提示词约定的转录不完整说明（表格处理规则） */
const INCOMPLETE = /可能不完整|无法完整识别|无法完整转录|识别不清/;
/** 提示词约定的答案人工核对标注（常识/时政） */
const NEEDS_MANUAL_CHECK = /需人工核对|无法百分百确认/;

export function detectUncertainty(input: {
    questionText?: string | null;
    answerText?: string | null;
    analysis?: string | null;
}): UncertaintyReport {
    const signals: UncertaintySignal[] = [];
    const question = input.questionText || "";
    const answer = input.answerText || "";
    const analysis = input.analysis || "";

    if (FUZZY_PLACEHOLDER.test(question) || FUZZY_PLACEHOLDER.test(answer)) {
        signals.push({ key: "fuzzy_placeholder", message: "题目中有看不清的内容，已用 [?] 占位" });
    }
    if (INCOMPLETE.test(question)) {
        signals.push({ key: "incomplete_question", message: "题干可能不完整（如表格、图表未完整转录）" });
    }
    if (NEEDS_MANUAL_CHECK.test(answer) || /需人工核对/.test(analysis)) {
        signals.push({ key: "needs_manual_check", message: "AI 对答案没有把握，已标注「需人工核对」" });
    }

    return { uncertain: signals.length > 0, signals };
}
