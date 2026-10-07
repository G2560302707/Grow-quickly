/**
 * Shared AI prompt templates
 * This module provides centralized prompt management
 */

import { AI_SUBJECT_PROMPT_LIST } from "../subjects";

/**
 * 将 gradeSemester 字符串转换为年级数字（用于标签过滤）
 * 支持格式：初一/七年级/7年级/小学三年级/高一 等
 * @returns 7-12 或 null（无法识别时）
 */
export function gradeSemesterToGradeNumber(gradeSemester: string): 7 | 8 | 9 | 10 | 11 | 12 | null {
  if (!gradeSemester) return null;
  const gs = gradeSemester.toLowerCase();

  // 小学：primary_3 → 不映射到 7-12，返回 null
  if (gs.startsWith('primary') || gs.includes('小学') || gs.match(/[一二三四五六]年级/)) {
    return null;
  }

  // 初中
  if (gs.includes('初一') || gs.includes('七年级') || gs.includes('7年级') || gs === 'junior_high_1') return 7;
  if (gs.includes('初二') || gs.includes('八年级') || gs.includes('8年级') || gs === 'junior_high_2') return 8;
  if (gs.includes('初三') || gs.includes('九年级') || gs.includes('9年级') || gs === 'junior_high_3') return 9;

  // 高中
  if (gs.includes('高一') || gs.includes('10年级') || gs === 'senior_high_1') return 10;
  if (gs.includes('高二') || gs.includes('11年级') || gs === 'senior_high_2') return 11;
  if (gs.includes('高三') || gs.includes('12年级') || gs === 'senior_high_3') return 12;

  return null;
}

/**
 * 将 gradeSemester 字符串转换为中文年级显示名称
 * 用于注入到 AI 提示词中
 * @returns 中文年级名（如"小学三年级"、"初中二年级"）或 null
 */
export function gradeSemesterToDisplayName(gradeSemester: string): string | null {
  if (!gradeSemester) return null;
  const gs = gradeSemester;

  // 小学
  const primaryMatch = gs.match(/primary[_\s]?(\d)/);
  if (primaryMatch) {
    const numMap: Record<string, string> = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六' };
    return `小学${numMap[primaryMatch[1]] || primaryMatch[1]}年级`;
  }
  if (gs.includes('小学')) {
    // "小学三年级" 格式，直接返回年级部分
    const m = gs.match(/小学([一-龥\d]+年级?)/);
    if (m) return `小学${m[1].replace('年级', '')}年级`.replace('小学小学', '小学');
    return gs.replace(/[上下]$/, '').replace(/[，,].*$/, '').trim();
  }
  if (gs.match(/[一二三四五六]年级/) && !gs.includes('初') && !gs.includes('高')) {
    return `小学${gs.replace(/[上下]$/, '').replace(/[，,].*$/, '').trim()}`;
  }

  // 初中
  const juniorMatch = gs.match(/junior_high[_\s]?(\d)/);
  if (juniorMatch) {
    const numMap: Record<string, string> = { '1': '一', '2': '二', '3': '三' };
    return `初中${numMap[juniorMatch[1]] || juniorMatch[1]}年级`;
  }
  if (gs.includes('初一')) return '初中一年级';
  if (gs.includes('初二')) return '初中二年级';
  if (gs.includes('初三')) return '初中三年级';
  if (gs.includes('七年级')) return '初中一年级';
  if (gs.includes('八年级')) return '初中二年级';
  if (gs.includes('九年级')) return '初中三年级';

  // 高中
  const seniorMatch = gs.match(/senior_high[_\s]?(\d)/);
  if (seniorMatch) {
    const numMap: Record<string, string> = { '1': '一', '2': '二', '3': '三' };
    return `高中${numMap[seniorMatch[1]] || seniorMatch[1]}年级`;
  }
  if (gs.includes('高一')) return '高中一年级';
  if (gs.includes('高二')) return '高中二年级';
  if (gs.includes('高三')) return '高中三年级';

  return null;
}

/**
 * 生成学历约束指令
 * @param gradeSemester - 年级学期字符串
 * @returns 约束指令字符串，无学历信息时返回空字符串
 */
