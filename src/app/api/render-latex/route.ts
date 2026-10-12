import { NextResponse } from "next/server";
import { createLogger } from "@grow/shared/logger";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const logger = createLogger("api:render-latex");

/**
 * POST /api/render-latex   body: { latex: string, display?: boolean }
 *   -> { svg: string, dataUrl: string }   将 LaTeX 渲染为自包含 SVG 图片。
 *
 * 用途：小程序端无法运行 KaTeX/MathJax，把 AI 识别出的 $...$ 公式经此接口
 * 转成 SVG，前端用 <image>/rich-text 按时图展示。Web 端继续走 KaTeX 不动。
 *
 * 安全与性能：
 *  - 纯计算接口，不读写用户数据，故免会话鉴权；靠 IP 令牌桶限流防滥用。
 *  - MathJax 初始化较重，用进程级单例 + Promise 缓存，仅首次请求冷启动一次。
 *  - 服务端 LRU 缓存渲染结果，篇幅相近/重复公式不重复计算。
 */

const MAX_LATEX_LEN = 4000; // 单条公式长度上限（防御超长输入）
const CACHE_LIMIT = 4000; // LRU 缓存条目上限

// 区别对待 display 与 inline（字号、整体间距不同），缓存 key 区分
const cache = new Map<string, { dataUrl: string; svg: string }>();

/** LaTeX -> LaTeX'（在此预留清洗/归一化钩子；AI 返回已是不转义标准格式） */
function normalizeLatex(raw: string): string {
    // 去掉可能误带的包裹引号
    let s = raw.trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1).trim();
    }
    return s;
}

type SvgRenderer = (latex: string, display: boolean) => string;

// 进程级单例：首次调用才真正初始化 MathJax（串行 import 避免打包器代码拆分问题）
let rendererPromise: Promise<SvgRenderer> | null = null;
function getRenderer(): Promise<SvgRenderer> {
    if (rendererPromise) return rendererPromise;
    rendererPromise = (async () => {
        const [{ mathjax }, { TeX }, { AllPackages }, { SVG }, { liteAdaptor }, { RegisterHTMLHandler }] =
            await Promise.all([
                import("mathjax-full/js/mathjax.js"),
                import("mathjax-full/js/input/tex.js"),
                import("mathjax-full/js/input/tex/AllPackages.js"),
                import("mathjax-full/js/output/svg.js"),
                import("mathjax-full/js/adaptors/liteAdaptor.js"),
                import("mathjax-full/js/handlers/html.js"),
            ]);

        const adaptor = liteAdaptor();
        RegisterHTMLHandler(adaptor);
        const tex = new TeX({ packages: AllPackages });
        const svg = new SVG({ fontCache: "none" });
        const doc = mathjax.document("", { InputJax: tex, OutputJax: svg });

        logger.info("MathJax SVG renderer initialized");
        return (latex: string, display: boolean) => {
            try {
                const node = doc.convert(latex, { display });
                return adaptor.innerHTML(node);
            } catch (e: any) {
                throw new Error(`LaTeX render error: ${e?.message || String(e)}`);
            }
        };
    })().catch((e) => {
        // 初始化失败后允许下次重试
        rendererPromise = null;
        logger.error({ error: e }, "MathJax renderer init failed");
        throw e;
    });
    return rendererPromise;
}

function toDataUrl(svg: string): string {
    return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function evictIfNeeded() {
    if (cache.size < CACHE_LIMIT) return;
    // 淘汰最早插入的一半（Map 按插入序迭代）
    const toDelete = Array.from(cache.keys()).slice(0, Math.ceil(CACHE_LIMIT / 2));
    for (const k of toDelete) cache.delete(k);
}

async function render(latex: string, display: boolean): Promise<{ svg: string; dataUrl: string }> {
    const key = `${display ? "d" : "i"}:${latex}`;
    const hit = cache.get(key);
    if (hit) return hit;

    const renderer = await getRenderer();
    const svg = renderer(latex, display);
    const dataUrl = toDataUrl(svg);
    evictIfNeeded();
    cache.set(key, { svg, dataUrl });
    return { svg, dataUrl };
}

function validate(raw: unknown): string | null {
    if (typeof raw !== "string" || raw.trim().length === 0) {
        return "latex body 字段缺失";
    }
    const latex = normalizeLatex(raw);
    if (latex.length > MAX_LATEX_LEN) {
        return `LaTeX 内容过长（>${MAX_LATEX_LEN} 字符）`;
    }
    return latex;
}

export async function POST(req: Request) {
    const limiter = rateLimit(`render-latex:${clientIp(req)}`, { limit: 120, windowMs: 60 * 1000 });
    if (!limiter.allowed) return tooManyRequests(limiter.retryAfterSeconds);

    const body = await req.json().catch(() => ({}));
    // display 默认按内联处理；批处理时 body.latex 可为数组
    if (Array.isArray(body?.latex)) {
        const latexList = (body.latex as unknown[]).map((raw) => normalizeLatex(String(raw))).filter((s) => typeof s === "string" && s.length > 0 && s.length <= MAX_LATEX_LEN);
        if (latexList.length === 0) return NextResponse.json({ error: "latex 数组为空" }, { status: 400 });
        const displayOnly = body?.display === true;
        const results = await Promise.all(latexList.map((l) => render(l, displayOnly)));
        return NextResponse.json({ results: results.map((r) => r.dataUrl) });
    }

    const latex = validate(body?.latex);
    if (typeof latex !== "string") {
        return NextResponse.json({ error: latex || "参数错误" }, { status: 400 });
    }
    const display = body?.display === true;
    try {
        const { svg, dataUrl } = await render(latex, display);
        return NextResponse.json({ svg, dataUrl });
    } catch (e: any) {
        logger.warn({ latex: latex.slice(0, 80), error: e?.message }, "LaTeX render failed");
        return NextResponse.json({ error: e?.message || "公式渲染失败" }, { status: 422 });
    }
}

/** 也支持 GET /api/render-latex?latex=...（便于测试/直连 <image>） */
export async function GET(req: Request) {
    const limiter = rateLimit(`render-latex:${clientIp(req)}`, { limit: 120, windowMs: 60 * 1000 });
    if (!limiter.allowed) return tooManyRequests(limiter.retryAfterSeconds);

    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("latex");
    const latex = validate(raw ?? "");
    if (typeof latex !== "string") {
        return NextResponse.json({ error: latex || "缺少 latex 参数" }, { status: 400 });
    }
    const display = searchParams.get("display") === "1" || searchParams.get("display") === "true";
    try {
        const { svg, dataUrl } = await render(latex, display);
        // 直连 <image> 时返回 image/svg+xml；否则返回 JSON dataUrl
        const format = searchParams.get("format");
        if (format === "svg") {
            return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
        }
        return NextResponse.json({ svg, dataUrl });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || "公式渲染失败" }, { status: 422 });
    }
}