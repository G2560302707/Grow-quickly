/**
 * 微信登录辅助函数单元测试
 * 覆盖 code2Session 响应解析与 openid→用户幂等映射
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
    user: {
        findUnique: vi.fn(),
        create: vi.fn(),
    },
}));

vi.mock('@grow/shared/prisma', () => ({ prisma: prismaMock }));

import {
    fetchWechatSession,
    wechatEmailForOpenid,
    findOrCreateWechatUser,
} from '@/lib/wechat-auth';

function mockFetchOnce(body: unknown, ok = true, status = 200) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok,
        status,
        json: () => Promise.resolve(body),
    }));
}

beforeEach(() => {
    vi.unstubAllGlobals();
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.create.mockReset();
});

describe('wechatEmailForOpenid', () => {
    it('按 openid 生成稳定合成邮箱', () => {
        expect(wechatEmailForOpenid('oABC123xyz')).toBe('wx-oABC123xyz@wechat.local');
        expect(wechatEmailForOpenid('oABC123xyz')).toBe(wechatEmailForOpenid('oABC123xyz'));
    });
});

describe('fetchWechatSession', () => {
    it('成功返回 openid 与 unionid', async () => {
        mockFetchOnce({ openid: 'oX1', unionid: 'uX1', session_key: 'sk' });
        const info = await fetchWechatSession('the-code', 'appid', 'secret');
        expect(info.openid).toBe('oX1');
        expect(info.unionid).toBe('uX1');
    });

    it('errcode 非零时抛 WECHAT_CODE_INVALID_<code>', async () => {
        mockFetchOnce({ errcode: 40029, errmsg: 'invalid code' });
        await expect(fetchWechatSession('bad', 'appid', 'secret'))
            .rejects.toThrow('WECHAT_CODE_INVALID_40029');
    });

    it('缺少 openid 且无 errcode 时抛 WECHAT_CODE_INVALID_UNKNOWN', async () => {
        mockFetchOnce({});
        await expect(fetchWechatSession('bad', 'appid', 'secret'))
            .rejects.toThrow('WECHAT_CODE_INVALID_UNKNOWN');
    });

    it('上游 HTTP 错误抛 WECHAT_UPSTREAM_<status>', async () => {
        mockFetchOnce({}, false, 502);
        await expect(fetchWechatSession('bad', 'appid', 'secret'))
            .rejects.toThrow('WECHAT_UPSTREAM_502');
    });
});

describe('findOrCreateWechatUser', () => {
    it('已有用户时直接返回，不创建', async () => {
        const existing = { id: 'u1', email: 'wx-o9@wechat.local', isActive: true };
        prismaMock.user.findUnique.mockResolvedValue(existing);
        const user = await findOrCreateWechatUser('o9');
        expect(user).toBe(existing);
        expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('新用户时按合成邮箱创建，密码为随机值、昵称带 openid 尾号', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
            id: 'u2', isActive: true, ...data,
        }));
        const user = await findOrCreateWechatUser('oABCDE123456') as Record<string, unknown>;
        expect(user.email).toBe('wx-oABCDE123456@wechat.local');
        expect(user.name).toBe('微信用户3456');
        expect(typeof user.password).toBe('string');
        expect((user.password as string).length).toBeGreaterThan(0);
        expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
    });
});