export function generateGradeInstruction(gradeSemester?: string | null): string {
  if (!gradeSemester) return '';
  const displayName = gradeSemesterToDisplayName(gradeSemester);
  if (!displayName) return '';

  // 考公场景下不强制 K12 学历约束；仅当明确是小学/初中/高中年级时才注入
  if (!displayName.includes('小学') && !displayName.includes('初中') && !displayName.includes('高中')) {
    return '';
  }

  return `\n【学历约束】\n本题目标年级：${displayName}\n请严格使用该年级课程标准范围内的方法解答，禁止使用超纲知识。\n`;
}

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
  // Pre-fetched tags from database (optional, per subject)
  prefetchedMathTags?: string[];
  prefetchedPhysicsTags?: string[];
  prefetchedChemistryTags?: string[];
  prefetchedBiologyTags?: string[];
  prefetchedEnglishTags?: string[];
  // 批量出题时注入的防重复旧题（仅批量模板使用）
  recentQuestions?: string[];
}

export const DEFAULT_ANALYZE_TEMPLATE = `【角色与核心任务 (ROLE AND CORE TASK)】
你是一位资深的**公务员考试（国考/省考/事业编）行测与申论**辅导专家。你的核心任务是准确识别用户上传的错题图片或截图，完整还原题干与选项，并给出可跟做的解题过程与错因分析。

{{language_instruction}}

【核心输出要求 (OUTPUT REQUIREMENTS)】
你的响应输出**必须严格遵循以下自定义标签格式**。**严禁**使用 JSON 或 Markdown 代码块。**严禁**对 LaTeX 公式中的反斜杠进行二次转义（如 "\\frac" 是错误的，必须是 "\frac"）。

请严格按照以下结构输出内容：

<subject>
在此处填写科目/模块，必须是以下之一：{{ai_subject_list}}。
优先使用行测模块："言语理解", "判断推理", "数量关系", "资料分析", "常识判断"；申论题用"申论"；无法归类时用"其他"。
</subject>

<knowledge_points>
在此处填写考点标签，使用逗号分隔，例如：逻辑填空, 转折关系, 语境分析。每题最多 5 个。
</knowledge_points>

<requires_image>
判断这道题是否必须看图/表才能作答。资料分析图表、图形推理、定义判断附图等填 true；纯文字题填 false。
</requires_image>

<wrong_answer_text>
如果图片中包含考生已选错误选项、错误草稿或错误计算，请尽量按原样摘录；没有则留空。
</wrong_answer_text>

<mistake_status>
填写以下值之一：wrong_attempt（有错误作答）、not_attempted（未作答或空白）、unknown（无法判断）。
</mistake_status>

<mistake_analysis>
如果有错误作答：分析错因（审题偏差/概念混淆/计算失误/排除不全/常识过时等）；没有则留空。
</mistake_analysis>

<question_text>
在此处填写题目的完整文本（含全部选项）。使用 Markdown 格式。数量关系与资料分析中的公式使用 LaTeX（行内 $...$，块级 $$...$$）。

【表格处理规则】
资料分析等题目中的表格必须完整转录：
1. 使用 Markdown 表格语法，保留标题、单位、注释与全部单元格（空单元格用 -）。
2. 复杂表头用文字说明结构后再给简化表格。
3. 图表混合时用文字说明位置关系；模糊处用 [?] 或注明"（表格内容可能不完整）"。
</question_text>

<answer_text>
在此处填写正确答案。客观题写清选项字母（如 B）及对应内容；计算题给出最终数值与单位。
常识/时政若无法百分百确认，在答案后注明「需人工核对」。
</answer_text>

<analysis>
在此处填写详细解析，必须使用简体中文，并**严格按以下四段结构**书写（用小标题）：

### 1. 考点
本题考查的模块与具体考点。

### 2. 选项排除
对每个选项说明对/错及排除理由（资料分析可写关键数据来源）。

### 3. 步骤
给出可跟做的解题步骤；数量/资料可含估算技巧与验算。

### 4. 易错点
考生常见陷阱与防错提醒。

* 公式直接使用标准 LaTeX（如 $\frac{1}{2}$），不要 JSON 转义。
* 需要表格时遵循上述表格规则。
</analysis>

【知识点标签列表（KNOWLEDGE POINT LIST）】
{{knowledge_points_list}}

【标签使用规则 (TAG RULES)】
- 标签必须与行测/申论实际考点匹配（如：削弱加强、增长率、比重、主旨概括、图形推理等）。
- 每题最多 5 个标签。

【!!! 关键格式与内容约束 (CRITICAL RULES) !!!】
1. **格式严格**：必须严格包含上述 9 个 XML 标签，除此之外不要输出任何其他“开场白”或“结束语”。
2. **纯文本**：内容作为纯文本处理，**不要转义反斜杠**。
3. **内容完整**：题干、材料、全部选项必须完整列出。
4. **禁止图片**：严禁包含任何图片链接或 markdown 图片语法。

{{grade_instruction}}
{{provider_hints}}`;

