import { describe, expect, it } from 'vitest';
import { parseChoiceOptions, parseCorrectOption } from '@/lib/practice-choice';

describe('parseChoiceOptions', () => {
    it('解析逐行选项并从题干剥离', () => {
        const text = [
            '下列哪项属于削弱论证？',
            '某研究表明常喝咖啡的人心脏更好。',
            'A. 咖啡有益健康',
            'B. 研究样本存在偏差',
            'C. 咖啡价格上涨',
            'D. 很多人不喝咖啡',
        ].join('\n');
        const parsed = parseChoiceOptions(text);
        expect(parsed).not.toBeNull();
        expect(parsed!.stem).toContain('削弱论证');
        expect(parsed!.stem).not.toContain('A.');
        expect(parsed!.options).toHaveLength(4);
        expect(parsed!.options[2]).toEqual({ label: 'C', text: '咖啡价格上涨' });
    });

    it('解析同行多个选项', () => {
        const text = '以下说法正确的是？\nA. 甲 B. 乙 C. 丙 D. 丁';
        const parsed = parseChoiceOptions(text);
        expect(parsed).not.toBeNull();
        expect(parsed!.options.map(o => o.label)).toEqual(['A', 'B', 'C', 'D']);
        expect(parsed!.options[1].text).toBe('乙');
    });

    it('兼容全角字母与中文顿号分隔', () => {
        const text = '题干\nＡ、选项一\nＢ、选项二';
        const parsed = parseChoiceOptions(text);
        expect(parsed).not.toBeNull();
        expect(parsed!.options[0].label).toBe('A');
        expect(parsed!.options[1].text).toBe('选项二');
    });

    it('非选择题返回 null', () => {
        expect(parseChoiceOptions('求解这个方程 2x + 3 = 7')).toBeNull();
        expect(parseChoiceOptions(undefined)).toBeNull();
        expect(parseChoiceOptions('')).toBeNull();
    });

    it('选项字母不连续时返回 null（防止误切正文）', () => {
        const text = '题干 A. 甲\nC. 丙';
        expect(parseChoiceOptions(text)).toBeNull();
    });
});

describe('parseCorrectOption', () => {
    it('提取开头字母答案', () => {
        expect(parseCorrectOption('B')).toBe('B');
        expect(parseCorrectOption('B、长城')).toBe('B');
        expect(parseCorrectOption('D. 以上都不对')).toBe('D');
        expect(parseCorrectOption('Ｃ')).toBe('C');
    });

    it('提取"正确答案"字样后的字母', () => {
        expect(parseCorrectOption('正确答案：A')).toBe('A');
        expect(parseCorrectOption('答案是 C，因为……')).toBe('C');
    });

    it('无法确定时返回 null', () => {
        expect(parseCorrectOption('因为两边同时平方可证')).toBeNull();
        expect(parseCorrectOption(undefined)).toBeNull();
        // 开头是单词而非选项字母（A 后跟字母不属于选项）
        expect(parseCorrectOption('Analysis shows that...')).toBeNull();
    });
});
