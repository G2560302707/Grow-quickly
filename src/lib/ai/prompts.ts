/**
 * Shared AI prompt templates
 * This module provides centralized prompt management
 */
import { getMathTagsByGrade } from '../knowledge-tags';

/**
 * Options for customizing prompts
 */
export interface PromptOptions {
  providerHints?: string; // Provider-specific instructions
  additionalTags?: {
    subject: string;
    tags: string[];
  }[];
  customTemplate?: string; // Custom template to override default
}

export const DEFAULT_ANALYZE_TEMPLATE = `【角色与核心任务 (ROLE AND CORE TASK)】
你是一位世界顶尖的、经验丰富的、专业的跨学科考试分析专家（Interdisciplinary Exam Analysis Expert）。你的核心任务是极致准确地分析用户提供的考试题目图片，全面理解所有文本、图表和隐含约束，并提供一个完整、高度结构化且专业的解决方案。

{{language_instruction}}

【核心输出要求 (OUTPUT REQUIREMENTS)】
你的响应输出**必须严格遵循以下自定义标签格式**。**严禁**使用 JSON 或 Markdown 代码块。**严禁**对 LaTeX 公式中的反斜杠进行二次转义（如 "\\frac" 是错误的，必须是 "\frac"）。

请严格按照以下结构输出内容：

<question_text>
在此处填写题目的完整文本。使用 Markdown 格式。所有数学公式使用 LaTeX 符号（行内 $...$，块级 $$...$$）。
</question_text>

<answer_text>
在此处填写正确答案。使用 Markdown 和 LaTeX 符号。
</answer_text>

<analysis>
在此处填写详细的步骤解析。
* 必须使用简体中文。
* **直接使用标准的 LaTeX 符号**（如 $\frac{1}{2}$），**不要**进行 JSON 转义（不要写成 \\frac）。
</analysis>

<subject>
在此处填写学科，必须是以下之一："数学", "物理", "化学", "生物", "英语", "语文", "历史", "地理", "政治", "其他"。
</subject>

<knowledge_points>
在此处填写知识点，使用逗号分隔，例如：知识点1, 知识点2, 知识点3
</knowledge_points>

【知识点标签列表（KNOWLEDGE POINT LIST）】
{{knowledge_points_list}}

【标签使用规则 (TAG RULES)】
- 标签必须与题目实际考查的知识点精准匹配。
- 每题最多 5 个标签。

【!!! 关键格式与内容约束 (CRITICAL RULES) !!!】
1. **格式严格**：必须严格包含上述 5 个 XML 标签，除此之外不要输出任何其他“开场白”或“结束语”。
2. **纯文本**：内容作为纯文本处理，**不要转义反斜杠**。
3. **内容完整**：如果包含子问题，请在 question_text 中完整列出。
4. **禁止图片**：严禁包含任何图片链接或 markdown 图片语法。

{{provider_hints}}`;

export const DEFAULT_SIMILAR_TEMPLATE = `You are an expert AI tutor creating practice problems for middle school students.
Create a NEW practice problem based on the following original question and knowledge points.

DIFFICULTY LEVEL: {{difficulty_level}}
{{difficulty_instruction}}

{{language_instruction}}

Original Question: "{{original_question}}"
Knowledge Points: {{knowledge_points}}

【核心输出要求 (OUTPUT REQUIREMENTS)】
你的响应输出**必须严格遵循以下自定义标签格式**。**严禁**使用 JSON 或 Markdown 代码块。**严禁**返回 \`\`\`json ... \`\`\`。

请严格按照以下结构输出内容（不要包含任何其他文字）：

<question_text>
在此处填写新生成的题目文本。包含选项（如果是选择题）。
</question_text>

<answer_text>
在此处填写新题目的正确答案。
</answer_text>

<analysis>
在此处填写新题目的详细解析。
* 必须使用简体中文。
* **直接使用标准的 LaTeX 符号**（如 $\frac{1}{2}$），**不要**进行 JSON 转义。
</analysis>

<subject>
在此处填写学科（通常与原题一致）。
</subject>

<knowledge_points>
在此处填写归属的知识点，使用逗号分隔。
</knowledge_points>

【!!! 关键格式与内容约束 (CRITICAL RULES) !!!】
1. **格式严格**：必须严格包含上述 5 个 XML 标签。
2. **纯文本**：内容作为纯文本处理，**不要转义反斜杠**。

{{provider_hints}}`;

/**
 * Helper to replace placeholders in template
 */
function replaceVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || "";
  });
}

/**
 * 获取指定年级的累进数学标签
 * 初一(7)：只包含七年级标签
 * 初二(8)：包含七年级+八年级标签
 * 初三(9)：包含七年级+八年级+九年级标签
 * 高一(10)：只包含高一标签（不含初中）
 * 高二(11)：包含高一+高二标签
 * 高三(12)：包含高一+高二+高三标签
 * @param grade - 年级 (7-9:初中, 10-12:高中) 或 null
 * @returns 标签数组
 */
export function getMathTagsForGrade(grade: 7 | 8 | 9 | 10 | 11 | 12 | null): string[] {
  if (!grade) {
    // 如果没有年级信息，返回所有年级的标签
    return [
      ...getMathTagsByGrade(7),
      ...getMathTagsByGrade(8),
      ...getMathTagsByGrade(9),
      ...getMathTagsByGrade(10),
      ...getMathTagsByGrade(11),
      ...getMathTagsByGrade(12)
    ];
  }

  // 判断是初中还是高中
  if (grade >= 7 && grade <= 9) {
    // 初中累进式标签：当前年级及之前所有年级
    const tags: string[] = [];
    if (grade >= 7) tags.push(...getMathTagsByGrade(7));
    if (grade >= 8) tags.push(...getMathTagsByGrade(8));
    if (grade >= 9) tags.push(...getMathTagsByGrade(9));
    return tags;
  } else {
    // 高中累进式标签：从高一开始累进（不含初中内容）
    const tags: string[] = [];
    if (grade >= 10) tags.push(...getMathTagsByGrade(10));
    if (grade >= 11) tags.push(...getMathTagsByGrade(11));
    if (grade >= 12) tags.push(...getMathTagsByGrade(12));
    return tags;
  }
}

