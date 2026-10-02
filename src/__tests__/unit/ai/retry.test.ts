/**
 * AI 共享重试工具单元测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryOperation, isRetryableError } from '@/lib/ai/retry';

describe('isRetryableError', () => {
    it('网络类错误应可重试', () => {
        expect(isRetryableError(new Error('fetch failed'))).toBe(true);
        expect(isRetryableError(new Error('network error'))).toBe(true);
        expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
        expect(isRetryableError(new Error('Connection refused'))).toBe(true);
    });

    it('服务端/限流错误应可重试', () => {
        expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
        expect(isRetryableError(new Error('502 Bad Gateway'))).toBe(true);
        expect(isRetryableError(new Error('429 Too Many Requests'))).toBe(true);
        expect(isRetryableError(new Error('model overloaded'))).toBe(true);
    });

    it('超时错误应可重试', () => {
        expect(isRetryableError(new Error('Request timeout'))).toBe(true);
        expect(isRetryableError(new Error('The operation was aborted'))).toBe(true);
    });

    it('参数/认证类错误不应重试', () => {
        expect(isRetryableError(new Error('Invalid API key provided'))).toBe(false);
        expect(isRetryableError(new Error('400 bad request: missing field'))).toBe(false);
        expect(isRetryableError(new Error('Empty response from AI'))).toBe(false);
    });
});

describe('retryOperation', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('首次成功不应重试', async () => {
        const operation = vi.fn().mockResolvedValue('ok');

        const result = await retryOperation(operation, { label: 'test' });

        expect(result).toBe('ok');
        expect(operation).toHaveBeenCalledTimes(1);
    });

    it('瞬时失败后应重试并最终成功', async () => {
        const operation = vi.fn()
            .mockRejectedValueOnce(new Error('fetch failed'))
            .mockResolvedValue('ok');

        const promise = retryOperation(operation, { label: 'test' });

        // 第一次退避 1s
        await vi.advanceTimersByTimeAsync(1000);
        const result = await promise;

        expect(result).toBe('ok');
        expect(operation).toHaveBeenCalledTimes(2);
    });

    it('不可重试错误应立即抛出', async () => {
        const operation = vi.fn().mockRejectedValue(new Error('Invalid API key'));

        await expect(retryOperation(operation, { label: 'test' })).rejects.toThrow('Invalid API key');
        expect(operation).toHaveBeenCalledTimes(1);
    });

    it('达到最大重试次数后应抛出最后一个错误', async () => {
        const operation = vi.fn().mockRejectedValue(new Error('503 unavailable'));

        const promise = retryOperation(operation, { maxRetries: 3, label: 'test' });
        // 先挂接断言再推进定时器，避免 rejection 未被处理
        const assertion = expect(promise).rejects.toThrow('503 unavailable');
        // 退避 1s + 2s
        await vi.advanceTimersByTimeAsync(3000);
        await assertion;

        expect(operation).toHaveBeenCalledTimes(3);
    });
});
