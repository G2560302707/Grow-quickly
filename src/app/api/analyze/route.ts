import { NextResponse } from "next/server";
import { getAIService } from "@/lib/ai";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { normalizeTags } from "@/lib/knowledge-tags";

export async function POST(req: Request) {
    console.log("[API] /api/analyze called");
    console.log("[API] Env Vars:", Object.keys(process.env).filter(k => k.includes("GOOGLE") || k.includes("NEXT")));
    // const session = await getServerSession(authOptions);

    // if (!session) {
    //     console.log("[API] Unauthorized access attempt");
    //     return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    // }

    try {
        const body = await req.json();
        let { imageBase64, mimeType, language } = body;

        console.log(`[API] Request received. Image length: ${imageBase64?.length}, MimeType: ${mimeType}, Language: ${language}`);

        if (!imageBase64) {
            console.log("[API] Missing image data");
            return NextResponse.json({ message: "Missing image data" }, { status: 400 });
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

        console.log("[API] Calling AI service analyzeImage...");
        const aiService = getAIService();
        const analysisResult = await aiService.analyzeImage(imageBase64, mimeType, language);

        // 标准化知识点标签
        if (analysisResult.knowledgePoints && analysisResult.knowledgePoints.length > 0) {
            analysisResult.knowledgePoints = normalizeTags(analysisResult.knowledgePoints);
            console.log("[API] Normalized tags:", analysisResult.knowledgePoints);
        }

        console.log("[API] AI analysis successful");

        return NextResponse.json(analysisResult);
    } catch (error: any) {
        console.error("[API] Analysis error details:", error);
        console.error("[API] Error message:", error.message);
        console.error("[API] Error stack:", error.stack);
        return NextResponse.json(
            { message: "Failed to analyze image", error: error.message },
            { status: 500 }
        );
    }
}
