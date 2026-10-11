/**
 * 题库工具函数单元测试：文本切分、去重哈希、难度档位、AI 解析结果容错
 */
import { describe, it, expect } from 'vitest';
import {
    splitQuestionBlocks,
    hashQuestionText,
    normalizeQuestionKey,
    adjacentDifficulties,
    normalizeDifficulty,
    normalizeQuestionType,
    bigramSimilarity,
    MAX_BLOCKS_PER_IMPORT,
} from '@grow/shared/bank-utils';
import { parseBankImportBatch } from '@grow/shared/ai/schema';
import { gongkaoLeafTags, GONGKAO_MODULES } from '@grow/shared/tag-data';

describe('bank-utils', () => {
    describe('splitQuestionBlocks', () => {
        it('按题号切分为多块，选项与解析并入当前块', () => {
            const raw = [
                '1. 下列说法正确的是',
                'A. 甲  B. 乙  C. 丙  D. 丁',
                '答案：B',
                '2、某单位组织活动……',
                'A. 红  B. 蓝  C. 绿  D. 黄',
                '【解析】略',
            ].join('\n');
            const blocks = splitQuestionBlocks(raw);
            expect(blocks).toHaveLength(2);
            expect(blocks[0]).toContain('1. 下列说法正确的是');
            expect(blocks[0]).toContain('答案：B');
            expect(blocks[1]).toContain('2、某单位组织活动');
            expect(blocks[1]).toContain('【解析】略');
        });

        it('支持全角句点与中文顿号题号', () => {
            const raw = '12．第一题\n内容\n13、第二题\n内容';
            const blocks = splitQuestionBlocks(raw);
            expect(blocks).toHaveLength(2);
        });

        it('无题号时整体作为单块', () => {
            const raw = '这是一段没有题号的材料，请判断下列说法是否正确。';
            const blocks = splitQuestionBlocks(raw);
            expect(blocks).toHaveLength(1);
            expect(blocks[0]).toContain('没有题号');
        });

        it('空文本返回空数组', () => {
            expect(splitQuestionBlocks('')).toEqual([]);
            expect(splitQuestionBlocks('   \n  ')).toEqual([]);
        });

        it('题目数量超过上限时截断', () => {
            const raw = Array.from({ length: MAX_BLOCKS_PER_IMPORT + 50 }, (_, i) => `${i + 1}. 题目 ${i}`).join('\n');
            const blocks = splitQuestionBlocks(raw);
            expect(blocks.length).toBeLessThanOrEqual(MAX_BLOCKS_PER_IMPORT);
        });
    });

    describe('hashQuestionText / normalizeQuestionKey', () => {
        it('空白与标点不影响哈希', () => {
            const a = hashQuestionText('下列说法 正确的是？');
            const b = hashQuestionText('下列说法正确的是？');
            const c = hashQuestionText('下列说法，正确的是！');
            expect(a).toBe(b);
            expect(a).toBe(c);
        });

        it('不同题干哈希不同', () => {
            expect(hashQuestionText('题目甲')).not.toBe(hashQuestionText('题目乙'));
        });

        it('normalizeQuestionKey 转小写并去空白标点', () => {
            expect(normalizeQuestionKey('Hello, World!')).toBe('helloworld');
        });
    });

    describe('adjacentDifficulties', () => {
        it('目标难度 ± 一档', () => {
            expect(adjacentDifficulties('medium')).toEqual(['easy', 'medium', 'hard']);
            expect(adjacentDifficulties('easy')).toEqual(['easy', 'medium']);
            expect(adjacentDifficulties('harder')).toEqual(['hard', 'harder']);
        });

        it('非法难度回退 medium', () => {
            expect(adjacentDifficulties('???')).toEqual(['medium']);
        });
    });

    describe('normalizeDifficulty / normalizeQuestionType', () => {
        it('难度归一化', () => {
            expect(normalizeDifficulty('HARD')).toBe('hard');
            expect(normalizeDifficulty('extreme')).toBeNull();
            expect(normalizeDifficulty(null)).toBeNull();
        });

        it('题型归一化', () => {
            expect(normalizeQuestionType('多选')).toBe('multiple');
            expect(normalizeQuestionType('subjective')).toBe('subjective');
            expect(normalizeQuestionType('unknown-type')).toBe('single');
        });
    });

    describe('bigramSimilarity', () => {
        it('相同文本为 1，无关文本接近 0', () => {
            expect(bigramSimilarity('削弱论证的题目内容', '削弱论证的题目内容')).toBe(1);
            expect(bigramSimilarity('削弱论证的题目内容', '增长率计算资料分析')).toBeLessThan(0.2);
        });
    });
});

describe('parseBankImportBatch', () => {
    it('解析标准 JSON 数组（snake_case）', () => {
        const raw = `[{"index":1,"question_text":"题干","answer_text":"B","analysis":"解析","subject":"判断推理","primary_tag":"削弱加强","extra_tags":["论证结构"],"difficulty":"hard","question_type":"single","requires_image":false,"confidence":"high"}]`;
        const items = parseBankImportBatch(raw);
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            index: 1,
            questionText: '题干',
            answerText: 'B',
            subject: '判断推理',
            primaryTag: '削弱加强',
            difficulty: 'hard',
            confidence: 'high',
        });
        expect(items[0].extraTags).toEqual(['论证结构']);
    });

    it('容忍 markdown 代码块包裹与缺字段', () => {
        const raw = '```json\n[{"questionText":"只有题干"}]\n```';
        const items = parseBankImportBatch(raw);
        expect(items).toHaveLength(1);
        expect(items[0].answerText).toBe('');
        expect(items[0].confidence).toBe('medium');
        expect(items[0].questionType).toBe('single');
    });

    it('跳过无题干的元素；全部无效视为 AI 响应错误（触发路由回滚重试）', () => {
        const items = parseBankImportBatch('[{"answer_text":"A"},{"question_text":"有效题干"}]');
        expect(items).toHaveLength(1);
        expect(() => parseBankImportBatch('[{"answer_text":"A"}]')).toThrow('AI_RESPONSE_ERROR');
        expect(() => parseBankImportBatch('no json here')).toThrow('AI_RESPONSE_ERROR');
        expect(() => parseBankImportBatch('{"not":"an array"}')).toThrow('AI_RESPONSE_ERROR');
    });
});

describe('gongkao tag tree', () => {
    it('五大模块完整，叶子清单归属正确', () => {
        expect(GONGKAO_MODULES).toEqual(['言语理解', '判断推理', '数量关系', '资料分析', '常识判断']);
        const leaves = gongkaoLeafTags();
        expect(leaves.length).toBeGreaterThan(50);
        expect(leaves.every(l => GONGKAO_MODULES.includes(l.module as typeof GONGKAO_MODULES[number]))).toBe(true);
        // 削弱加强是逻辑判断下的叶子
        const sRuo = leaves.find(l => l.leaf === '削弱加强');
        expect(sRuo).toMatchObject({ module: '判断推理', point: '逻辑判断' });
    });
});
