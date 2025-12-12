/**
 * 工具函数单元测试
 * 测试 cn 合并类名函数
 */
import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (className utility)', () => {
    it('应该合并多个类名', () => {
        const result = cn('class1', 'class2', 'class3');
        expect(result).toBe('class1 class2 class3');
    });

    it('应该处理条件类名', () => {
        const isActive = true;
        const result = cn('base', isActive && 'active');
        expect(result).toBe('base active');
    });

    it('应该忽略 falsy 值', () => {
        const result = cn('base', false, null, undefined, '', 'valid');
        expect(result).toBe('base valid');
    });

    it('应该合并 tailwind 冲突类名（后者优先）', () => {
        const result = cn('text-red-500', 'text-blue-500');
        expect(result).toBe('text-blue-500');
    });

    it('应该处理对象格式的条件类名', () => {
        const result = cn('base', { 'is-active': true, 'is-disabled': false });
        expect(result).toBe('base is-active');
    });

    it('应该处理数组格式的类名', () => {
        const result = cn(['class1', 'class2'], 'class3');
        expect(result).toBe('class1 class2 class3');
    });

    it('应该合并 padding 冲突（后者优先）', () => {
        const result = cn('p-4', 'p-2');
        expect(result).toBe('p-2');
    });

    it('应该保留不冲突的类名', () => {
        const result = cn('p-4', 'mt-2', 'text-center');
        expect(result).toBe('p-4 mt-2 text-center');
    });

    it('应该处理空调用', () => {
        const result = cn();
        expect(result).toBe('');
    });
});
