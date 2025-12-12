/**
 * 自定义标签管理单元测试
 * 测试 LocalStorage 相关的标签 CRUD 操作
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getCustomTags,
    addCustomTag,
    removeCustomTag,
    getAllCustomTagsFlat,
    isCustomTag,
    exportCustomTags,
    importCustomTags,
    clearCustomTags,
    getCustomTagsStats,
    type CustomTagsData,
} from '@/lib/custom-tags';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: () => {
            store = {};
        },
    };
})();

Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true,
});

describe('custom-tags', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    describe('getCustomTags', () => {
        it('应该返回空的默认结构（无存储数据时）', () => {
            const result = getCustomTags();
            expect(result).toEqual({
                math: [],
                english: [],
                physics: [],
                chemistry: [],
                other: [],
            });
        });

        it('应该正确读取存储的标签', () => {
            const mockData: CustomTagsData = {
                math: [{ name: '二次函数', category: '函数' }],
                english: [{ name: '完形填空', category: 'default' }],
                physics: [],
                chemistry: [],
                other: [],
            };
            localStorageMock.setItem('wrongnotebook_custom_tags', JSON.stringify(mockData));

            const result = getCustomTags();
            expect(result.math).toHaveLength(1);
            expect(result.math[0].name).toBe('二次函数');
            expect(result.english[0].name).toBe('完形填空');
        });

        it('应该自动迁移旧格式（string[] -> CustomTag[]）', () => {
            // 旧格式：直接存储字符串数组
            const oldFormatData = {
                math: ['一元一次方程', '二元一次方程'],
                english: ['语法'],
                physics: [],
                chemistry: [],
                other: [],
            };
            localStorageMock.setItem('wrongnotebook_custom_tags', JSON.stringify(oldFormatData));

            const result = getCustomTags();

            // 验证迁移后的格式
            expect(result.math[0]).toEqual({ name: '一元一次方程', category: 'default' });
            expect(result.math[1]).toEqual({ name: '二元一次方程', category: 'default' });
        });

        it('应该处理损坏的 JSON 数据', () => {
            localStorageMock.setItem('wrongnotebook_custom_tags', 'invalid json{');

            const result = getCustomTags();
            // 应该返回默认空结构
            expect(result).toEqual({
                math: [],
                english: [],
                physics: [],
                chemistry: [],
                other: [],
            });
        });
    });

    describe('addCustomTag', () => {
        it('应该成功添加新标签', () => {
            const result = addCustomTag('math', '三角函数', '函数');
            expect(result).toBe(true);

            const tags = getCustomTags();
            expect(tags.math).toContainEqual({ name: '三角函数', category: '函数' });
        });

        it('应该拒绝添加空标签', () => {
            const result = addCustomTag('math', '   ', 'default');
            expect(result).toBe(false);
        });

        it('应该拒绝添加重复标签', () => {
            addCustomTag('math', '二次函数', 'default');
            const result = addCustomTag('math', '二次函数', '函数');
            expect(result).toBe(false);
        });

        it('应该允许不同学科添加相同标签名', () => {
            addCustomTag('math', '分析', 'default');
            const result = addCustomTag('physics', '分析', 'default');
            expect(result).toBe(true);
        });

        it('应该正确处理 trim 空白字符', () => {
            const result = addCustomTag('math', '  三角函数  ', 'default');
            expect(result).toBe(true);

            const tags = getCustomTags();
            expect(tags.math[0].name).toBe('三角函数');
        });
    });

    describe('removeCustomTag', () => {
        it('应该成功删除已存在的标签', () => {
            addCustomTag('math', '一元一次方程', 'default');
            const result = removeCustomTag('math', '一元一次方程');
            expect(result).toBe(true);

            const tags = getCustomTags();
            expect(tags.math).toHaveLength(0);
        });

        it('应该返回 false 删除不存在的标签', () => {
            const result = removeCustomTag('math', '不存在的标签');
            expect(result).toBe(false);
        });
    });

    describe('getAllCustomTagsFlat', () => {
        it('应该返回所有标签的扁平数组', () => {
            addCustomTag('math', '函数', 'default');
            addCustomTag('english', '语法', 'default');
            addCustomTag('physics', '力学', 'default');

            const result = getAllCustomTagsFlat();
            expect(result).toContain('函数');
            expect(result).toContain('语法');
            expect(result).toContain('力学');
            expect(result).toHaveLength(3);
        });
    });

    describe('isCustomTag', () => {
        it('应该正确识别自定义标签', () => {
            addCustomTag('math', '自定义标签', 'default');
            expect(isCustomTag('自定义标签')).toBe(true);
        });

        it('应该返回 false 对于非自定义标签', () => {
            expect(isCustomTag('不存在的标签')).toBe(false);
        });
    });

    describe('exportCustomTags / importCustomTags', () => {
        it('应该正确导出为 JSON 字符串', () => {
            addCustomTag('math', '函数', '代数');
            const exported = exportCustomTags();

            const parsed = JSON.parse(exported);
            expect(parsed.math).toContainEqual({ name: '函数', category: '代数' });
        });

        it('应该正确导入 JSON 数据', () => {
            const importData = JSON.stringify({
                math: [{ name: '导入的标签', category: '测试' }],
                english: ['字符串格式标签'], // 测试旧格式兼容
                physics: [],
                chemistry: [],
                other: [],
            });

            const result = importCustomTags(importData);
            expect(result).toBe(true);

            const tags = getCustomTags();
            expect(tags.math[0].name).toBe('导入的标签');
            expect(tags.english[0].name).toBe('字符串格式标签');
        });

        it('应该拒绝无效的 JSON', () => {
            const result = importCustomTags('invalid json{');
            expect(result).toBe(false);
        });
    });

    describe('clearCustomTags', () => {
        it('应该清空所有自定义标签', () => {
            addCustomTag('math', '标签1', 'default');
            addCustomTag('english', '标签2', 'default');

            clearCustomTags();

            const tags = getCustomTags();
            expect(tags.math).toHaveLength(0);
            expect(tags.english).toHaveLength(0);
        });
    });

    describe('getCustomTagsStats', () => {
        it('应该返回正确的统计数据', () => {
            addCustomTag('math', '标签1', 'default');
            addCustomTag('math', '标签2', 'default');
            addCustomTag('english', '标签3', 'default');

            const stats = getCustomTagsStats();
            expect(stats.math).toBe(2);
            expect(stats.english).toBe(1);
            expect(stats.physics).toBe(0);
            expect(stats.total).toBe(3);
        });
    });
});
