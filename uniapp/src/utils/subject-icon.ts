/**
 * 行测五大模块图标映射（与网页端 public/icons/subjects/ 设计同源）
 * uniapp <image> 引用 static 下资源；非五大模块返回空串，调用方回退首字样式。
 */
export const SUBJECT_ICONS: Record<string, string> = {
    "言语理解": "/static/subjects/yanyu.svg",
    "判断推理": "/static/subjects/panduan.svg",
    "数量关系": "/static/subjects/shuliang.svg",
    "资料分析": "/static/subjects/ziliao.svg",
    "常识判断": "/static/subjects/changshi.svg",
};

/** 图标淡底色（主色 12% 叠白），作为芯片背景 */
export const SUBJECT_TINTS: Record<string, string> = {
    "言语理解": "#E9ECFC",
    "判断推理": "#F1EBFE",
    "数量关系": "#E2F5F2",
    "资料分析": "#E4F6EC",
    "常识判断": "#FCF1E2",
};

export function subjectIcon(name?: string | null): string {
    if (!name) return "";
    for (const key of Object.keys(SUBJECT_ICONS)) {
        if (name.includes(key)) return SUBJECT_ICONS[key];
    }
    return "";
}

export function subjectTint(name?: string | null): string {
    if (!name) return "";
    for (const key of Object.keys(SUBJECT_TINTS)) {
        if (name.includes(key)) return SUBJECT_TINTS[key];
    }
    return "";
}
