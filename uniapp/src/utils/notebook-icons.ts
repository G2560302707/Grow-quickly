/**
 * 错题本图标目录：iconKey -> 展示信息（与 shared NOTEBOOK_ICON_KEYS、
 * static/notebook-icons/<key>.png 一一对应）。分组与截图版一致。
 */

export interface NotebookIconDef {
    key: string;
    label: string;
}

export interface NotebookIconGroup {
    title: string;
    icons: NotebookIconDef[];
}

export const NOTEBOOK_ICON_GROUPS: NotebookIconGroup[] = [
    {
        title: "行测科目",
        icons: [
            { key: "changshi", label: "常识" },
            { key: "yanyu", label: "言语" },
            { key: "panduan", label: "判断" },
            { key: "shuliang", label: "数量" },
            { key: "ziliao", label: "资料" },
            { key: "shenlun", label: "申论" },
        ],
    },
    {
        title: "学科课程",
        icons: [
            { key: "math", label: "数学" },
            { key: "english", label: "英语" },
            { key: "chinese", label: "语文" },
            { key: "politics", label: "政治" },
            { key: "history", label: "历史" },
            { key: "geography", label: "地理" },
            { key: "physics", label: "物理" },
            { key: "chemistry", label: "化学" },
            { key: "biology", label: "生物" },
        ],
    },
    {
        title: "知识点",
        icons: [
            { key: "formula", label: "公式" },
            { key: "vocab", label: "词汇" },
            { key: "reading", label: "阅读" },
            { key: "logic", label: "逻辑" },
            { key: "chart", label: "图表" },
            { key: "mistake", label: "错因" },
            { key: "point", label: "考点" },
            { key: "note", label: "笔记" },
        ],
    },
    {
        title: "学习场景",
        icons: [
            { key: "practice", label: "练习" },
            { key: "review", label: "复习" },
            { key: "weak", label: "薄弱" },
            { key: "mock", label: "模考" },
            { key: "star", label: "收藏" },
            { key: "folder", label: "分类" },
            { key: "other", label: "其他" },
        ],
    },
];

export const NOTEBOOK_ICON_KEYS = NOTEBOOK_ICON_GROUPS.flatMap((g) => g.icons.map((i) => i.key));

export function notebookIconSrc(key?: string): string {
    const k = key && NOTEBOOK_ICON_KEYS.includes(key) ? key : "other";
    return `/static/notebook-icons/${k}.png`;
}

export function notebookIconLabel(key?: string): string {
    const k = key && NOTEBOOK_ICON_KEYS.includes(key) ? key : "other";
    return NOTEBOOK_ICON_GROUPS.flatMap((g) => g.icons).find((i) => i.key === k)?.label ?? "其他";
}
