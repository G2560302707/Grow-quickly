/**
 * Shared AI prompt templates
 * This module provides centralized prompt management with customization options
 */

export interface PromptOptions {
  /**
   * Additional instructions specific to the AI provider
   */
  providerHints?: string;

  /**
   * Custom knowledge tags to include beyond the standard set
   */
  additionalTags?: {
    subject: string;
    tags: string[];
  }[];
}

/**
 * Generates the analyze image prompt
 * @param language - Target language for analysis ('zh' or 'en')
 * @param options - Optional customizations
 */
export function generateAnalyzePrompt(language: 'zh' | 'en', options?: PromptOptions): string {
  const langInstruction = language === 'zh'
    ? "IMPORTANT: For the 'analysis' field, use Simplified Chinese. For 'questionText' and 'answerText', YOU MUST USE THE SAME LANGUAGE AS THE ORIGINAL QUESTION. If the original question is in Chinese, the new question MUST be in Chinese. If the original is in English, keep it in English."
    : "Please ensure all text fields are in English.";

  const basePrompt = `
    You are to assume the role of an experienced, professional Interdisciplinary Exam Analysis Expert . Your core task is to thoroughly analyze the exam question image provided by the user, comprehend all textual information, diagrams, and implicit constraints, and deliver a complete, highly structured, and professional solution.
    
    ${langInstruction}
    
    **CRITICAL: You must extract the EXACT TEXT as it appears in the image, NOT a description of what you see.**
    - Extract the actual Chinese/English text visible in the image
    
    Please extract the following information and return it in valid JSON format:
    1. "questionText": The full text of the question. Use Markdown format for better readability. Use LaTeX notation for mathematical formulas (inline: $formula$, block: $$formula$$).
    2. "answerText": The correct answer to the question. Use Markdown and LaTeX where appropriate.
    3. "analysis": A step-by-step explanation of how to solve the problem. 
       - Use Markdown formatting (headings, lists, bold, etc.) for clarity
       - Use LaTeX for all mathematical formulas and expressions
       - Example: "The solution is $x = \\\\frac{-b \\\\pm \\\\sqrt{b^2 - 4ac}}{2a}$"
       - For block formulas, use $$...$$
    4. "subject": The subject of the question. Choose ONE from: "数学", "物理", "化学", "生物", "英语", "语文", "历史", "地理", "政治", "其他".
    5. "knowledgePoints": An array of knowledge points. STRICTLY use EXACT terms from the standard list below:
       
       **数学标签 (Math Tags):**
       - 方程: "一元一次方程", "一元二次方程", "二元一次方程组", "分式方程"
       - 几何: "勾股定理", "相似三角形", "全等三角形", "圆", "三视图", "平行四边形", "矩形", "菱形"
       - 函数: "二次函数", "一次函数", "反比例函数", "二次函数的图像", "二次函数的性质"
       - 数值: "绝对值", "有理数", "实数", "科学计数法"
       - 统计: "概率", "平均数", "中位数", "方差"
       
       **物理标签 (Physics Tags):**
       - 力学: "匀速直线运动", "变速运动", "牛顿第一定律", "牛顿第二定律", "牛顿第三定律", "力", "压强", "浮力"
       - 电学: "欧姆定律", "串联电路", "并联电路", "电功率", "电功"
       - 光学: "光的反射", "光的折射", "凸透镜", "凹透镜"
       - 热学: "温度", "内能", "比热容", "热机效率"
       
       **化学标签 (Chemistry Tags):**
       - "化学方程式", "氧化还原反应", "酸碱盐", "中和反应", "金属", "非金属", "溶解度"
       
       **英语标签 (English Tags):**
       - "语法", "词汇", "阅读理解", "完形填空", "写作", "听力", "翻译"

       **其他学科 (Other Subjects):**
       - If the subject is NOT Math, Physics, Chemistry, or English, you may use appropriate general tags (e.g., "历史事件", "地理常识", "古诗文").
       
       **IMPORTANT RULES:**
       - For Math/Physics/Chemistry, use EXACT matches from the list above.
       - For English and other subjects, use the provided tags or relevant standard terms.
       - Maximum 5 tags per question
       
    CRITICAL FORMATTING REQUIREMENTS:  
    - Return ONLY the JSON object, nothing else
    - Do NOT add any text before or after the JSON
    - Do NOT wrap the JSON in markdown code blocks
    - Do NOT add explanatory text like "The final answer is..."
    - Do NOT include HTML tags (like <img>, <center>, etc.) in the extracted text
    - Extract the ACTUAL text content from the image, not HTML references to the image
    - Ensure all backslashes in LaTeX are properly escaped (use \\\\\\\\ instead of \\\\)
    - Ensure all strings are properly escaped
    - NO literal newlines in strings. Use \\\\n for newlines.
    
    IMPORTANT: 
    - If the image contains a question with multiple sub-questions (like (1), (2), (3)), include ALL sub-questions in the questionText field.
    - If the image contains completely separate questions (different question numbers), only analyze the first complete question with all its sub-questions.
    - If the image is unclear or does not contain a question, return empty strings but valid JSON.
    
    ${options?.providerHints || ''}
  `;

  return basePrompt.trim();
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
    ? "IMPORTANT: Generate the new question in Simplified Chinese. The new question MUST use the SAME LANGUAGE as the original question."
    : "Please ensure the generated question is in English.";

  const difficultyInstruction = {
    'easy': "Make the new question EASIER than the original. Use simpler numbers and more direct concepts.",
    'medium': "Keep the difficulty SIMILAR to the original question.",
    'hard': "Make the new question HARDER than the original. Combine multiple concepts or use more complex numbers.",
    'harder': "Make the new question MUCH HARDER (Challenge Level). Require deeper understanding and multi-step reasoning."
  }[difficulty];

  const basePrompt = `
    You are an expert AI tutor creating practice problems for middle school students.
    Create a NEW practice problem based on the following original question and knowledge points.
    
    DIFFICULTY LEVEL: ${difficulty.toUpperCase()}
    ${difficultyInstruction}
    
    ${langInstruction}
    
    Original Question: "${originalQuestion}"
    Knowledge Points: ${knowledgePoints.join(", ")}
    
    Return the result in valid JSON format with the following fields:
    1. "questionText": The text of the new question. IMPORTANT: If the original question is a multiple-choice question, you MUST include the options (A, B, C, D) in this field as well. Format them clearly (e.g., using \\\\n for new lines).
    2. "answerText": The correct answer.
    3. "analysis": Step-by-step solution.
    4. "knowledgePoints": The knowledge points (should match input).
    
    CRITICAL FORMATTING:
    - Return ONLY the JSON object, no extra text
    - Do NOT wrap in markdown code blocks
    - Properly escape all backslashes in LaTeX
    - No literal newlines in strings
    
    ${options?.providerHints || ''}
  `;

  return basePrompt.trim();
}