/**
 * 整页题目定位提示词：只检测题号与包围盒，不做解答、不转录内容。
 * 供 /api/analyze/detect 使用，前端按百分比 bbox 框选后走现有单题识别链路。
 */
export const DEFAULT_DETECT_TEMPLATE = `【角色与核心任务 (ROLE AND CORE TASK)】
你是一张试卷/练习册照片的版面分析助手。你的任务是找出图中每道题目的位置：只做定位，不做解答，也不转录题目内容。

【任务要求 (REQUIREMENTS)】
1. 找出图中所有以题号开头的题目（如 "1." "2、" "12．" "一、5" 等），每道题输出一个包围盒。
2. 包围盒应覆盖该题从题号所在行开始，到下一题题号之前（或本题选项/材料结束）的全部内容。
3. bbox 使用百分比坐标：x1/y1 为左上角，x2/y2 为右下角，取值范围 0-100，相对于整张图片的宽度与高度；x2 必须大于 x1，y2 必须大于 y1。
4. 双栏排版时按栏划分：左栏题目的 x2 不应超过约 50，右栏题目的 x1 不应小于约 50。
5. 只输出图中真实可见的题号，禁止猜测或编造；看不清的题宁可跳过。
6. 按题号从小到大排序。

【输出格式 (OUTPUT FORMAT)】
你的响应必须**只有以下 JSON 数组**，不要包含 markdown 代码块标记，也不要任何其他文字：
[{"number": 1, "label": "1", "bbox": {"x1": 5, "y1": 8, "x2": 95, "y2": 22}}, {"number": 2, "label": "2", "bbox": {"x1": 5, "y1": 22, "x2": 95, "y2": 41}}]

number 为题号数字；若题号非纯数字（如 "二、5"），number 填其中的数字，label 保留原文题号。
如果图中没有可识别的题号（单题截图、无题号排版等），输出空数组 []`;

/**
 * 举一反三批量出题提示词：一次 AI 调用生成 N 道同考点变式题（JSON 数组输出）。
 * 会话式练习用，替代逐题串行调用，速度与稳定性都更好。
 */
export const DEFAULT_SIMILAR_BATCH_TEMPLATE = `【角色与核心任务 (ROLE AND CORE TASK)】
你是一位资深的**公务员考试（行测/申论）出题专家**。请根据给定的考点与原错题素材，一次性生成 {{question_count}} 道**同模块、同考点**的高质量变式训练题。

【出题要求】
1. 同模块同考点：模块与核心考点必须与素材中的原错题一致。
2. 难度档位：{{difficulty}}
3. {{question_count}} 道题之间题材、数字、选项结构必须各不相同，严禁互相重复，也严禁与素材里的旧题重复。
4. 客观题必须有唯一正确选项；解析结构按「考点 → 选项排除 → 步骤 → 易错点」四段书写。
5. 常识/时政避免依赖过新时政，必要时在答案注明「需人工核对」。

【输出格式 (OUTPUT FORMAT)】
你的响应必须**只有 JSON 数组**，不要 markdown 代码块标记，不要任何其他文字，恰好 {{question_count}} 个元素：
[{"question_text":"题干，含全部选项，Markdown 格式，公式用 LaTeX，不要转义反斜杠","answer_text":"正确答案，客观题含选项字母","analysis":"详细解析，含考点/选项排除/步骤/易错点","knowledge_points":["考点1","考点2"]}]

【考点与原错题素材】
原题: "{{original_question}}"
{{language_instruction}}
DIFFICULTY LEVEL: {{difficulty_level}}
Knowledge Points: {{knowledge_points}}

【严禁与之重复的旧题】
{{recent_questions}}

{{grade_instruction}}
{{provider_hints}}`;

