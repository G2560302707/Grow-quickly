/**
 * 认证工具函数单元测试
 * 测试 isAdmin 和 requireAdmin 函数
 */
import { describe, it, expect } from 'vitest';
import { isAdmin, requireAdmin } from '@/lib/auth-utils';

describe('auth-utils', () => {
    describe('isAdmin', () => {
        it('应该对 admin 角色返回 true', () => {
            expect(isAdmin({ role: 'admin' })).toBe(true);
        });

        it('应该对 user 角色返回 false', () => {
            expect(isAdmin({ role: 'user' })).toBe(false);
        });

        it('应该对 null 返回 false', () => {
            expect(isAdmin(null)).toBe(false);
        });

        it('应该对 undefined 返回 false', () => {
            expect(isAdmin(undefined)).toBe(false);
        });

        it('应该对没有 role 属性的对象返回 false', () => {
            expect(isAdmin({})).toBe(false);
        });

        it('应该对空字符串 role 返回 false', () => {
            expect(isAdmin({ role: '' })).toBe(false);
        });
    });

    describe('requireAdmin', () => {
        it('应该对管理员 session 返回 true', () => {
            const session = {
                user: { id: 'admin-id', role: 'admin', email: 'admin@localhost' },
                expires: '2025-12-31',
            };
            expect(requireAdmin(session as any)).toBe(true);
        });

        it('应该对普通用户 session 返回 false', () => {
            const session = {
                user: { id: 'user-id', role: 'user', email: 'user@example.com' },
                expires: '2025-12-31',
            };
            expect(requireAdmin(session as any)).toBe(false);
        });

        it('应该对 null session 返回 false', () => {
            expect(requireAdmin(null)).toBe(false);
        });

        it('应该对没有 user 的 session 返回 false', () => {
            const session = {
                user: undefined,
                expires: '2025-12-31',
            } as any;
            expect(requireAdmin(session)).toBe(false);
        });
    });
});
