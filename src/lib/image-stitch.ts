/**
 * 多图纵向拼接工具（服务端）
 *
 * 用途：把同一道题的多张照片（如题干第一张、后续问/配图第二张……）纵向拼成一张完整题目图，
 * 再交给现有单图 analyzeImage 链路整体识别。跨端共用：Web / uniapp / 小程序都只传 images[]，
 * 拼接逻辑只在此处实现一份。
 *
 * 依赖 sharp（Next.js 已内置，作为学习端直接依赖声明）。
 */
import sharp from 'sharp';
import { createLogger } from '@grow/shared/logger';

const logger = createLogger('lib:image-stitch');

export interface StitchImageInput {
    base64: string;   // 不含 data URL 前缀的原始 base64
    mimeType: string; // image/jpeg | image/png | image/webp | image/gif
}

export interface StitchOptions {
    /** 拼接统一宽度（px），默认 1400 */
    maxWidth?: number;
    /** 拼接后最大总高（px），超出则等比缩宽度，默认 12000 */
    maxHeight?: number;
    /** 缩宽度下限（px），低于此仍超高则报错，默认 640 */
    minWidth?: number;
    /** 拼接后最大体积（MB，解码后），默认 8 */
    maxSizeMB?: number;
    /** JPEG 起始质量，默认 85；超体积时逐档下调 */
    jpegQuality?: number;
}

export interface StitchResult {
    base64: string;
    width: number;
    height: number;
    mimeType: 'image/jpeg';
}

export const STITCH_LIMITS = {
    MAX_WIDTH: 1400,
    MAX_HEIGHT: 12000,
    MIN_WIDTH: 640,
    MAX_SIZE_MB: 8,
    JPEG_QUALITY: 85,
} as const;

interface PreparedLayer {
    buffer: Buffer;
    width: number;
    height: number;
}

/** 单张解码 + EXIF 自动旋转 + 缩放到统一宽度 */
async function prepareLayer(input: StitchImageInput, width: number): Promise<PreparedLayer> {
    const pipeline = sharp(Buffer.from(input.base64, 'base64'), { failOn: 'none' }).rotate();
    const out = await pipeline
        .resize({ width })
        .toBuffer({ resolveWithObject: true });
    return { buffer: out.data, width: out.info.width, height: out.info.height };
}

/**
 * 纵向拼接多张图片为一张白底长图。
 * @throws 无图片 / 拼接后即使缩到最小宽度仍超高时抛出带中文说明的错误
 */
export async function stitchImagesVertically(
    images: StitchImageInput[],
    options: StitchOptions = {}
): Promise<StitchResult> {
    if (!Array.isArray(images) || images.length === 0) {
        throw new Error('没有可拼接的图片');
    }

    const maxWidth = options.maxWidth ?? STITCH_LIMITS.MAX_WIDTH;
    const maxHeight = options.maxHeight ?? STITCH_LIMITS.MAX_HEIGHT;
    const minWidth = options.minWidth ?? STITCH_LIMITS.MIN_WIDTH;
    const maxSizeMB = options.maxSizeMB ?? STITCH_LIMITS.MAX_SIZE_MB;
    const startQuality = options.jpegQuality ?? STITCH_LIMITS.JPEG_QUALITY;

    let width = maxWidth;
    let layers: PreparedLayer[] = [];
    let totalHeight = 0;

    // 第一遍：按默认宽度处理并求和
    for (const img of images) {
        const layer = await prepareLayer(img, width);
        layers.push(layer);
        totalHeight += layer.height;
    }

    // 总高超限：等比缩宽度重算（避免超高长图触发模型 token / 内存问题）
    if (totalHeight > maxHeight) {
        const scale = maxHeight / totalHeight;
        const newWidth = Math.max(minWidth, Math.round(width * scale));
        if (newWidth === width) {
            throw new Error('拼接后图片过长，请减少图片数量或压缩后重试');
        }
        layers = [];
        totalHeight = 0;
        width = newWidth;
        for (const img of images) {
            const layer = await prepareLayer(img, width);
            layers.push(layer);
            totalHeight += layer.height;
        }
        if (totalHeight > maxHeight) {
            throw new Error('拼接后图片过长，请减少图片数量或压缩后重试');
        }
    }

    logger.debug({ layers: layers.length, width, totalHeight }, 'Stitch layers prepared');

    // 质量自适应：JPEG 体积超标时逐档下调，最低 40
    let quality = startQuality;
    let merged: Awaited<ReturnType<typeof composeLayers>>;
    do {
        merged = await composeLayers(layers, width, totalHeight, quality);
        const sizeMB = merged.buffer.length / 1024 / 1024;
        if (sizeMB <= maxSizeMB || quality <= 40) break;
        quality -= 10;
    } while (true);

    logger.info({
        width: merged.width,
        height: merged.height,
        sizeKB: Math.round(merged.buffer.length / 1024),
        quality,
    }, 'Image stitched');

    return {
        base64: merged.buffer.toString('base64'),
        width: merged.width,
        height: merged.height,
        mimeType: 'image/jpeg',
    };
}

async function composeLayers(
    layers: PreparedLayer[],
    width: number,
    totalHeight: number,
    quality: number
): Promise<{ buffer: Buffer; width: number; height: number }> {
    const canvas = sharp({
        create: {
            width,
            height: totalHeight,
            channels: 3,
            background: { r: 255, g: 255, b: 255 },
        },
    });

    const composites: sharp.OverlayOptions[] = [];
    let top = 0;
    for (const layer of layers) {
        composites.push({ input: layer.buffer, top, left: 0 });
        top += layer.height;
    }

    const out = await canvas
        .composite(composites)
        .jpeg({ quality })
        .toBuffer({ resolveWithObject: true });

    return { buffer: out.data, width: out.info.width, height: out.info.height };
}