export const DEFAULT_SIMILAR_TEMPLATE = `你是一位资深的**公务员考试行测**出题专家。你的核心任务是根据原错题**举一反三**，生成一道同模块、同考点的高质量变式训练题，用于检验迁移掌握情况。

### 变式要求
1. **同模块同考点**：模块与核心考点必须与原题一致（如原题是削弱加强，变式仍是削弱加强）。
2. **按难度调整**：
   - easy：同考点、更直白，干扰项更弱
   - medium：同考点标准国考/省考难度
   - hard / harder：同考点，干扰更强或多一步推理/估算
3. **风格**：语言与选项风格贴近真实行测；客观题必须有唯一正确选项。
4. **解析结构**：解析仍用「考点 → 选项排除 → 步骤 → 易错点」四段。
5. **常识/时政**：避免依赖过新时政；必要时在答案注明「需人工核对」。

### 执行流程
1. **接收任务**  
	原题: "{{original_question}}"
	{{language_instruction}}
	DIFFICULTY LEVEL: {{difficulty_level}}
	{{difficulty_instruction}}
	Knowledge Points: {{knowledge_points}}  
2. **解构分析**  
   - 提取模块、考点与干扰设计  
   - 设计同考点不同材料/数据/图形的新题  
3. **质量管控**  
   - 覆盖相同核心考点  
   - 答案唯一且可验证  
   - 无知识性错误  

### 输出规范
你的响应输出**必须严格遵循以下自定义标签格式**。**严禁**使用 JSON 或 Markdown 代码块。**严禁**返回 \`\`\`json ... \`\`\`。

请严格按照以下结构输出内容（不要包含任何其他文字）：

<question_text>
在此处填写新生成的题目文本。包含全部选项（如果是选择题）。
</question_text>

<answer_text>
在此处填写新题目的正确答案（客观题含选项字母）。
</answer_text>

<analysis>
在此处填写新题目的详细解析，使用简体中文，并包含：考点、选项排除、步骤、易错点。
* **直接使用标准的 LaTeX 符号**（如 $\frac{1}{2}$），**不要**进行 JSON 转义。
</analysis>

###关键格式与内容约束 (CRITICAL RULES) !!!
1. **纯文本**：内容作为纯文本处理，**不要转义反斜杠**。

{{grade_instruction}}
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
/**
 * 获取指定年级的数学标签
 * 必须由调用方预先从数据库获取标签并通过 prefetchedTags 传入
 * @param grade - 年级（已弃用，保留接口兼容）
 * @param prefetchedTags - 从数据库预获取的标签数组
 * @returns 标签数组
 */
export function getMathTagsForGrade(
  grade: 7 | 8 | 9 | 10 | 11 | 12 | null,
  prefetchedTags?: string[]
): string[] {
  // 必须使用预获取的数据库标签
  if (prefetchedTags && prefetchedTags.length > 0) {
    return prefetchedTags;
  }

  // 如果没有预获取标签，返回空数组（AI 将自由标注）
  console.warn('[prompts] No prefetched tags provided, AI will tag freely');
  return [];
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
  options?: PromptOptions,
  gradeSemester?: string | null
): string {
  const langInstruction = language === 'zh'
    ? "IMPORTANT: For the 'analysis' field, use Simplified Chinese. For 'questionText' and 'answerText', YOU MUST USE THE SAME LANGUAGE AS THE ORIGINAL QUESTION. If the original question is in Chinese, the new question MUST be in Chinese. If the original is in English, keep it in English. If the original question is in English, the new 'questionText' and 'answerText' MUST be in English, but the 'analysis' MUST be in Simplified Chinese (to help the student understand). "
    : "Please ensure all text fields are in English.";

  // 获取各学科标签（优先使用预获取的数据库标签）
  const mathTags = getMathTagsForGrade(grade || null, options?.prefetchedMathTags);
  const mathTagsString = mathTags.length > 0 ? mathTags.map(tag => `"${tag}"`).join(", ") : '（无可用标签）';

  const physicsTags = options?.prefetchedPhysicsTags || [];
  const physicsTagsString = physicsTags.length > 0 ? physicsTags.map(tag => `"${tag}"`).join(", ") : '（无可用标签）';

  const chemistryTags = options?.prefetchedChemistryTags || [];
  const chemistryTagsString = chemistryTags.length > 0 ? chemistryTags.map(tag => `"${tag}"`).join(", ") : '（无可用标签）';

  const biologyTags = options?.prefetchedBiologyTags || [];
  const biologyTagsString = biologyTags.length > 0 ? biologyTags.map(tag => `"${tag}"`).join(", ") : '（无可用标签）';

  const englishTags = options?.prefetchedEnglishTags || [];
  const englishTagsString = englishTags.length > 0 ? englishTags.map(tag => `"${tag}"`).join(", ") : '（无可用标签）';

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
使用课程大纲中的**精确标签名称**，可选标签如下：
${physicsTagsString}

**重要提示**：
- 必须从上述列表中选择精确匹配的标签
- 每题最多 5 个标签`;
  } else if (subject === '化学') {
    tagsSection = `**化学标签 (Chemistry Tags):**
使用课程大纲中的**精确标签名称**，可选标签如下：
${chemistryTagsString}

**重要提示**：
- 必须从上述列表中选择精确匹配的标签
- 每题最多 5 个标签`;
  } else if (subject === '生物') {
    tagsSection = `**生物标签 (Biology Tags):**
使用课程大纲中的**精确标签名称**，可选标签如下：
${biologyTagsString}

**重要提示**：
- 必须从上述列表中选择精确匹配的标签
- 每题最多 5 个标签`;
  } else if (subject === '英语') {
    tagsSection = `**英语标签 (English Tags):**
使用课程大纲中的**精确标签名称**，可选标签如下：
${englishTagsString}

**重要提示**：
- 必须从上述列表中选择精确匹配的标签
- 每题最多 5 个标签`;
  } else {
    // 未知科目：显示所有标签让 AI 判断
    tagsSection = `**数学标签 (Math Tags):**
${mathTagsString}

**物理标签 (Physics Tags):**
${physicsTagsString}

**化学标签 (Chemistry Tags):**
${chemistryTagsString}

**生物标签 (Biology Tags):**
${biologyTagsString}

**英语标签 (English Tags):**
${englishTagsString}`;
  }

  const template = options?.customTemplate || DEFAULT_ANALYZE_TEMPLATE;

  return replaceVariables(template, {
    language_instruction: langInstruction,
    knowledge_points_list: tagsSection || "可根据行测/申论考点自由标注精准标签名称。",
    ai_subject_list: AI_SUBJECT_PROMPT_LIST,
    grade_instruction: generateGradeInstruction(gradeSemester),
    provider_hints: options?.providerHints || ''
  }).trim();
}

