import { NextResponse } from "next/server";
import { getAIService } from "@/lib/ai";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

export async function POST(req: Request) {
    console.log("[API] /api/reanswer called");

    const session = await getServerSession(authOptions);

    // 认证检查（可选，根据需要启用）
    // if (!session) {
    //     return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    // }

    try {
        const body = await req.json();
        const { questionText, language = 'zh', subject, imageBase64 } = body;

        console.log(`[API] Reanswer request. Question length: ${questionText?.length}, Language: ${language}, Subject: ${subject}, HasImage: ${!!imageBase64}`);

        if (!questionText || questionText.trim().length === 0) {
            return NextResponse.json({ message: "Missing question text" }, { status: 400 });
        }

        const aiService = getAIService();

        // 根据是否有图片选择不同的重新解题方式
        const result = await aiService.reanswerQuestion(questionText, language, subject, imageBase64);

        console.log("[API] Reanswer successful");

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("[API] Reanswer error:", error);

        let errorMessage = error.message || "Failed to reanswer question";

        if (error.message?.includes('AI_AUTH_ERROR')) {
            errorMessage = 'AI_AUTH_ERROR';
        } else if (error.message === 'AI_CONNECTION_FAILED') {
            errorMessage = 'AI_CONNECTION_FAILED';
        } else if (error.message === 'AI_RESPONSE_ERROR') {
            errorMessage = 'AI_RESPONSE_ERROR';
        }

        return NextResponse.json(
            { message: errorMessage },
            { status: 500 }
        );
    }
}
