import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { calculateGrade } from "@/lib/grade-calculator";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    try {
        const body = await req.json();
        const {
            questionText,
            answerText,
            analysis,
            knowledgePoints,
            originalImageUrl, // We'll need to handle image storage properly later, for now assuming URL or base64
            subjectId,
            gradeSemester,
            paperLevel,
        } = body;

        let user;
        if (session?.user?.email) {
            user = await prisma.user.findUnique({
                where: { email: session.user.email },
            });
        }

        // Fallback logic removed for security. 
        // We must strictly require a valid session user.

        if (!user) {
            return NextResponse.json({ message: "Unauthorized - No user found in DB" }, { status: 401 });
        }

        // Calculate grade if not provided
        let finalGradeSemester = gradeSemester;
        if (!finalGradeSemester && user.educationStage && user.enrollmentYear) {
            // Default to English or handle language if passed in body? 
            // For backend simplicity, let's default to English or check if we can infer.
            // Actually, the frontend should send the calculated value. 
            // If it falls back here, it might be better to use a default.
            // Let's assume frontend sends it most of the time.
            finalGradeSemester = calculateGrade(user.educationStage, user.enrollmentYear);
        }

        console.log("[API] Creating ErrorItem with data:", {
            userId: user.id,
            questionText: questionText || "",
            answerText: answerText || "",
            analysis: analysis || "",
            knowledgePoints: JSON.stringify(knowledgePoints || []),
            originalImageUrl: (originalImageUrl || "").substring(0, 50) + "...", // Truncate for log
            masteryLevel: 0,
            gradeSemester: finalGradeSemester,
            subjectId: subjectId,
            paperLevel: paperLevel,
        });

        console.log("[API] ========== SAVING ERROR ITEM ==========");
        console.log("[API] Received knowledgePoints:", knowledgePoints);
        console.log("[API] knowledgePoints type:", typeof knowledgePoints);
        console.log("[API] knowledgePoints isArray:", Array.isArray(knowledgePoints));
        console.log("[API] knowledgePoints length:", knowledgePoints?.length);
        console.log("[API] knowledgePoints content:", JSON.stringify(knowledgePoints));

        const errorItem = await prisma.errorItem.create({
            data: {
                userId: user.id,
                subjectId: subjectId || undefined,
                originalImageUrl,
                questionText,
                answerText,
                analysis,
                knowledgePoints: typeof knowledgePoints === 'string' ? knowledgePoints : JSON.stringify(knowledgePoints),
                gradeSemester: finalGradeSemester,
                paperLevel: paperLevel,
                masteryLevel: 0, // Default mastery level
            },
        });

        return NextResponse.json(errorItem, { status: 201 });
    } catch (error) {
        console.error("Error saving item:", error);
        return NextResponse.json(
            { message: "Failed to save error item" },
            { status: 500 }
        );
    }
}