/**
 * 生成整页题目定位提示词（/api/analyze/detect）
 * @param options - 可选自定义模板
 */
export function generateDetectPrompt(options?: PromptOptions): string {
  const template = options?.customTemplate || DEFAULT_DETECT_TEMPLATE;
  return replaceVariables(template, {
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
  options?: PromptOptions,
  gradeSemester?: string | null
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
    grade_instruction: generateGradeInstruction(gradeSemester),
    provider_hints: options?.providerHints || ''
  }).trim();
}

/**
 * 重新解题提示词模板
 * 用于根据校正后的题目文本重新生成答案和解析
 */
export const DEFAULT_REANSWER_TEMPLATE = `【角色与核心任务 (ROLE AND CORE TASK)】
你是一位资深的公务员考试（行测/申论）辅导老师。用户已经提供了一道**校正后的题目文本**，请你为这道题目提供正确的答案和详细的解析。

{{language_instruction}}

【题目内容 (QUESTION)】
{{question_text}}

【学科提示 (SUBJECT HINT)】
{{subject_hint}}

【核心输出要求 (OUTPUT REQUIREMENTS)】
你的响应输出**必须严格遵循以下自定义标签格式**。**严禁**使用 JSON 或 Markdown 代码块。

请严格按照以下结构输出内容（不要包含任何其他文字）：

<answer_text>
在此处填写正确答案。客观题写清选项字母；常识/时政不确定时注明「需人工核对」。
</answer_text>

<analysis>
在此处填写详细解析，必须使用简体中文，并按四段结构：考点、选项排除、步骤、易错点。
* **直接使用标准的 LaTeX 符号**（如 $\\frac{1}{2}$），**不要**进行 JSON 转义。
</analysis>

<knowledge_points>
在此处填写考点标签，使用逗号分隔，例如：削弱加强, 因果倒置
</knowledge_points>

<wrong_answer_text>
请只根据校正后的题目文本和当前图片中可见的学生作答痕迹重新判断学生错误解答。如果当前图片中可见错误解答、错误步骤、草稿或错误答案，请尽量按原样摘录；如果看不到学生作答痕迹，请留空，不要猜测。
</wrong_answer_text>

<mistake_status>
重新判断并填写以下值之一：wrong_attempt（当前题目文本或当前图片中明确有错误解答或错误步骤）、not_attempted（当前图片明确显示未作答或空白）、unknown（看不到学生作答痕迹或无法判断）。不要猜测。
</mistake_status>

<mistake_analysis>
请基于校正后的题目和当前图片中可见的学生作答痕迹重新判断错因。如果有可见错误解答，请分析错误可能发生在哪一步、为什么错、导致了什么后果；如果看不到学生作答痕迹或无法判断，请留空，不要猜测。
</mistake_analysis>

【!!! 关键格式与内容约束 (CRITICAL RULES) !!!】
1. **格式严格**：必须严格包含上述 6 个 XML 标签，不要输出其他内容。
2. **纯文本**：内容作为纯文本处理，**不要转义反斜杠**。
3. **题目不变**：不要修改或重复题目内容，只提供答案和解析。

{{grade_instruction}}
{{provider_hints}}`;

