/**
 * 识别结果不确定度检测单元测试
 * 对应 analyze/reanswer 提示词中约定的三类信号：[?] 占位、转录不完整、需人工核对
 */
import { describe, it, expect } from 'vitest';
import { detectUncertainty } from '@grow/shared/ai/uncertainty';

describe('detectUncertainty', () => {
    it('无信号时返回 uncertain=false', () => {
        const report = detectUncertainty({
            questionText: '下列选项中正确的是（　）\nA. 甲 B. 乙 C. 丙 D. 丁',
            answerText: 'B',
            analysis: '### 1. 考点\n削弱加强',
        });
        expect(report.uncertain).toBe(false);
        expect(report.signals).toHaveLength(0);
    });

    it('空输入/缺字段视为无信号', () => {
        expect(detectUncertainty({}).uncertain).toBe(false);
        expect(detectUncertainty({ questionText: '', answerText: null as unknown as string }).uncertain).toBe(false);
    });

    it('题干含 [?] 占位符时给出提示', () => {
        const report = detectUncertainty({ questionText: '增长率约为 [?]' });
        expect(report.uncertain).toBe(true);
        expect(report.signals[0].key).toBe('fuzzy_placeholder');
    });

    it('识别全角问号占位 [？]', () => {
        expect(detectUncertainty({ questionText: '值为[？]' }).signals[0].key).toBe('fuzzy_placeholder');
    });

    it('裸问号（如 x=?）不触发占位符信号', () => {
        expect(detectUncertainty({ questionText: '则 x = ?' }).uncertain).toBe(false);
    });

    it('题干注明表格内容可能不完整时给出提示', () => {
        const report = detectUncertainty({ questionText: '（表格内容可能不完整）' });
        expect(report.uncertain).toBe(true);
        expect(report.signals[0].key).toBe('incomplete_question');
    });

    it('答案标注「需人工核对」时给出提示', () => {
        const report = detectUncertainty({ answerText: 'C（需人工核对）' });
        expect(report.uncertain).toBe(true);
        expect(report.signals[0].key).toBe('needs_manual_check');
    });

    it('解析标注「需人工核对」同样触发', () => {
        const report = detectUncertainty({ analysis: '该时政点较新，需人工核对。' });
        expect(report.signals[0].key).toBe('needs_manual_check');
    });

    it('多个信号同时存在时全部列出', () => {
        const report = detectUncertainty({
            questionText: '如图 [?] 所示（表格内容可能不完整）',
            answerText: 'D（需人工核对）',
        });
        expect(report.uncertain).toBe(true);
        expect(report.signals.map(s => s.key).sort()).toEqual(
            ['fuzzy_placeholder', 'incomplete_question', 'needs_manual_check'].sort()
        );
    });
});
