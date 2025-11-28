import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { getAIService } from "@/lib/ai";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    try {
        const { errorItemId, language, difficulty } = await req.json();

        const errorItem = await prisma.errorItem.findUnique({
            where: { id: errorItemId },
        });

        if (!errorItem) {
            return NextResponse.json({ message: "Item not found" }, { status: 404 });
        }

        let tags: string[] = [];
        try {
            tags = JSON.parse(errorItem.knowledgePoints || "[]");
        } catch (e) {
            tags = [];
        }

        const aiService = getAIService();
        const similarQuestion = await aiService.generateSimilarQuestion(
            errorItem.questionText || "",
            tags,
            language,
            difficulty || 'medium'
        );

        return NextResponse.json(similarQuestion);
    } catch (error) {
        console.error("Error generating practice:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to generate practice question";
        return NextResponse.json(
            { message: errorMessage },
            { status: 500 }
        );
    }
}