/**
 * GeoGebra 动态演示生成提示词
 * 用于判断题目是否可以用 GeoGebra 演示，以及生成对应的 GeoGebra 命令
 */
export const DEFAULT_GEOGEBRA_PROMPT = `【角色与核心任务 (ROLE AND CORE TASK)】
你是一位专业的 GeoGebra 数学可视化专家。你的任务是分析一道数学题目，判断它是否适合用 GeoGebra 进行动态可视化演示。如果适合，生成可以直接在 GeoGebra 中执行的命令。

【题目内容 (QUESTION)】
{{question_text}}

【答案内容 (ANSWER)】
{{answer_text}}

【解析内容 (ANALYSIS)】
{{analysis}}

{{error_feedback}}

【判断标准 (SUITABILITY CRITERIA)】
适合用 GeoGebra 演示的题目类型：
1. **函数与图像**：一次函数、二次函数、反比例函数、指数函数、对数函数、三角函数等
2. **几何图形**：三角形、四边形、圆、直线关系（平行、垂直）、角度
3. **解析几何**：直线方程、圆的方程、椭圆、双曲线、抛物线
4. **向量**：向量运算、向量的几何表示
5. **概率统计**：数据分布图、正态分布曲线
6. **不等式**：线性规划、可行域
7. **立体几何**（部分可演示）：截面、展开图

不适合用 GeoGebra 演示的题目类型：
1. 纯文字推理题、证明题（无图形元素）
2. 纯计算题（如解方程、化简表达式）
3. 概念辨析题、选择题（无几何内容）
4. 英语、语文、历史等非理科题目
5. 概率计算（无图形意义的）
6. 数列通项公式推导（无图形意义的）

【GeoGebra 命令规范 (COMMAND SYNTAX)】
如果适合演示，生成 GeoGebra 命令数组。每条命令一行，支持以下类型：

**GeoGebra 绘图命令（通过 evalCommand 执行）：**
- 函数：f(x) = x^2
- 点：A = (1, 2)
- 直线：line: y = 2x + 1  或  Line(A, B)
- 线段：Segment(A, B)
- 圆：Circle(A, 3)  或  c: (x-1)^2 + (y-2)^2 = 9
- 椭圆：Ellipse(F1, F2, 5)
- 多边形：Polygon(A, B, C)
- 交点：Intersect(f, g, 1)  或  Intersect(f, g, x1, x2)
- 中点：Midpoint(A, B)
- 垂线：PerpendicularLine(P, l)
- 平行线：ParallelLine(P, l)
- 角度：Angle(A, B, C)
- 文本：Text("说明文字", (x, y))
- 滑动条：a = Slider(-5, 5, 0.1)
- 轨迹：Locus(P, Q)
- 反射：Reflect(A, l)
- 平移：Translate(A, v)
- 旋转：Rotate(A, angle, center)

**Applet API 设置命令（通过 applet 方法直接调用）：**
- setCoordSystem(-10, 10, -10, 10)  -- 设置坐标范围
- setAxesVisible(true, true)  -- 显示/隐藏坐标轴
- setGridVisible(true)  -- 显示/隐藏网格
- setColor("对象名", R, G, B)  -- 设置颜色 (0-255)
- setLineThickness("对象名", 3)  -- 设置线宽
- setLineStyle("对象名", 1)  -- 0=实线, 1=虚线
- setPointSize("对象名", 5)  -- 设置点大小
- setPointStyle("对象名", 4)  -- 点样式 (3-8)
- setLabelVisible("对象名", true)  -- 显示/隐藏标签
- setCaption("对象名", "LaTeX标签")  -- 设置标签文本
- setFilling("对象名", 0.3)  -- 设置填充透明度 (0-1)

【输出格式 (OUTPUT FORMAT)】
你的响应必须**只有以下 JSON 格式**，不要包含其他任何文字：

如果题目**适合**用 GeoGebra 演示：
{"suitable": true, "commands": ["命令1", "命令2", "命令3", ...], "description": "简要说明演示内容"}

如果题目**不适合**用 GeoGebra 演示：
{"suitable": false, "commands": [], "description": "不适合原因简述"}

【!!! 关键约束 (CRITICAL RULES) !!!】
1. 输出必须是合法的 JSON，不要添加 markdown 代码块标记
2. commands 数组中的每条命令必须是 GeoGebra 可直接执行的语法
3. setCoordSystem 应根据题目内容合理设置坐标范围
4. 所有图形对象应设置合适的颜色和样式以便于观察
5. 确保坐标范围能让所有关键图形和交点清晰可见
6. description 用简体中文
7. 如果题目涉及参数讨论（如讨论 a 的取值范围），用滑动条 (Slider) 展示参数变化效果
8. 对于函数题，应画出函数图像并标注关键点（交点、顶点、渐近线等）
9. 【!!! 命令语法检查 (COMMAND SYNTAX CHECK) !!!】在生成命令后，必须逐条检查以下内容：
   a. 每个变量在使用前必须已被定义（例如如果使用 F = Intersect(f, g)，则 f 和 g 必须在之前已定义）
   b. 所有命令名称必须是 GeoGebra 官方支持的指令（如平行线用 Line(P, l) 而非 ParallelLine(P, l)）
   c. 命令顺序必须合理：先定义基础对象（点、线、函数），再定义派生对象（交点、轨迹、变换）
   d. 每个命令的语法必须正确（参数数量、类型、顺序与 GeoGebra 官方文档一致）
   e. 如果使用了循环或条件语句，确保语法正确
   f. 坐标轴范围 (setCoordSystem) 必须在所有绘图命令之前设置`;

