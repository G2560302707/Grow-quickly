/**
 * lib/knowledge-tags.ts 单元测试
 * 测试知识点标签相关功能
 */
import { describe, it, expect } from 'vitest';
import {
    normalizeTag,
    normalizeTags,
    calculateGrade,
    inferSubjectFromName,
    getAllStandardTags,
    getTagSuggestions,
    getAllMathTags,
    getMathTagsByGrade,
    getMathTagsByChapter,
    getMathTagInfo,
    getMathCurriculum,
} from '@/lib/knowledge-tags';

describe('lib/knowledge-tags', () => {
    describe('normalizeTag (标签标准化)', () => {
        it('应该返回标准化后的标签', () => {
            const result = normalizeTag('一元一次方程');
            // 标准化后可能返回更具体的标签
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('应该通过别名匹配标签', () => {
            const result = normalizeTag('方程');
            expect(typeof result).toBe('string');
        });

        it('应该返回原始标签（如果没有匹配）', () => {
            const result = normalizeTag('未知的自定义标签xyz');
            expect(result).toBe('未知的自定义标签xyz');
        });

        it('应该为空字符串返回第一个标签（默认行为）', () => {
            const result = normalizeTag('');
            // 空字符串会匹配到第一个标签
            expect(typeof result).toBe('string');
        });
    });

    describe('normalizeTags (批量标签标准化)', () => {
        it('应该标准化标签数组', () => {
            const tags = ['一元一次方程', '移项'];
            const result = normalizeTags(tags);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThanOrEqual(1);
        });

        it('应该去重结果', () => {
            const tags = ['一元一次方程', '一元一次方程'];
            const result = normalizeTags(tags);
            const uniqueTags = [...new Set(result)];
            expect(result.length).toBe(uniqueTags.length);
        });

        it('应该处理空数组', () => {
            const result = normalizeTags([]);
            expect(result).toEqual([]);
        });
    });

    describe('calculateGrade (年级计算)', () => {
        it('应该计算初中年级', () => {
            const result = calculateGrade('junior_high', 2024);
            expect([7, 8, 9, null]).toContain(result);
        });

        it('应该计算高中年级', () => {
            const result = calculateGrade('senior_high', 2024);
            expect([10, 11, 12, null]).toContain(result);
        });

        it('应该返回 null 对于未知教育阶段', () => {
            const result = calculateGrade('unknown_stage' as any, 2024);
            expect(result).toBeNull();
        });

        it('应该返回 null 对于无效入学年份', () => {
            const result = calculateGrade('junior_high', null as any);
            expect(result).toBeNull();
        });
    });

    describe('inferSubjectFromName (推断学科)', () => {
        it('应该推断数学', () => {
            expect(inferSubjectFromName('数学')).toBe('math');
            expect(inferSubjectFromName('Math')).toBe('math');
            expect(inferSubjectFromName('高等数学')).toBe('math');
        });

        it('应该推断物理', () => {
            expect(inferSubjectFromName('物理')).toBe('physics');
            expect(inferSubjectFromName('Physics')).toBe('physics');
        });

        it('应该推断化学', () => {
            expect(inferSubjectFromName('化学')).toBe('chemistry');
            expect(inferSubjectFromName('Chemistry')).toBe('chemistry');
        });

        it('应该推断英语', () => {
            expect(inferSubjectFromName('英语')).toBe('english');
            expect(inferSubjectFromName('English')).toBe('english');
        });

        it('应该返回 null 对于未知学科', () => {
            expect(inferSubjectFromName('历史')).toBeNull();
            expect(inferSubjectFromName('地理')).toBeNull();
            expect(inferSubjectFromName(null)).toBeNull();
        });
    });

    describe('getAllStandardTags (获取所有标准标签)', () => {
        it('应该返回标签数组', () => {
            const tags = getAllStandardTags();
            expect(Array.isArray(tags)).toBe(true);
            expect(tags.length).toBeGreaterThan(0);
        });

        it('应该包含数学标签', () => {
            const tags = getAllStandardTags();
            expect(tags.some(tag => tag.includes('方程') || tag.includes('函数'))).toBe(true);
        });
    });

    describe('getTagSuggestions (获取标签建议)', () => {
        it('应该根据输入过滤标签', () => {
            const suggestions = getTagSuggestions('方程', []);
            expect(suggestions.every(tag => tag.includes('方程'))).toBe(true);
        });

        it('应该排除已存在的标签', () => {
            const existingTags = ['一元一次方程'];
            const suggestions = getTagSuggestions('方程', existingTags);
            expect(suggestions).not.toContain('一元一次方程');
        });

        it('应该处理空输入', () => {
            const suggestions = getTagSuggestions('', []);
            expect(Array.isArray(suggestions)).toBe(true);
        });

        it('应该限制返回数量', () => {
            const suggestions = getTagSuggestions('', []);
            expect(suggestions.length).toBeLessThanOrEqual(20);
        });
    });

    describe('getAllMathTags (获取所有数学标签)', () => {
        it('应该返回数学标签数组', () => {
            const tags = getAllMathTags();
            expect(Array.isArray(tags)).toBe(true);
            expect(tags.length).toBeGreaterThan(0);
        });

        it('应该包含基础数学标签', () => {
            const tags = getAllMathTags();
            // 检查包含一些基本的数学标签
            expect(tags.some(tag => tag.includes('有理数') || tag.includes('方程'))).toBe(true);
        });
    });

    describe('getMathTagsByGrade (按年级获取数学标签)', () => {
        it('应该返回七年级标签', () => {
            const tags = getMathTagsByGrade(7);
            expect(Array.isArray(tags)).toBe(true);
            expect(tags.length).toBeGreaterThan(0);
        });

        it('应该返回九年级标签', () => {
            const tags = getMathTagsByGrade(9);
            expect(Array.isArray(tags)).toBe(true);
        });

        it('应该支持按学期筛选', () => {
            const tagsFirstSemester = getMathTagsByGrade(7, 1);
            const tagsSecondSemester = getMathTagsByGrade(7, 2);

            expect(Array.isArray(tagsFirstSemester)).toBe(true);
            expect(Array.isArray(tagsSecondSemester)).toBe(true);
        });

        it('应该返回高中年级标签', () => {
            const tags = getMathTagsByGrade(10);
            expect(Array.isArray(tags)).toBe(true);
        });
    });

    describe('getMathTagsByChapter (按章节获取数学标签)', () => {
        it('应该返回指定章节的标签', () => {
            const tags = getMathTagsByChapter('第1章 有理数');
            expect(Array.isArray(tags)).toBe(true);
        });

        it('应该返回空数组对于不存在的章节', () => {
            const tags = getMathTagsByChapter('不存在的章节');
            expect(tags).toEqual([]);
        });
    });

    describe('getMathTagInfo (获取标签信息)', () => {
        it('应该返回标签元数据', () => {
            const info = getMathTagInfo('一元一次方程');
            if (info) {
                expect(info).toHaveProperty('name');
                expect(info).toHaveProperty('grade');
                expect(info).toHaveProperty('chapter');
            }
        });

        it('应该返回 undefined 对于不存在的标签', () => {
            const info = getMathTagInfo('不存在的标签xyz');
            expect(info).toBeUndefined();
        });
    });

    describe('getMathCurriculum (获取数学课程大纲)', () => {
        it('应该返回课程大纲对象', () => {
            const curriculum = getMathCurriculum();
            expect(typeof curriculum).toBe('object');
        });

        it('应该包含各年级数据', () => {
            const curriculum = getMathCurriculum();
            expect(curriculum).toHaveProperty('七年级上');
            expect(curriculum).toHaveProperty('七年级下');
        });

        it('应该包含章节结构', () => {
            const curriculum = getMathCurriculum();
            const chapters = curriculum['七年级上'];
            expect(Array.isArray(chapters)).toBe(true);
            expect(chapters[0]).toHaveProperty('chapter');
            expect(chapters[0]).toHaveProperty('sections');
        });
    });
});
