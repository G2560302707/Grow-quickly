import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, forbidden, notFound, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { getAIService } from "@/lib/ai";

const logger = createLogger('api:error-items:geogebra');

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    try {
        let user;
        if (session?.user?.email) {
            user = await prisma.user.findUnique({
                where: { email: session.user.email },
            });
        }

        if (!user) {
            return unauthorized("Authentication required");
        }

        const errorItem = await prisma.errorItem.findUnique({
            where: { id },
            include: { subject: true },
        });

        if (!errorItem) {
            return notFound("Item not found");
        }

        if (errorItem.userId !== user.id) {
            return forbidden("Not authorized to access this item");
        }

        // Only analyze math-related subjects
        const subjectName = errorItem.subject?.name || "";
        const isMathRelated =
            subjectName.includes("数学") ||
            subjectName.toLowerCase().includes("math") ||
            subjectName.includes("物理") ||
            subjectName.toLowerCase().includes("physics");

        if (!isMathRelated) {
            return NextResponse.json({
                suitable: false,
                commands: [],
                description: "仅数学和物理题目支持 GeoGebra 动态演示",
            });
        }

        if (!errorItem.questionText) {
            return NextResponse.json({
                suitable: false,
                commands: [],
                description: "题目文本为空，无法分析",
            });
        }

        const aiService = getAIService();
        const result = await aiService.analyzeForGeogebra(
            errorItem.questionText,
            errorItem.answerText || "",
            errorItem.analysis || ""
        );

        // If suitable, save the commands to the database
        if (result.suitable && result.commands.length > 0) {
            await prisma.errorItem.update({
                where: { id },
                data: {
                    geogebraCommands: JSON.stringify(result.commands),
                },
            });
        }

        logger.info({ id, suitable: result.suitable, commandCount: result.commands.length }, 'GeoGebra analysis complete');

        return NextResponse.json(result);
    } catch (error) {
        logger.error({ error }, 'Error during GeoGebra analysis');

        const errorMsg = error instanceof Error ? error.message : String(error);

        // Pass through AI-specific errors
        if (errorMsg.startsWith("AI_")) {
            return NextResponse.json(
                { message: errorMsg },
                { status: 502 }
            );
        }

        return internalError("Failed to analyze for GeoGebra");
    }
}
