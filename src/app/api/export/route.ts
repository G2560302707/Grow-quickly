import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:export');

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return unauthorized("Not authenticated");
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });

    if (!user) {
        return unauthorized("User not found");
    }

    try {
        // 导出该用户的所有数据
        const subjects = await prisma.subject.findMany({
            where: { userId: user.id },
        });

        const customTags = await prisma.knowledgeTag.findMany({
            where: { userId: user.id, isSystem: false },
        });

        const errorItems = await prisma.errorItem.findMany({
            where: { userId: user.id },
            include: {
                tags: true,
            },
        });

        const reviewSchedules = await prisma.reviewSchedule.findMany({
            where: {
                errorItem: { userId: user.id },
            },
        });

        const practiceRecords = await prisma.practiceRecord.findMany({
            where: { userId: user.id },
        });

        const exportData = {
            version: 1,
            exportedAt: new Date().toISOString(),
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                educationStage: user.educationStage,
                enrollmentYear: user.enrollmentYear,
                role: user.role,
            },
            subjects,
            customTags,
            errorItems,
            reviewSchedules,
            practiceRecords,
        };

        logger.info({
            userId: user.id,
            subjectsCount: subjects.length,
            customTagsCount: customTags.length,
            errorItemsCount: errorItems.length,
            reviewSchedulesCount: reviewSchedules.length,
            practiceRecordsCount: practiceRecords.length,
        }, 'Data export completed');

        const jsonString = JSON.stringify(exportData, null, 2);
        const filename = `wrong-notebook-export-${new Date().toISOString().slice(0, 10)}.json`;

        return new NextResponse(jsonString, {
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        logger.error({ error, userId: user.id }, 'Export failed');
        return internalError("Failed to export data");
    }
}
