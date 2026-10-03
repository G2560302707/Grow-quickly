/**
 * 选择题选项解析
 *
 * AI 出题的行测客观题选项混在题干文本里（逐行 "A. xxx" 或同行 "A. xxx B. xxx ..."），
 * 这里把它们解析成结构化选项，供练习页渲染成可点击按钮。
 * 解析失败（非选择题/格式不认识）时返回 null，练习页回退到自由文本作答。
 */

export interface ChoiceOption {
    label: string; // 统一为大写 A-D
    text: string;
}

export interface ParsedChoice {
    stem: string; // 去掉选项行后的题干
    options: ChoiceOption[];
}

// 选项行："A. xxx" / "B、xxx" / "Ｃ．xxx"（全宽字母也兼容）
const OPTION_LINE_RE = /^\s*([A-DＡ-Ｄ])\s*[\.、．:：,，]\s*(.+)$/;
// 同一行多个选项的分隔点：" A. xxx B. xxx"，字母前须有空格或行首，避免误切正文
const INLINE_OPTION_RE = /(?:^|\s)([A-DＡ-Ｄ])\s*[\.、．:：]\s*/g;

function normalizeLabel(raw: string): string {
    return raw.normalize("NFKC").toUpperCase();
}

/** 拆分一行内的多个选项（字母须连续 A→B→C→… 才认定是选项行，防误切） */
function splitInlineOptions(line: string): ChoiceOption[] | null {
    INLINE_OPTION_RE.lastIndex = 0;
    const marks: { label: string; start: number; end: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = INLINE_OPTION_RE.exec(line)) !== null) {
        const leading = m[1];
        const at = m.index + (m[0].startsWith(" ") ? 1 : 0);
        marks.push({ label: normalizeLabel(leading), start: at, end: m.index + m[0].length });
    }
    if (marks.length < 3) return null;
    for (let i = 0; i < marks.length; i++) {
        if (marks[i].label !== String.fromCharCode(65 + i)) return null;
    }
    return marks.map((mark, i) => ({
        label: mark.label,
        text: line.slice(mark.end, i + 1 < marks.length ? marks[i + 1].start : undefined).trim(),
    }));
}

export function parseChoiceOptions(questionText?: string): ParsedChoice | null {
    if (!questionText) return null;
    const lines = questionText.split("\n");
    const options: ChoiceOption[] = [];
    const stemLines: string[] = [];

    for (const line of lines) {
        // 同一行多个选项优先（"A. 甲 B. 乙 C. 丙 D. 丁" 也满足逐行正则，须先拆分）
        if (options.length === 0) {
            const inline = splitInlineOptions(line);
            if (inline) {
                options.push(...inline);
                continue;
            }
        }
        const lineMatch = line.match(OPTION_LINE_RE);
        if (lineMatch && options.length < 8) {
            options.push({ label: normalizeLabel(lineMatch[1]), text: lineMatch[2].trim() });
            continue;
        }
        stemLines.push(line);
    }

    // 至少 2 个选项且字母从 A 连续编号，才认定为选择题
    if (options.length < 2) return null;
    for (let i = 0; i < options.length; i++) {
        if (options[i].label !== String.fromCharCode(65 + i)) return null;
    }
    const stem = stemLines.join("\n").trim();
    if (!stem) return null;
    return { stem, options };
}

/**
 * 从参考答案里提取正确选项字母（如 "B" / "B、长城" / "正确答案：C"）。
 * 提取不出（主观题式答案）返回 null，由调用方回退到自评。
 */
export function parseCorrectOption(answerText?: string): string | null {
    if (!answerText) return null;
    const text = answerText.trim();
    const leading = text.match(/^([A-DＡ-Ｄ])(?![A-Za-z0-9])/);
    if (leading) return normalizeLabel(leading[1]);
    const declared = text.match(/(?:正确答案|答案)[是为：:\s]*([A-DＡ-Ｄ])(?![A-Za-z0-9])/);
    if (declared) return normalizeLabel(declared[1]);
    return null;
}
