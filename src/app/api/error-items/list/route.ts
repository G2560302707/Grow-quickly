import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "@/lib/constants/pagination";
import { collectUserTagSubtreeIds, collectUserTagSubtreeNames } from "@/lib/user-tag-tree";

const logger = createLogger('api:error-items:list');

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get("subjectId");
    const query = searchParams.get("query");
    const mastery = searchParams.get("mastery");
    const timeRange = searchParams.get("timeRange");
    const tag = searchParams.get("tag");
    const tagId = searchParams.get("tagId");

    // 分页参数
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10)));

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

        const whereClause: Prisma.ErrorItemWhereInput = {
            userId: user.id,
        };

        if (subjectId) {
            whereClause.subjectId = subjectId;
        }

        // 搜索条件需要使用 AND 包装，避免与其他 OR 条件冲突
        // 最终的 whereClause.AND 会包含所有需要同时满足的条件
        const andConditions: Prisma.ErrorItemWhereInput[] = [];

        if (query) {
            const q = query.trim();
            // 题干 / 答案 / 解析 / 知识点 JSON / 关联考点名 任一命中
            andConditions.push({
                OR: [
                    { questionText: { contains: q } },
                    { answerText: { contains: q } },
                    { analysis: { contains: q } },
                    { wrongAnswerText: { contains: q } },
                    { mistakeAnalysis: { contains: q } },
                    { knowledgePoints: { contains: q } },
                    { tags: { some: { name: { contains: q }, userId: user.id } } },
                ],
            });
        }

        // Mastery filter
        if (mastery !== null) {
            whereClause.masteryLevel = mastery === "1" ? { gt: 0 } : 0;
        }

        // Time range filter
        if (timeRange && timeRange !== "all") {
            const now = new Date();
            const startDate = new Date();

            if (timeRange === "week") {
                startDate.setDate(now.getDate() - 7);
            } else if (timeRange === "month") {
                startDate.setMonth(now.getMonth() - 1);
            }

            whereClause.createdAt = {
                gte: startDate,
            };
        }

        // 按个人考点树节点筛选（含子树）：id 命中 或 同名标签/JSON 命中
        // （历史数据常挂到同名系统标签，仅按个人树 id 会漏掉分支下的题）
        if (tagId) {
            const [subtreeIds, subtreeNames] = await Promise.all([
                collectUserTagSubtreeIds(tagId, user.id),
                collectUserTagSubtreeNames(tagId, user.id),
            ]);
            if (subtreeIds.length === 0) {
                whereClause.id = "__IMPOSSIBLE_ID__";
            } else {
                const tagOr: Prisma.ErrorItemWhereInput[] = [
                    { tags: { some: { id: { in: subtreeIds } } } },
                ];
                if (subtreeNames.length > 0) {
                    tagOr.push({
                        tags: {
                            some: {
                                name: { in: subtreeNames },
                                OR: [{ userId: user.id }, { isSystem: true }],
                            },
                        },
                    });
                    for (const name of subtreeNames) {
                        tagOr.push({ knowledgePoints: { contains: `"${name}"` } });
                    }
                }
                andConditions.push({ OR: tagOr });
            }
        }

        // Chapter filter (第二级筛选：章节) —— 兼容旧前端
        const chapter = searchParams.get("chapter");
        if (chapter && !tagId) {
            const chapterTagIds = await findChapterDescendantTagIds(chapter, user.id);
            if (chapterTagIds.length > 0) {
                whereClause.tags = {
                    some: {
                        id: { in: chapterTagIds }
                    }
                };
            } else {
                whereClause.id = "__IMPOSSIBLE_ID__";
            }
        }

        // Tag filter by name（兼容）；有 tagId 时忽略
        if (tag && !tagId && !chapter) {
            whereClause.tags = {
                some: { name: tag, userId: user.id },
            };
        } else if (tag && chapter && !tagId) {
            whereClause.tags = {
                some: {
                    name: tag
                }
            };
        }

        // 来源大类 filter：manual(拍照/手动录入) / practice(练习答错自动收录)
        const sourceType = searchParams.get("sourceType");
        if (sourceType === "manual" || sourceType === "practice") {
            whereClause.sourceType = sourceType;
        }

        // 将所有 AND 条件合并到 whereClause
        if (andConditions.length > 0) {
            whereClause.AND = andConditions;
        }

        // 获取总数
        const total = await prisma.errorItem.count({
            where: whereClause,
        });

        // 分页查询
        // 默认瘦身返回：排除 originalImageUrl(可达 14MB 的 base64)/analysis/ocrText 等大字段，
        // 列表页不需要它们；打印预览等需要完整内容的场景传 ?full=1 取全量。
        const full = searchParams.get("full") === "1";
        const listArgs: Prisma.ErrorItemFindManyArgs = {
            where: whereClause,
            orderBy: { createdAt: "desc" },
            ...(full
                ? {
                      include: {
                          subject: true,
                          tags: true,
                      },
                  }
                : {
                      select: {
                          id: true,
                          questionText: true,
                          masteryLevel: true,
                          mistakeStatus: true,
                          origin: true,
                          sourceType: true,
                          knowledgePoints: true,
                          createdAt: true,
                          updatedAt: true,
                          subject: { select: { id: true, name: true } },
                          tags: { select: { id: true, name: true } },
                      },
                  }),
            skip: (page - 1) * pageSize,
            take: pageSize,
        };
        const errorItems = await prisma.errorItem.findMany(listArgs);

        const totalPages = Math.ceil(total / pageSize);

        return NextResponse.json({
            items: errorItems,
            total,
            page,
            pageSize,
            totalPages,
        });
    } catch (error) {
        logger.error({ error }, 'Error fetching items');
        return internalError("Failed to fetch error items");
    }
}

// 查找章节标签及其所有后代标签的 ID
async function findChapterDescendantTagIds(chapterName: string, userId: string): Promise<string[]> {
    // 1. 找到章节标签本身 (系统标签或用户自定义标签)
    const chapterTag = await prisma.knowledgeTag.findFirst({
        where: {
            name: chapterName,
            OR: [
                { isSystem: true },
                { userId: userId },
            ],
        },
        select: { id: true }
    });

    if (!chapterTag) return [];

    // 2. 递归查找所有后代标签
    const descendantIds: string[] = [chapterTag.id];
    const queue: string[] = [chapterTag.id];

    while (queue.length > 0) {
        const parentId = queue.shift()!;
        const children = await prisma.knowledgeTag.findMany({
            where: { parentId: parentId },
            select: { id: true }
        });
        for (const child of children) {
            descendantIds.push(child.id);
            queue.push(child.id);
        }
    }

    return descendantIds;
}