/**
 * Generates the analyze image prompt
 * @param language - Target language for analysis ('zh' or 'en')
 * @param grade - Optional grade level (7-9:初中, 10-12:高中) for cumulative tag filtering
 * @param options - Optional customizations
 */
export function generateAnalyzePrompt(
  language: 'zh' | 'en',
  grade?: 7 | 8 | 9 | 10 | 11 | 12 | null,
  subject?: string | null,
  options?: PromptOptions
): string {
  const langInstruction = language === 'zh'
    ? "IMPORTANT: For the 'analysis' field, use Simplified Chinese. For 'questionText' and 'answerText', YOU MUST USE THE SAME LANGUAGE AS THE ORIGINAL QUESTION. If the original question is in Chinese, the new question MUST be in Chinese. If the original is in English, keep it in English. If the original question is in English, the new 'questionText' and 'answerText' MUST be in English, but the 'analysis' MUST be in Simplified Chinese (to help the student understand). "
    : "Please ensure all text fields are in English.";

  // 获取数学标签（根据年级累进）
  const mathTags = getMathTagsForGrade(grade || null);
  const mathTagsString = mathTags.map(tag => `"${tag}"`).join(", ");

  // 根据科目决定显示哪些标签（节省 token，提高准确性）
  let tagsSection = "";

  if (subject === '数学') {
    tagsSection = `**数学标签 (Math Tags):**
使用人教版课程大纲中的**精确标签名称**，可选标签如下：
${mathTagsString}

**重要提示**：
- 必须从上述列表中选择精确匹配的标签
- 每题最多 5 个标签`;
  } else if (subject === '物理') {
    tagsSection = `**物理标签 (Physics Tags):**
"力学", "电学", "光学", "热学", "声学", "磁学", "欧姆定律", "浮力", "压强", "功和能", "杠杆原理", "滑轮", "电功率", "串并联电路", "电磁感应", "凸透镜成像", "光的反射", "光的折射", "机械运动", "牛顿定律"`;
  } else if (subject === '化学') {
    tagsSection = `**化学标签 (Chemistry Tags):**
"化学方程式", "氧化还原反应", "酸碱盐", "有机化学", "无机化学", "元素周期表", "化学键", "溶液", "溶解度", "酸碱中和", "金属活动性", "燃烧", "化学计算", "气体制备", "物质分类"`;
  } else if (subject === '英语') {
    tagsSection = `**英语标签 (English Tags):**
"语法", "词汇", "阅读理解", "完形填空", "写作", "听力", "翻译", "时态", "从句", "冠词", "介词", "动词短语", "固定搭配"`;
  } else {
    // 未知科目：显示所有标签让 AI 判断
    tagsSection = `**数学标签 (Math Tags):**
${mathTagsString}

**物理标签 (Physics Tags):**
"力学", "电学", "光学", "热学", "欧姆定律", "浮力", "压强", "功和能"

**化学标签 (Chemistry Tags):**
"化学方程式", "氧化还原反应", "酸碱盐", "有机化学", "无机化学"

**英语标签 (English Tags):**
"语法", "词汇", "阅读理解", "完形填空", "写作", "听力", "翻译"`;
  }

  const template = options?.customTemplate || DEFAULT_ANALYZE_TEMPLATE;

  return replaceVariables(template, {
    language_instruction: langInstruction,
    knowledge_points_list: tagsSection,
    provider_hints: options?.providerHints || ''
  }).trim();
}

/**
 * Generates the "similar question" prompt
 * @param language - Target language ('zh' or 'en')
 * @param originalQuestion - The original question text
 * @param knowledgePoints - Knowledge points to test
 * @param difficulty - Difficulty level
 * @param options - Optional customizations
 */
export function generateSimilarQuestionPrompt(
  language: 'zh' | 'en',
  originalQuestion: string,
  knowledgePoints: string[],
  difficulty: 'easy' | 'medium' | 'hard' | 'harder' = 'medium',
  options?: PromptOptions
): string {
  const langInstruction = language === 'zh'
    ? "IMPORTANT: Provide the output based on the 'Original Question' language. If the original question is in English, the new 'questionText' and 'answerText' MUST be in English, but the 'analysis' MUST be in Simplified Chinese (to help the student understand). If the original is in Chinese, everything MUST be in Simplified Chinese."
    : "Please ensure the generated question is in English.";

  const difficultyInstruction = {
    'easy': "Make the new question EASIER than the original. Use simpler numbers and more direct concepts.",
    'medium': "Keep the difficulty SIMILAR to the original question.",
    'hard': "Make the new question HARDER than the original. Combine multiple concepts or use more complex numbers.",
    'harder': "Make the new question MUCH HARDER (Challenge Level). Require deeper understanding and multi-step reasoning."
  }[difficulty];

  const template = options?.customTemplate || DEFAULT_SIMILAR_TEMPLATE;

  return replaceVariables(template, {
    difficulty_level: difficulty.toUpperCase(),
    difficulty_instruction: difficultyInstruction,
    language_instruction: langInstruction,
    original_question: originalQuestion.replace(/"/g, '\\"').replace(/\n/g, '\\n'), // Escape for template safety
    knowledge_points: knowledgePoints.join(", "),
    provider_hints: options?.providerHints || ''
  }).trim();
}
