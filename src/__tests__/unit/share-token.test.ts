import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createShareToken, verifyShareToken } from '@/lib/share-token'

describe('share-token', () => {
    const ORIGINAL = process.env.NEXTAUTH_SECRET

    beforeEach(() => {
        process.env.NEXTAUTH_SECRET = 'unit-test-secret'
        delete process.env.SHARE_TOKEN_SECRET
    })

    afterEach(() => {
        process.env.NEXTAUTH_SECRET = ORIGINAL
        delete process.env.SHARE_TOKEN_SECRET
    })

    it('签发后可校验通过', () => {
        const token = createShareToken('item-1')
        expect(token).toMatch(/^\d+\.[\w-]+$/)
        const res = verifyShareToken('item-1', token)
        expect(res.ok).toBe(true)
    })

    it('令牌与题目 id 绑定：换 id 校验失败', () => {
        const token = createShareToken('item-1')
        expect(verifyShareToken('item-2', token).ok).toBe(false)
    })

    it('缺少令牌 / 篡改签名 / 篡改过期时间都失败', () => {
        const token = createShareToken('item-1')
        const [exp, sig] = token.split('.')

        expect(verifyShareToken('item-1', undefined).ok).toBe(false)
        expect(verifyShareToken('item-1', 'not-a-token').ok).toBe(false)
        expect(verifyShareToken('item-1', `${exp}.${sig}x`).ok).toBe(false)
        expect(verifyShareToken('item-1', `${Number(exp) + 999}.${sig}`).ok).toBe(false)
    })

    it('过期令牌返回 expired', () => {
        const token = createShareToken('item-1', -10)
        const res = verifyShareToken('item-1', token)
        expect(res.ok).toBe(false)
        if (!res.ok) expect(res.reason).toBe('expired')
    })

    it('未配置密钥时不签发令牌', () => {
        delete process.env.NEXTAUTH_SECRET
        delete process.env.SHARE_TOKEN_SECRET
        expect(createShareToken('item-1')).toBe('')
    })
})
