/**
 * 小程序端 LaTeX 公式工具
 * - 解析内联/块级 $...$ / $$...$$ 公式
 * - 调用后端 /api/render-latex 把 LaTeX 渲染成自包含 SVG 的 data URL，
 *   用 <image>/<rich-text> 按时抠图展示（小程序端无法运行 KaTeX/MathJax）
 * - 内存缓存 + 并发去重：同一公式只请求一次
 */
import { request } from "./request";

export interface MathSegment {
    type: "text" | "math";
    /** 文本片段原文；或公式片段的 LaTeX 内容（不含 $ 定界符） */
    s: string;
}

const SRC_CACHE = new Map<string, string>();
const PENDING = new Map<string, Promise<string>>();

/** 解析字符串中的 $...$ / $$...$$ 公式，返回文本与公式交替的片段列表 */
export function parseMathSegments(text: string): MathSegment[] {
    const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
    const segs: MathSegment[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
        if (m.index > last) segs.push({ type: "text", s: text.slice(last, m.index) });
        const body = (m[1] ?? m[2] ?? "").trim();
        if (body) segs.push({ type: "math", s: body });
        last = m.index + m[0].length;
    }
    if (last < text.length) {
        segs.push({ type: "text", s: text.slice(last) });
    }
    return segs.filter((s) => !(s.type === "text" && !s.s));
}

/** 转义富文本里的 HTML 特殊字符（用于文本片段安全嵌入） */
export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export const TRANSPARENT_GIF =
    "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/** 获取某条公式的 SVG data URL（带缓存与并发去重，加载前返回占位图） */
export function getMathSrc(latex: string): string {
    const cached = SRC_CACHE.get(latex);
    if (cached) return cached;
    if (!PENDING.has(latex)) {
        PENDING.set(
            latex,
            fetchMath([latex])
                .then((arr) => {
                    SRC_CACHE.set(latex, arr[0]);
                    PENDING.delete(latex);
                    return arr[0];
                })
                .catch((e) => {
                    PENDING.delete(latex);
                    throw e;
                }),
        );
    }
    // 尚未渲染完成时返回透明占位图，加载后由上层响应式刷新
    return TRANSPARENT_GIF;
}

/** 等待某公式的渲染结果（返回失败的公式会抛出，由上层回退为原始文本显示） */
export async function ensureMathSrc(latex: string): Promise<string> {
    const cached = SRC_CACHE.get(latex);
    if (cached) return cached;
    if (!PENDING.has(latex)) {
        PENDING.set(
            latex,
            fetchMath([latex])
                .then((arr) => {
                    SRC_CACHE.set(latex, arr[0]);
                    PENDING.delete(latex);
                    return arr[0];
                })
                .catch((e) => {
                    PENDING.delete(latex);
                    throw e;
                }),
        );
    }
    return PENDING.get(latex)!;
}

async function fetchMath(list: string[]): Promise<string[]> {
    const res = await request<{ results: string[] }>("/api/render-latex", {
        method: "POST",
        data: { latex: list },
        timeout: 30000,
    });
    return res?.results ?? list.map(() => TRANSPARENT_GIF);
}