/**
 * 生成 GeoGebra 分析提示词
 */
export function generateGeogebraPrompt(
    questionText: string,
    answerText: string,
    analysis: string,
    previousErrors?: string
): string {
    let prompt = DEFAULT_GEOGEBRA_PROMPT.replace(
        "{{question_text}}",
        questionText
    )
        .replace("{{answer_text}}", answerText)
        .replace("{{analysis}}", analysis);

    if (previousErrors?.trim()) {
        prompt = prompt.replace(
            "{{error_feedback}}",
            `【上次执行错误 (PREVIOUS ERRORS)】\n上次生成的 GeoGebra 命令执行时出现了以下错误，请分析错误原因并在这次生成中修正：\n${previousErrors}\n\n【错误修正要求 (ERROR FIX RULES)】\n请严格按以下步骤修正：\n1. 检查每条失败命令，确认是语法错误、变量未定义还是命令名称错误\n2. 如果是"未定义变量X"，在命令之前添加定义该变量的命令，或调整命令顺序\n3. 如果是"未知的指令"，替换为 GeoGebra 官方支持的等效命令（如 Line(P, l) 替代 ParallelLine(P, l)）\n4. 重新排列所有命令的顺序，确保每个对象在使用前已定义\n5. 生成后再次逐条检查：每条命令的语法、变量引用、依赖关系是否正确`
        );
    } else {
        prompt = prompt.replace("{{error_feedback}}", "");
    }

    return prompt;
}

