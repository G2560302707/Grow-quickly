import { describe, expect, it } from 'vitest';
import { rateLimit, clientIp, resetRateLimits } from '@/lib/rate-limit';

describe('rateLimit', () => {
    it('窗口内超出配额后拒绝，并给出重试等待时间', () => {
        resetRateLimits();
        const opts = { limit: 2, windowMs: 60_000 };
        expect(rateLimit('k1', opts).allowed).toBe(true);
        expect(rateLimit('k1', opts).allowed).toBe(true);
        const third = rateLimit('k1', opts);
        expect(third.allowed).toBe(false);
        expect(third.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('不同 key 互不影响', () => {
        resetRateLimits();
        const opts = { limit: 1, windowMs: 60_000 };
        expect(rateLimit('k-a', opts).allowed).toBe(true);
        expect(rateLimit('k-b', opts).allowed).toBe(true);
        expect(rateLimit('k-a', opts).allowed).toBe(false);
    });

    it('时间窗口过后令牌补充恢复放行', async () => {
        resetRateLimits();
        const opts = { limit: 1, windowMs: 30 };
        expect(rateLimit('k-t', opts).allowed).toBe(true);
        expect(rateLimit('k-t', opts).allowed).toBe(false);
        await new Promise((r) => setTimeout(r, 40));
        expect(rateLimit('k-t', opts).allowed).toBe(true);
    });
});

describe('clientIp', () => {
    it('优先取 x-forwarded-for 首段', () => {
        const req = new Request('http://localhost/api/x', {
            headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
        });
        expect(clientIp(req)).toBe('1.2.3.4');
    });

    it('无代理头时回退 unknown', () => {
        const req = new Request('http://localhost/api/x');
        expect(clientIp(req)).toBe('unknown');
    });
});
