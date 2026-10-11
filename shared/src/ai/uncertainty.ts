/**
 * 识别结果不确定度检测
 *
 * analyze/reanswer 提示词约定：AI 在看不清的内容处用 [?] 占位、表格转录不全时注明
 * “可能不完整”、常识/时政没把握时在答案后注明「需人工核对」。这里统一扫描这些信号，
 * 供前端在保存前向用户提示“本次识别可能不准确，请对照原图核对”。
 *
 * 注意：uniapp 端在 src/utils/uncertainty.ts 有一份同步副本（uniapp 不引用 shared 包），
 * 规则改动必须两端同步。
 */

export interface UncertaintySignal {
    /** 稳定规则标识，便于测试与埋点 */
    key: string;
    /** 面向用户的原因说明 */
    message: string;
}

export interface UncertaintyReport {
    /** 是否存在需要用户核对的信号 */
    uncertain: boolean;
    signals: UncertaintySignal[];
}

/** 提示词约定的模糊占位符：[?] / [??] / [？]，不匹配裸问号（数学题常见 x=?） */
const FUZZY_PLACEHOLDER = /\[\s*[?？]{1,3}\s*\]/;
/** 提示词约定的转录不完整说明（表格处理规则） */
const INCOMPLETE = /可能不完整|无法完整识别|无法完整转录|识别不清/;
/** 提示词约定的答案人工核对标注（常识/时政） */
const NEEDS_MANUAL_CHECK = /需人工核对|无法百分百确认/;

/**
 * 检测 AI 识别结果中的不确定信号
 * @param input 识别结果的关键文本字段（均可选，空值视为无信号）
 */
export function detectUncertainty(input: {
    questionText?: string | null;
    answerText?: string | null;
    analysis?: string | null;
}): UncertaintyReport {
    const signals: UncertaintySignal[] = [];
    const question = input.questionText || '';
    const answer = input.answerText || '';
    const analysis = input.analysis || '';

    if (FUZZY_PLACEHOLDER.test(question) || FUZZY_PLACEHOLDER.test(answer)) {
        signals.push({ key: 'fuzzy_placeholder', message: '题目中有看不清的内容，已用 [?] 占位' });
    }
    if (INCOMPLETE.test(question)) {
        signals.push({ key: 'incomplete_question', message: '题干可能不完整（如表格、图表未完整转录）' });
    }
    if (NEEDS_MANUAL_CHECK.test(answer) || /需人工核对/.test(analysis)) {
        signals.push({ key: 'needs_manual_check', message: 'AI 对答案没有把握，已标注「需人工核对」' });
    }

    return { uncertain: signals.length > 0, signals };
}
