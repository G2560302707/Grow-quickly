/**
 * 考公/行测默认模块与 AI 学科枚举
 * 错题本默认按行测五大模块创建；AI 仍可识别申论及原 K12 学科以兼容旧数据。
 */

export const GONGKAO_NOTEBOOKS = [
    "言语理解",
    "判断推理",
    "数量关系",
    "资料分析",
    "常识判断",
] as const;

export const AI_SUBJECT_OPTIONS = [
    "言语理解",
    "判断推理",
    "数量关系",
    "资料分析",
    "常识判断",
    "申论",
    "数学",
    "物理",
    "化学",
    "生物",
    "英语",
    "语文",
    "历史",
    "地理",
    "政治",
    "其他",
] as const;

export type AiSubject = (typeof AI_SUBJECT_OPTIONS)[number];

export const AI_SUBJECT_PROMPT_LIST = AI_SUBJECT_OPTIONS.map((s) => `"${s}"`).join(", ");

/** 错题本图标 key 白名单（与 uniapp static/notebook-icons 资源一一对应） */
export const NOTEBOOK_ICON_KEYS = [
    // 行测科目
    "changshi",
    "yanyu",
    "panduan",
    "shuliang",
    "ziliao",
    "shenlun",
    // 学科课程
    "math",
    "english",
    "chinese",
    "politics",
    "history",
    "geography",
    "physics",
    "chemistry",
    "biology",
    // 知识点
    "formula",
    "vocab",
    "reading",
    "logic",
    "chart",
    "mistake",
    "point",
    "note",
    // 学习场景
    "practice",
    "review",
    "weak",
    "mock",
    "star",
    "folder",
    "other",
] as const;

export type NotebookIconKey = (typeof NOTEBOOK_ICON_KEYS)[number];

/** 校验并归一 iconKey，非法值回退 other */
export function normalizeNotebookIconKey(v: unknown): NotebookIconKey {
    return (NOTEBOOK_ICON_KEYS as readonly string[]).includes(String(v))
        ? (String(v) as NotebookIconKey)
        : "other";
}
