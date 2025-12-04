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
       使用人教版课程大纲中的**精确标签名称**，常见标签示例：
       - 七年级："有理数", "绝对值", "有理数的加法", "一元一次方程", "解一元一次方程", "三角形三边关系"
       - 八年级："全等三角形", "全等三角形的判定", "平行四边形的性质", "勾股定理", "一次函数", "一次函数的图象和性质", "平均数", "中位数", "方差"
       - 九年级："一元二次方程", "配方法", "韦达定理", "二次函数", "二次函数顶点式", "二次函数一般式", "抛物线的顶点坐标", "圆周角定理", "切线的性质", "反比例函数", "相似三角形的判定"
       
       **重要提示**：
       - 使用精确的标签名称，例如："二次函数一般式" 而非 "二次函数的图像"
       - 使用 "三视图" 而非 "左视图"、"主视图" 或 "俯视图"
       - 使用 "相似三角形的判定" 而非笼统的 "相似三角形"
       - 使用 "全等三角形的判定" 以及具体判定法 "SSS", "SAS", "ASA", "AAS", "HL"
       
       **物理标签 (Physics Tags):**
       暂无标准标签库，可使用通用标签如："力学", "电学", "光学", "热学", "欧姆定律", "浮力"
       
       **化学标签 (Chemistry Tags):**
       暂无标准标签库，可使用通用标签如："化学方程式", "氧化还原反应", "酸碱盐"
       
       **英语标签 (English Tags):**
       "语法", "词汇", "阅读理解", "完形填空", "写作", "听力", "翻译"

       **其他学科 (Other Subjects):**
       对于语文、历史、地理等学科，使用合适的通用标签，例如："历史事件", "地理常识", "古诗文"
       
       **CRITICAL RULES:**
       - 对于数学题目，必须从人教版课程大纲中选择精确的标签名称
       - 如遇到具体知识点（如 "一元二次方程的根与系数关系"），应使用对应的标准标签（如 "韦达定理"）
       - 标签须与题目实际考查的知识点精准匹配
       - 每题最多 5 个标签
       
       
    CRITICAL FORMATTING REQUIREMENTS:  
    - Return ONLY a valid JSON object, nothing else
    - Do NOT add any text before or after the JSON
    - Do NOT wrap the JSON in markdown code blocks
    - Do NOT add explanatory text like "The final answer is..."
    - Do NOT include HTML tags (like <img>, <center>, etc.) in the extracted text
    - Extract the ACTUAL text content from the image, not HTML references to the image
    
    IMPORTANT: 
    - If the image contains a question with multiple sub-questions (like (1), (2), (3)), include ALL sub-questions in the questionText field.
    - If the image contains completely separate questions (different question numbers), only analyze the first complete question with all its sub-questions.
    - If the image is unclear or does not contain a question, return empty strings but valid JSON.
    
    **Expected JSON Format:**
    {
      "questionText": "题目的完整文本，支持 Markdown 和 LaTeX ($formula$ 或 $$formula$$)",
      "answerText": "正确答案",
      "analysis": "详细解析步骤",
      "subject": "数学",
      "knowledgePoints": ["知识点1", "知识点2"]
    }
    
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
    4. "subject": The subject category. Choose ONE from: "数学", "物理", "化学", "生物", "英语", "语文", "历史", "地理", "政治", "其他".
    5. "knowledgePoints": The knowledge points (should match input).
    
    CRITICAL FORMATTING:
    - Return ONLY a valid JSON object, no extra text
    - Do NOT wrap in markdown code blocks
    
    **Expected JSON Format:**
    {
      "questionText": "新问题的文本（如果是选择题，包含选项 A、B、C、D）",
      "answerText": "正确答案",
      "analysis": "详细解析",
      "subject": "数学",
      "knowledgePoints": ["知识点1", "知识点2"]
    }
    
    ${options?.providerHints || ''}
  `;

  return basePrompt.trim();
}
