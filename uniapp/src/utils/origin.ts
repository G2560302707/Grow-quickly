/** 错题来源渠道标注（与后端 ErrorItem.origin 对应） */
export const ERROR_ORIGIN_LABELS: Record<string, string> = {
    similar: "举一反三",
    smart: "薄弱点专项",
    practice: "练习",
};

export function originLabel(origin?: string | null): string {
    if (!origin) return "";
    return ERROR_ORIGIN_LABELS[origin] || origin;
}
