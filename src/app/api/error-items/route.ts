import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { calculateGrade } from "@/lib/grade-calculator";
import { unauthorized, internalError } from "@/lib/api-errors";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    try {
        const body = await req.json();
        const {
            questionText,
            answerText,
            analysis,
            knowledgePoints, // 仍接收数组，但改为关联到 KnowledgeTag
            originalImageUrl,
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

        if (!user) {
            return unauthorized("No user found in DB");
        }

        // Calculate grade if not provided
        let finalGradeSemester = gradeSemester;
        if (!finalGradeSemester && user.educationStage && user.enrollmentYear) {
            finalGradeSemester = calculateGrade(user.educationStage, user.enrollmentYear);
        }

        // 处理知识点标签：查找或创建 KnowledgeTag
        const tagNames: string[] = Array.isArray(knowledgePoints) ? knowledgePoints : [];
        const tagConnections: { id: string }[] = [];

        // 推断学科
        const subject = await prisma.subject.findUnique({ where: { id: subjectId || '' } });
        const subjectKey = subject?.name?.toLowerCase().includes('math') || subject?.name?.includes('数学')
            ? 'math'
            : subject?.name?.toLowerCase().includes('english') || subject?.name?.includes('英语')
                ? 'english'
                : 'other';

        for (const tagName of tagNames) {
            // 查找已存在的标签
            let tag = await prisma.knowledgeTag.findFirst({
                where: {
                    name: tagName,
                    OR: [
                        { isSystem: true },
                        { userId: user.id },
                    ],
                },
            });

            // 如果不存在，创建为用户自定义标签
            if (!tag) {
                tag = await prisma.knowledgeTag.create({
                    data: {
                        name: tagName,
                        subject: subjectKey,
                        isSystem: false,
                        userId: user.id,
                    },
                });
            }

            tagConnections.push({ id: tag.id });
        }

        console.log("[API] Creating ErrorItem with tags:", tagNames);

        const errorItem = await prisma.errorItem.create({
            data: {
                userId: user.id,
                subjectId: subjectId || undefined,
                originalImageUrl,
                questionText,
                answerText,
                analysis,
                knowledgePoints: JSON.stringify(tagNames), // 保留旧字段兼容
                gradeSemester: finalGradeSemester,
                paperLevel: paperLevel,
                masteryLevel: 0,
                tags: {
                    connect: tagConnections,
                },
            },
            include: {
                tags: true,
            },
        });

        return NextResponse.json(errorItem, { status: 201 });
    } catch (error) {
        console.error("Error saving item:", error);
        return internalError("Failed to save error item");
    }
}