/**
 * 生成「举一反三」批量出题提示词（一次调用生成 count 道变式题，JSON 数组输出）
 * @param language - 语言 ('zh' 或 'en')
 * @param originalQuestion - 原错题/锚文本
 * @param knowledgePoints - 考点标签
 * @param difficulty - 难度
 * @param count - 题目数量（1-5）
 * @param options - 可选自定义模板与防重复旧题
 */
export function generateSimilarQuestionBatchPrompt(
  originalQuestion: string,
  knowledgePoints: string[],
  language: 'zh' | 'en',
  difficulty: 'easy' | 'medium' | 'hard' | 'harder',
  count: number,
  options?: PromptOptions,
  gradeSemester?: string | null
): string {
  const langInstruction = language === 'zh'
    ? "IMPORTANT: Provide the output based on the 'Original Question' language. 解析必须使用简体中文。"
    : "Please ensure all fields are in English.";

  const difficultyMap = {
    'easy': "EASIER than the original. 更直白的数字与更弱的干扰项。",
    'medium': "SAME difficulty as the original. 标准国考/省考难度。",
    'hard': "HARDER than the original. 干扰更强或多一步推理/估算。",
    'harder': "MUCH HARDER (Challenge Level). 更深理解与多步推理。"
  };
  const template = options?.customTemplate || DEFAULT_SIMILAR_BATCH_TEMPLATE;

  return replaceVariables(template, {
    question_count: String(count),
    difficulty: difficultyMap[difficulty],
    difficulty_level: difficulty.toUpperCase(),
    language_instruction: langInstruction,
    original_question: originalQuestion.replace(/"/g, '\\"').replace(/\n/g, '\\n'),
    knowledge_points: knowledgePoints.join(", "),
    recent_questions: (options?.recentQuestions || []).map(q => q.replace(/\s+/g, " ").slice(0, 80)).join("／") || "（无）",
    grade_instruction: generateGradeInstruction(gradeSemester),
    provider_hints: options?.providerHints || '',
  }).trim();
}

/**
 * 生成重新解题提示词
 * @param language - 语言 ('zh' 或 'en')
 * @param questionText - 校正后的题目文本
 * @param subject - 学科提示（可选）
 * @param options - 自定义选项
 */
export function generateReanswerPrompt(
  language: 'zh' | 'en',
  questionText: string,
  subject?: string | null,
  options?: PromptOptions,
  gradeSemester?: string | null
): string {
  const langInstruction = language === 'zh'
    ? "IMPORTANT: 解析必须使用简体中文。如果题目是英文，答案保持英文，但解析用中文。"
    : "Please ensure all text fields are in English.";

  const subjectHint = subject
    ? `本题学科：${subject}`
    : "请根据题目内容判断学科。";

  const template = options?.customTemplate || DEFAULT_REANSWER_TEMPLATE;

  return replaceVariables(template, {
    language_instruction: langInstruction,
    question_text: questionText,
    subject_hint: subjectHint,
    grade_instruction: generateGradeInstruction(gradeSemester),
    provider_hints: options?.providerHints || ''
  }).trim();
}
