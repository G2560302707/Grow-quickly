import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError, badRequest } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:import');

interface ImportData {
    version: number;
    exportedAt: string;
    user: {
        id: string;
        email: string;
        name: string | null;
        educationStage: string | null;
        enrollmentYear: number | null;
        role: string;
    };
    subjects: Array<{
        id: string;
        name: string;
        userId: string;
        createdAt: string;
        updatedAt: string;
    }>;
    customTags: Array<{
        id: string;
        name: string;
        subject: string;
        parentId: string | null;
        order: number;
        code: string | null;
        isSystem: boolean;
        userId: string;
        createdAt: string;
        updatedAt: string;
    }>;
    errorItems: Array<{
        id: string;
        userId: string;
        subjectId: string | null;
        originalImageUrl: string;
        ocrText: string | null;
        questionText: string | null;
        answerText: string | null;
        analysis: string | null;
        wrongAnswerText: string | null;
        mistakeAnalysis: string | null;
        mistakeStatus: string | null;
        knowledgePoints: string | null;
        source: string | null;
        errorType: string | null;
        userNotes: string | null;
        masteryLevel: number;
        gradeSemester: string | null;
        paperLevel: string | null;
        createdAt: string;
        updatedAt: string;
        tags: Array<{ id: string; name: string; subject: string }>;
    }>;
    reviewSchedules: Array<{
        id: string;
        errorItemId: string;
        scheduledFor: string;
        completedAt: string | null;
        isCorrect: boolean | null;
        createdAt: string;
    }>;
    practiceRecords: Array<{
        id: string;
        userId: string;
        subject: string | null;
        difficulty: string | null;
        isCorrect: boolean | null;
        createdAt: string;
    }>;
}

/** Validate and parse a date string, returning undefined if invalid */
function safeParseDate(dateStr: string | undefined | null): Date | undefined {
    if (!dateStr) return undefined;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? undefined : d;
}

/** Validate masteryLevel is an integer in range [0, 2] */
function safeMasteryLevel(val: unknown): number {
    const n = typeof val === 'number' ? val : parseInt(String(val), 10);
    if (isNaN(n) || n < 0 || n > 2) return 0;
    return n;
}

