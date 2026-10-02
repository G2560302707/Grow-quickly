/**
 * AI 请求共享重试工具
 *
 * 对可重试的瞬时错误（网络抖动、429/5xx、超时等）做指数退避重试。
 * 各 provider（gemini/openai/azure）共用，保证重试口径一致。
 */
import { createLogger } from '../logger';

const logger = createLogger('ai:retry');

/** 可重试错误的关键字特征（小写匹配） */
const RETRYABLE_PATTERNS = [
    'fetch failed',
    'network',
    'connect',
    '429',
    'rate limit',
    '503',
    '502', // Bad Gateway
    '504', // Gateway Timeout
    'overloaded',
    'timeout',
    'etimedout', // Connection timeout
    'enotfound', // DNS resolution failed
    'econnreset',
    'econnrefused', // Connection refused
    'unavailable',
    'aborted',
];

export function isRetryableError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return RETRYABLE_PATTERNS.some(pattern => msg.includes(pattern));
}

/**
 * 带指数退避的重试（1s, 2s, 4s ...）
 * @param operation 要执行的异步操作
 * @param options.maxRetries 最大尝试次数（含首次），默认 3
 * @param options.label 日志标签（如 'gemini:analyzeImage'）
 */
export async function retryOperation<T>(
    operation: () => Promise<T>,
    options: { maxRetries?: number; label?: string } = {}
): Promise<T> {
    const { maxRetries = 3, label = 'operation' } = options;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            if (!isRetryableError(error) || attempt === maxRetries) {
                throw error;
            }

            const delay = Math.pow(2, attempt - 1) * 1000;
            logger.warn({
                label,
                attempt,
                maxRetries,
                nextRetryDelayMs: delay,
                error: error instanceof Error ? error.message : String(error),
            }, 'AI operation failed, retrying...');
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}
