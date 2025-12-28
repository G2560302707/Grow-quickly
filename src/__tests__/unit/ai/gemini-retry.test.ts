
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('@google/genai', () => {
    return {
        GoogleGenAI: class MockGoogleGenAI {
            models = {
                generateContent: vi.fn(),
            };
        },
    };
});

vi.mock('@/lib/logger', () => ({
    createLogger: vi.fn(() => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        box: vi.fn(),
    })),
}));

vi.mock('@/lib/config', () => ({
    getAppConfig: vi.fn(() => ({
        prompts: {},
    })),
}));

vi.mock('@/lib/ai/schema', () => ({
    safeParseParsedQuestion: vi.fn((data) => ({ success: true, data })),
}));

// Mock tag service to avoid DB calls
vi.mock('@/lib/ai/tag-service', () => ({
    getMathTagsFromDB: vi.fn().mockResolvedValue([]),
    getTagsFromDB: vi.fn().mockResolvedValue([]),
}));

import { GeminiProvider } from '@/lib/ai/gemini-provider';

describe('GeminiProvider Retry Logic', () => {
    let provider: GeminiProvider;
    let mockGenerateContent: any;

    beforeEach(() => {
        vi.clearAllMocks();
        provider = new GeminiProvider({ apiKey: 'test-key' });
        // @ts-ignore
        mockGenerateContent = provider.ai.models.generateContent;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should retry on network error and eventually succeed', async () => {
        vi.useFakeTimers();

        mockGenerateContent
            .mockRejectedValueOnce(new Error('fetch failed'))
            .mockRejectedValueOnce(new Error('network timeout'))
            .mockResolvedValue({
                text: '<question_text>Q</question_text><answer_text>A</answer_text><analysis>An</analysis><subject>数学</subject>',
                usageMetadata: {}
            });

        const promise = provider.analyzeImage('base64data');

        // Advance timers to trigger retries
        await vi.runAllTimersAsync();

        const result = await promise;

        expect(result).toBeDefined();
        // Initial call + 2 retries = 3 calls
        expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('should throw immediately on non-retryable error', async () => {
        mockGenerateContent.mockRejectedValue(new Error('AI_AUTH_ERROR: Invalid API Key'));

        // No need for fake timers as it should fail immediately
        await expect(provider.analyzeImage('base64data'))
            .rejects
            .toThrow('AI_AUTH_ERROR');

        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should give up after max retries', async () => {
        vi.useFakeTimers();

        mockGenerateContent.mockRejectedValue(new Error('fetch failed'));

        const promise = provider.analyzeImage('base64data');

        // Attach the expectation promise BEFORE triggering the timers that cause the rejection
        const validationPromise = expect(promise).rejects.toThrow('AI_CONNECTION_FAILED');

        // Advance time to exhaust all retries
        await vi.runAllTimersAsync();

        // Await the validation
        await validationPromise;

        expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });
});
