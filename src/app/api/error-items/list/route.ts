import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@/lib/api-errors";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get("subjectId");
    const query = searchParams.get("query");
    const mastery = searchParams.get("mastery");
    const timeRange = searchParams.get("timeRange");
    const tag = searchParams.get("tag");

    try {
        let user;
        if (session?.user?.email) {
            user = await prisma.user.findUnique({
                where: { email: session.user.email },
            });
        }

        if (!user) {
            console.log("[API] No session or user found, attempting fallback to first user.");
            user = await prisma.user.findFirst();
        }

        if (!user) {
            return unauthorized("No user found in DB");
        }

        const whereClause: any = {
            userId: user.id,
        };

        if (subjectId) {
            whereClause.subjectId = subjectId;
        }

        if (query) {
            whereClause.OR = [
                { questionText: { contains: query } },
                { analysis: { contains: query } },
                { knowledgePoints: { contains: query } },
            ];
        }

        // Mastery filter
        if (mastery !== null) {
            whereClause.masteryLevel = mastery === "1" ? { gt: 0 } : 0;
        }

        // Time range filter
        if (timeRange && timeRange !== "all") {
            const now = new Date();
            let startDate = new Date();

            if (timeRange === "week") {
                startDate.setDate(now.getDate() - 7);
            } else if (timeRange === "month") {
                startDate.setMonth(now.getMonth() - 1);
            }

            whereClause.createdAt = {
                gte: startDate,
            };
        }

        // Tag filter
        if (tag) {
            whereClause.knowledgePoints = {
                contains: tag,
            };
        }

        // Grade/Semester filter
        const gradeSemester = searchParams.get("gradeSemester");
        if (gradeSemester) {
            const gradeFilter = buildGradeFilter(gradeSemester);
            if (gradeFilter) {
                // Merge into main whereClause
                Object.assign(whereClause, gradeFilter);
            }
        }

        // Paper Level filter
        const paperLevel = searchParams.get("paperLevel");
        if (paperLevel && paperLevel !== "all") {
            whereClause.paperLevel = paperLevel;
        }

        const errorItems = await prisma.errorItem.findMany({
            where: whereClause,
            orderBy: { createdAt: "desc" },
            include: {
                subject: true,
                tags: true,
            },
        });

        return NextResponse.json(errorItems);
    } catch (error) {
        console.error("Error fetching items:", error);
        return internalError("Failed to fetch error items");
    }
}

function buildGradeFilter(gradeSemester: string) {
    // Map standard names to possible DB variations
    const gradeMap: Record<string, string[]> = {
        "七年级": ["七年级", "初一", "7年级", "七"],
        "八年级": ["八年级", "初二", "8年级", "八"],
        "九年级": ["九年级", "初三", "9年级", "九"],
    };

    let targetGrade = "";
    let targetSemester = "";

    if (gradeSemester.includes("七年级")) targetGrade = "七年级";
    else if (gradeSemester.includes("八年级")) targetGrade = "八年级";
    else if (gradeSemester.includes("九年级")) targetGrade = "九年级";

    if (gradeSemester.includes("上")) targetSemester = "上";
    else if (gradeSemester.includes("下")) targetSemester = "下";

    if (targetGrade && targetSemester) {
        const aliases = gradeMap[targetGrade];
        return {
            AND: [
                {
                    OR: aliases.map(alias => ({
                        gradeSemester: { contains: alias }
                    }))
                },
                {
                    gradeSemester: { contains: targetSemester }
                }
            ]
        };
    }

    return {
        gradeSemester: { contains: gradeSemester }
    };
}
