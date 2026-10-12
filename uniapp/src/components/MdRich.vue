<template>
    <view class="md-rich">
        <view
            v-for="(b, i) in blocks"
            :key="i"
            class="md-block"
            :class="`md-${b.type}`"
        >
            <rich-text v-if="b.hasMath" :nodes="b.html" />
            <text v-else>{{ b.text }}</text>
        </view>
    </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { parseMathSegments, getMathSrc, ensureMathSrc, escapeHtml, TRANSPARENT_GIF } from "@/utils/latex";

/**
 * 增强版 Markdown 渲染组件（小程序端）：
 * 在 MdView 的轻量分段（# 标题 / - 列表 / 普通段落）基础上，新增内联公式渲染。
 * 公式经后端 /api/render-latex 转成 SVG data URL，用 rich-text 按时或遥感展示；
 * 未加载完成时先占位，加载后自动刷新；渲染失败回退为原 LaTeX 文本。
 */

const props = defineProps<{ content: string }>();

// 每条公式的加载状态；加载完成/失败后自增 tick 触发 blocks 重算读取缓存
const mathState = ref<Record<string, "loading" | "done" | "fail">>({});
const mathTick = ref(0);

interface Block {
    type: "h" | "li" | "p";
    text: string;
    hasMath: boolean;
    html: string;
}

const blocks = computed<Block[]>(() => {
    void mathTick.value; // 建立响应式依赖
    const math = mathState.value;
    const lines = (props.content || "").split(/\r?\n/);
    const out: Block[] = [];

    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        let type: "h" | "li" | "p" = "p";
        let text = line;
        if (/^#{1,6}\s/.test(line)) {
            type = "h";
            text = line.replace(/^#{1,6}\s*/, "");
        } else if (/^[-*•]\s+/.test(line)) {
            type = "li";
            text = line.replace(/^[-*•]\s+/, "");
        }

        const segs = parseMathSegments(text);
        const hasMath = segs.some((s) => s.type === "math");
        let html = "";

        if (hasMath) {
            for (const s of segs) {
                if (s.type !== "math") continue;
                const key = s.s;
                // 触发异步加载（未在加载中才发起；失败置 fail 防止死循环重试）
                const st = math[key];
                if (!st) {
                    mathState.value = { ...math, [key]: "loading" };
                    ensureMathSrc(s.s)
                        .then((src) => {
                            if (src && src !== TRANSPARENT_GIF) {
                                mathState.value = { ...mathState.value, [key]: "done" };
                            } else {
                                mathState.value = { ...mathState.value, [key]: "fail" };
                            }
                            mathTick.value++;
                        })
                        .catch(() => {
                            mathState.value = { ...mathState.value, [key]: "fail" };
                            mathTick.value++;
                        });
                }
            }
            html = buildHtml(type, segs, mathState.value, getMathSrc);
        }

        out.push({ type, text, hasMath, html });
    }
    return out;
});

/** 拼接 rich-text HTML：文本片段转义，公式片段按时图；失败回退为纯文本 */
function buildHtml(
    type: "h" | "li" | "p",
    segs: ReturnType<typeof parseMathSegments>,
    state: Record<string, "loading" | "done" | "fail">,
    srcOf: (latex: string) => string,
): string {
    const baseSize = type === "h" ? 15 : 14;
    const bold = type === "h" ? "font-weight:600;" : "";
    const rootStyle = `style="font-size:${baseSize}px;color:#45526e;line-height:1.75;margin:0;${bold}"`;

    const parts: string[] = [];
    for (const s of segs) {
        if (s.type === "text") {
            parts.push(escapeHtml(s.s));
            continue;
        }
        const st = state[s.s];
        if (st === "fail") {
            // 渲染失败：回退显示原始 LaTeX，便于人工识别
            parts.push(escapeHtml(s.s));
        } else {
            const src = srcOf(s.s);
            parts.push(
                `<img src="${src}" style="height:${baseSize * 1.5}px;max-width:100%;display:inline-block;vertical-align:middle;" />`,
            );
        }
    }
    return `<p ${rootStyle}>${parts.join("")}</p>`;
}
</script>

<style scoped>
.md-rich {
    display: flex;
    flex-direction: column;
}
.md-block {
    font-size: 27rpx;
    color: var(--ink-600);
    line-height: 1.75;
    margin-bottom: 10rpx;
}
.md-h {
    font-size: 28rpx;
    font-weight: 700;
    color: var(--ink-900);
    margin: 20rpx 0 10rpx;
}
.md-h + .md-h {
    margin-top: 0;
}
.md-p {
    font-size: 27rpx;
    color: var(--ink-600);
}
.md-li {
    font-size: 27rpx;
    color: var(--ink-600);
    margin-bottom: 8rpx;
    padding-left: 26rpx;
    position: relative;
}
.md-li::before {
    content: "";
    position: absolute;
    left: 2rpx;
    top: 18rpx;
    width: 10rpx;
    height: 10rpx;
    border-radius: 50%;
    background: var(--brand-600);
}
</style>