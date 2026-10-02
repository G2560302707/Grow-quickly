import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { buildWeaknessReport, attachChapters, type DiagnosisTagRef } from "@/lib/diagnosis";

const logger = createLogger('api:diagnosis:weakness');

export const dynamic = "force-dynamic";

/**
 * GET /api/diagnosis/weakness
 * 薄弱点诊断报告：基于用户积累的错题（时间衰减加权 + 掌握度 + 复发度）
 * 与已归因练习（P2 起接入），输出章节→知识点两级弱项排名。
 * 移动端统计页"薄弱点诊断"使用；网页端零依赖。
 */
export async function GET() {
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

        const [errorItems, allTags, practiceRecords] = await Promise.all([
            prisma.errorItem.findMany({
                where: { userId: user.id },
                select: {
                    id: true,
                    createdAt: true,
                    masteryLevel: true,
                    tags: { select: { id: true, name: true, parentId: true } },
                },
            }),
            prisma.knowledgeTag.findMany({
                where: { OR: [{ userId: user.id }, { isSystem: true }] },
                select: { id: true, name: true, parentId: true },
            }),
            prisma.practiceRecord.findMany({
                where: { userId: user.id },
                select: { tagId: true, difficulty: true, isCorrect: true, createdAt: true },
                orderBy: { createdAt: "asc" },
            }),
        ]);

        // P2 起 PracticeRecord 带 tagId 归因，练习通道随证据自动生效
        const report = buildWeaknessReport({
            errorItems,
            practiceRecords,
        });
        attachChapters(report, allTags as DiagnosisTagRef[]);

        return NextResponse.json(report);
    } catch (error) {
        logger.error({ error }, 'Error building weakness report');
        return internalError("Failed to build weakness report");
    }
}
