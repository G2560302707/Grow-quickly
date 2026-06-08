import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { unauthorized } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { getAIService } from "@/lib/ai";

const logger = createLogger('api:geogebra-analyze');

/**
 * General-purpose GeoGebra analysis endpoint.
 * Used by the correction editor where the error item hasn't been saved yet.
 * Does NOT require an item ID.
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    try {
        if (!session?.user?.email) {
            return unauthorized("Authentication required");
        }

        const body = await req.json();
        const { questionText, answerText, analysis } = body;

        if (!questionText?.trim()) {
            return NextResponse.json(
                { suitable: false, commands: [], description: "题目文本为空" },
                { status: 400 }
            );
        }

        const aiService = getAIService();
        const result = await aiService.analyzeForGeogebra(
            questionText,
            answerText || "",
            analysis || ""
        );

        logger.info({ suitable: result.suitable, commandCount: result.commands.length }, 'GeoGebra analysis complete');

        return NextResponse.json(result);
    } catch (error) {
        logger.error({ error }, 'Error during GeoGebra analysis');

        const errorMsg = error instanceof Error ? error.message : String(error);

        if (errorMsg.startsWith("AI_")) {
            return NextResponse.json(
                { message: errorMsg },
                { status: 502 }
            );
        }

        return NextResponse.json(
            { message: "Failed to analyze for GeoGebra" },
            { status: 500 }
        );
    }
}
