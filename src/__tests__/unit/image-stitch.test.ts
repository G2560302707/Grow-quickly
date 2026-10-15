/**
 * 多图纵向拼接工具单元测试
 */
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { stitchImagesVertically, STITCH_LIMITS } from '@/lib/image-stitch';

/** 生成纯色 PNG 的 base64（无 data URL 前缀） */
async function makePng(width: number, height: number, color: string): Promise<string> {
    const buf = await sharp({
        create: { width, height, channels: 3, background: color },
    }).png().toBuffer();
    return buf.toString('base64');
}

describe('stitchImagesVertically', () => {
    it('应该统一宽度纵向拼接并返回 JPEG', async () => {
        const red = await makePng(200, 100, '#ff0000');
        const blue = await makePng(200, 150, '#0000ff');

        const result = await stitchImagesVertically([
            { base64: red, mimeType: 'image/png' },
            { base64: blue, mimeType: 'image/png' },
        ]);

        expect(result.mimeType).toBe('image/jpeg');
        expect(result.width).toBe(1400); // 统一宽度
        expect(result.height).toBe((1400 / 200) * (100 + 150)); // 700 + 1050
        expect(result.base64.length).toBeGreaterThan(0);
        expect(result.base64.startsWith('data:')).toBe(false);
    });

    it('应该把不同宽度的图片统一到同一宽度', async () => {
        const wide = await makePng(400, 100, '#0a141e');
        const narrow = await makePng(100, 100, '#28323c');

        const result = await stitchImagesVertically([
            { base64: wide, mimeType: 'image/png' },
            { base64: narrow, mimeType: 'image/png' },
        ]);

        expect(result.width).toBe(1400);
        expect(result.height).toBe((1400 / 100) * 100 + (1400 / 400) * 100); // 1400 + 350
    });

    it('超过 maxHeight 时应等比缩宽度', async () => {
        // 10 张 1400 宽、2000 高的图会远超 12000
        const tall = await makePng(1400, 2000, '#0064c8');
        const images = Array.from({ length: 10 }, () => ({ base64: tall, mimeType: 'image/png' as const }));

        const result = await stitchImagesVertically(images);
        expect(result.width).toBeLessThan(STITCH_LIMITS.MAX_WIDTH);
        expect(result.height).toBeLessThanOrEqual(STITCH_LIMITS.MAX_HEIGHT);
    });

    it('无图片时应抛出错误', async () => {
        await expect(stitchImagesVertically([])).rejects.toThrow();
    });
});
