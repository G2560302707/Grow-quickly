import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { getAIService } from "@/lib/ai";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    try {
        const { errorItemId, language, difficulty } = await req.json();

        const errorItemWithSubject = await prisma.errorItem.findUnique({
            where: { id: errorItemId },
            include: { subject: true }
        });

        if (!errorItemWithSubject) {
            return NextResponse.json({ message: "Item not found" }, { status: 404 });
        }

        let tags: string[] = [];
        try {
            tags = JSON.parse(errorItemWithSubject.knowledgePoints || "[]");
        } catch (e) {
            tags = [];
        }

        const aiService = getAIService();
        const similarQuestion = await aiService.generateSimilarQuestion(
            errorItemWithSubject.questionText || "",
            tags,
            language,
            difficulty || 'medium'
        );

        // Inject the subject from the database
        similarQuestion.subject = errorItemWithSubject.subject?.name || "Unknown";

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
