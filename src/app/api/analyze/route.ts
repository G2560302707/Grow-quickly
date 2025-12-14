import { NextResponse } from "next/server";
import { getAIService } from "@/lib/ai";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { calculateGrade, inferSubjectFromName } from "@/lib/knowledge-tags";
import { prisma } from "@/lib/prisma";
import { badRequest, internalError, createErrorResponse, ErrorCode } from "@/lib/api-errors";

export async function POST(req: Request) {
    console.log("[API] /api/analyze called");
    console.log("[API] Env Vars:", Object.keys(process.env).filter(k => k.includes("GOOGLE") || k.includes("NEXT")));

    const session = await getServerSession(authOptions);

    // 注释掉认证检查以便测试,生产环境应启用
    // if (!session) {
    //     console.log("[API] Unauthorized access attempt");
    //     return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    // }

    try {
        const body = await req.json();
        let { imageBase64, mimeType, language, subjectId } = body;

        console.log(`[API] Request received. Image length: ${imageBase64?.length}, MimeType: ${mimeType}, Language: ${language}, SubjectId: ${subjectId}`);

        if (!imageBase64) {
            console.log("[API] Missing image data");
            return badRequest("Missing image data");
        }

        // Parse Data URL if present
        if (imageBase64.startsWith('data:')) {
            const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                imageBase64 = matches[2];
                console.log(`[API] Parsed Data URL. New MimeType: ${mimeType}, Base64 length: ${imageBase64.length}`);
            }
        }

        // 先获取用户年级信息，用于动态生成 AI prompt 中的标签列表
        let userGrade: 7 | 8 | 9 | 10 | 11 | 12 | null = null;
        let subjectName: 'math' | 'physics' | 'chemistry' | 'biology' | 'english' | null = null;

        if (session?.user?.email) {
            try {
                // 获取用户信息
                const user = await prisma.user.findUnique({
                    where: { email: session.user.email },
                    select: { educationStage: true, enrollmentYear: true }
                });

                if (user) {
                    userGrade = calculateGrade(user.educationStage, user.enrollmentYear);
                    console.log("[API] Calculated user grade:", userGrade);
                }

                // 获取错题本信息以推断学科
                if (subjectId) {
                    const subject = await prisma.subject.findUnique({
                        where: { id: subjectId },
                        select: { name: true }
                    });

                    if (subject) {
                        subjectName = inferSubjectFromName(subject.name);
                        console.log("[API] Inferred subject:", subjectName, "from:", subject.name);
                    }
                }
            } catch (error) {
                console.error("[API] Error fetching user/subject info:", error);
                // 继续执行，不传递年级参数（会返回所有年级的标签）
            }
        }


        // 将内部科目名称转换为中文科目名称
        const subjectNameMapping: Record<string, string> = {
            'math': '数学',
            'physics': '物理',
            'chemistry': '化学',
            'biology': '生物',
            'english': '英语',
        };
        const subjectChinese = subjectName ? subjectNameMapping[subjectName] : null;

        console.log("[API] Calling AI service analyzeImage with grade:", userGrade, "subject:", subjectChinese);
        const aiService = getAIService();
        const analysisResult = await aiService.analyzeImage(imageBase64, mimeType, language, userGrade, subjectChinese);


        console.log("[API] AI returned knowledgePoints:", analysisResult.knowledgePoints);
        console.log("[API] knowledgePoints type:", typeof analysisResult.knowledgePoints);
        console.log("[API] knowledgePoints isArray:", Array.isArray(analysisResult.knowledgePoints));

        // AI 现在从数据库获取标签列表，返回的标签已经是标准化的，不需要额外处理
        if (!analysisResult.knowledgePoints || analysisResult.knowledgePoints.length === 0) {
            console.log("[API] ⚠️ WARNING: knowledgePoints is empty or null!");
        }

        console.log("[API] AI analysis successful");

        return NextResponse.json(analysisResult);
    } catch (error: any) {
        console.error("[API] Analysis error details:", error);
        console.error("[API] Error message:", error.message);
        console.error("[API] Error stack:", error.stack);

        // 返回具体的错误类型，便于前端显示详细提示
        let errorMessage = error.message || "Failed to analyze image";

        // 识别特定错误类型
        if (error.message && (
            error.message === 'AI_CONNECTION_FAILED' ||
            error.message === 'AI_RESPONSE_ERROR' ||
            error.message.includes('AI_AUTH_ERROR') ||
            error.message === 'AI_UNKNOWN_ERROR'
        )) {
            // 直接传递 AI Provider 定义的错误类型 (如果是 AI_AUTH_ERROR，提取出来)
            if (error.message.includes('AI_AUTH_ERROR')) {
                errorMessage = 'AI_AUTH_ERROR';
            } else {
                errorMessage = error.message;
            }
        } else if (error.message?.includes('Zod') || error.message?.includes('validate')) {
            // Zod 验证错误
            errorMessage = 'AI_RESPONSE_ERROR';
        }

        return createErrorResponse(errorMessage, 500, ErrorCode.AI_ERROR, error.message);
    }
}
