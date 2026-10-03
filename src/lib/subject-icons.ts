/**
 * 行测五大模块图标映射（设计稿：public/design-preview/subject-icons.html）
 * 图标资源在 public/icons/subjects/，主色与统计图表用色一致（见 ERROR_ORIGIN / subjects 体系）。
 */
export const GONGKAO_SUBJECT_ICONS: Record<string, string> = {
    "言语理解": "/icons/subjects/yanyu.svg",
    "判断推理": "/icons/subjects/panduan.svg",
    "数量关系": "/icons/subjects/shuliang.svg",
    "资料分析": "/icons/subjects/ziliao.svg",
    "常识判断": "/icons/subjects/changshi.svg",
};

/** 图标主色（同统计图表用色） */
export const GONGKAO_SUBJECT_COLORS: Record<string, string> = {
    "言语理解": "#5568E8",
    "判断推理": "#8B5CF6",
    "数量关系": "#0E9F8A",
    "资料分析": "#18A058",
    "常识判断": "#E8993C",
};

/** 图标淡底色（主色 12% 叠白） */
export const GONGKAO_SUBJECT_TINTS: Record<string, string> = {
    "言语理解": "#E9ECFC",
    "判断推理": "#F1EBFE",
    "数量关系": "#E2F5F2",
    "资料分析": "#E4F6EC",
    "常识判断": "#FCF1E2",
};

function matchKey(name?: string | null, table?: Record<string, string>): string | null {
    if (!name) return null;
    for (const key of Object.keys(table!)) {
        if (name.includes(key)) return table![key];
    }
    return null;
}

/** 模块图标路径；非五大模块（申论/自定义本等）返回 null，由调用方回退默认图标 */
export function subjectIcon(name?: string | null): string | null {
    return matchKey(name, GONGKAO_SUBJECT_ICONS);
}

export function subjectColor(name?: string | null): string | null {
    return matchKey(name, GONGKAO_SUBJECT_COLORS);
}

export function subjectTint(name?: string | null): string | null {
    return matchKey(name, GONGKAO_SUBJECT_TINTS);
}
