import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError, forbidden } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:export');

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const exportAll = searchParams.get('all') === 'true';

    // 只有管理员可以导出全部数据
    if (exportAll && (session.user as any).role !== 'admin') {
        return forbidden("Admin role required");
    }

    try {
        const userFilter = exportAll ? {} : { userId: user.id };

        const subjects = await prisma.subject.findMany({
            where: userFilter,
        });

        const customTags = await prisma.knowledgeTag.findMany({
            where: {
                ...userFilter,
                isSystem: false,
            },
        });

        const errorItems = await prisma.errorItem.findMany({
            where: userFilter,
            include: {
                tags: true,
            },
        });

        const reviewSchedules = await prisma.reviewSchedule.findMany({
            where: exportAll
                ? { errorItem: { userId: { not: undefined } } }
                : { errorItem: { userId: user.id } },
        });

        const practiceRecords = await prisma.practiceRecord.findMany({
            where: userFilter,
        });

        const exportData = {
            version: 1,
            exportedAt: new Date().toISOString(),
            scope: exportAll ? 'all' : 'user',
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
            scope: exportAll ? 'all' : 'user',
            subjectsCount: subjects.length,
            customTagsCount: customTags.length,
            errorItemsCount: errorItems.length,
            reviewSchedulesCount: reviewSchedules.length,
            practiceRecordsCount: practiceRecords.length,
        }, 'Data export completed');

        const jsonString = JSON.stringify(exportData, null, 2);
        const filename = exportAll
            ? `wrong-notebook-export-all-${new Date().toISOString().slice(0, 10)}.json`
            : `wrong-notebook-export-${new Date().toISOString().slice(0, 10)}.json`;

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