export async function POST(req: Request) {
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
        const contentLength = req.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > 50 * 1024 * 1024) {
            return badRequest("Request body too large (max 50MB)");
        }

        const body = await req.json() as ImportData;

        // 验证数据格式
        if (!body.version || !body.user || !Array.isArray(body.errorItems)) {
            return badRequest("Invalid import data format");
        }

        // 验证导出数据属于当前用户
        if (body.user.email !== user.email) {
            return badRequest("Import data does not belong to current user");
        }

        const stats = {
            subjectsCreated: 0,
            tagsCreated: 0,
            errorItemsCreated: 0,
            reviewSchedulesCreated: 0,
            practiceRecordsCreated: 0,
            tagsLinked: 0,
        };

        // 使用事务确保数据一致性
        await prisma.$transaction(async (tx) => {
            // 1. 导入 subjects
            const subjectIdMap = new Map<string, string>();
            for (const subject of (body.subjects || [])) {
                const existing = await tx.subject.findFirst({
                    where: { name: subject.name, userId: user.id },
                });
                if (existing) {
                    subjectIdMap.set(subject.id, existing.id);
                } else {
                    const created = await tx.subject.create({
                        data: {
                            name: subject.name,
                            userId: user.id,
                        },
                    });
                    subjectIdMap.set(subject.id, created.id);
                    stats.subjectsCreated++;
                }
            }

            // 2. 导入 custom tags
            const tagIdMap = new Map<string, string>();
            for (const tag of (body.customTags || [])) {
                const existing = await tx.knowledgeTag.findFirst({
                    where: {
                        name: tag.name,
                        userId: user.id,
                        isSystem: false,
                    },
                });
                if (existing) {
                    tagIdMap.set(tag.id, existing.id);
                } else {
                    let newParentId: string | undefined;
                    if (tag.parentId && tagIdMap.has(tag.parentId)) {
                        newParentId = tagIdMap.get(tag.parentId);
                    }

                    const created = await tx.knowledgeTag.create({
                        data: {
                            name: tag.name,
                            subject: tag.subject,
                            isSystem: false,
                            userId: user.id,
                            parentId: newParentId,
                            order: tag.order || 0,
                            code: tag.code,
                        },
                    });
                    tagIdMap.set(tag.id, created.id);
                    stats.tagsCreated++;
                }
            }

            // 3. 预加载所有需要的 tags（批量查询，避免 N+1）
            // 收集所有 errorItems 中引用的 tag names
            const allTagNames = new Set<string>();
            for (const item of body.errorItems) {
                if (item.tags) {
                    for (const tag of item.tags) {
                        allTagNames.add(tag.name);
                    }
                }
            }
            // 批量查询：系统 tag + 用户自定义 tag
            const preloadedTags = await tx.knowledgeTag.findMany({
                where: {
                    name: { in: Array.from(allTagNames) },
                    OR: [
                        { isSystem: true },
                        { userId: user.id },
                    ],
                },
            });
            // 建立 name -> tag 的映射（优先用户自定义 tag）
            const tagNameMap = new Map<string, string>();
            for (const tag of preloadedTags) {
                if (!tagNameMap.has(tag.name) || tag.userId === user.id) {
                    tagNameMap.set(tag.name, tag.id);
                }
            }

            // 4. 导入 error items
            const errorItemIdMap = new Map<string, string>();
            for (const item of body.errorItems) {
                const newSubjectId = item.subjectId ? subjectIdMap.get(item.subjectId) : undefined;

                const created = await tx.errorItem.create({
                    data: {
                        userId: user.id,
                        subjectId: newSubjectId || undefined,
                        originalImageUrl: item.originalImageUrl || '',
                        ocrText: item.ocrText,
                        questionText: item.questionText,
                        answerText: item.answerText,
                        analysis: item.analysis,
                        wrongAnswerText: item.wrongAnswerText,
                        mistakeAnalysis: item.mistakeAnalysis,
                        mistakeStatus: item.mistakeStatus,
                        knowledgePoints: item.knowledgePoints,
                        source: item.source,
                        errorType: item.errorType,
                        userNotes: item.userNotes,
                        masteryLevel: safeMasteryLevel(item.masteryLevel),
                        gradeSemester: item.gradeSemester,
                        paperLevel: item.paperLevel,
                        createdAt: safeParseDate(item.createdAt),
                    },
                });
                errorItemIdMap.set(item.id, created.id);
                stats.errorItemsCreated++;

                // 关联 tags（使用预加载的映射 + tagIdMap）
                if (item.tags && item.tags.length > 0) {
                    const tagConnections: { id: string }[] = [];
                    for (const tag of item.tags) {
                        // 优先使用导入数据中的 tag ID 映射
                        if (tagIdMap.has(tag.id)) {
                            tagConnections.push({ id: tagIdMap.get(tag.id)! });
                        } else if (tagNameMap.has(tag.name)) {
                            // 使用预加载的 tag 名称映射
                            tagConnections.push({ id: tagNameMap.get(tag.name)! });
                        }
                    }

                    if (tagConnections.length > 0) {
                        await tx.errorItem.update({
                            where: { id: created.id },
                            data: {
                                tags: { connect: tagConnections },
                            },
                        });
                        stats.tagsLinked += tagConnections.length;
                    }
                }
            }

            // 5. 导入 review schedules
            for (const schedule of (body.reviewSchedules || [])) {
                const newErrorItemId = errorItemIdMap.get(schedule.errorItemId);
                if (newErrorItemId) {
                    const scheduledFor = safeParseDate(schedule.scheduledFor);
                    if (scheduledFor) {
                        await tx.reviewSchedule.create({
                            data: {
                                errorItemId: newErrorItemId,
                                scheduledFor,
                                completedAt: safeParseDate(schedule.completedAt),
                                isCorrect: schedule.isCorrect,
                            },
                        });
                        stats.reviewSchedulesCreated++;
                    }
                }
            }

            // 6. 导入 practice records
            for (const record of (body.practiceRecords || [])) {
                await tx.practiceRecord.create({
                    data: {
                        userId: user.id,
                        subject: record.subject,
                        difficulty: record.difficulty,
                        isCorrect: record.isCorrect,
                        createdAt: safeParseDate(record.createdAt),
                    },
                });
                stats.practiceRecordsCreated++;
            }
        }, {
            timeout: 60000,
        });

        logger.info({
            userId: user.id,
            ...stats,
        }, 'Data import completed');

        return NextResponse.json({
            success: true,
            stats,
        });
    } catch (error) {
        logger.error({ error, userId: user.id }, 'Import failed');
        return internalError("Failed to import data");
    }
}
