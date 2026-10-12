import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, badRequest, conflict, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";
import { GONGKAO_NOTEBOOKS } from "@grow/shared/subjects";
import { notebookNameError } from "@/lib/name-validation";

const logger = createLogger('api:notebooks');

/**
 * GET /api/notebooks
 * 获取用户所有错题本（Subjects）
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

        let notebooks = await prisma.subject.findMany({
            where: {
                userId: user.id,
            },
            include: {
                _count: {
                    select: {
                        errorItems: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        // If no notebooks exist, create default 考公/行测 modules
        if (notebooks.length === 0) {
            const defaultSubjects = [...GONGKAO_NOTEBOOKS];

            await Promise.all(defaultSubjects.map(name =>
                prisma.subject.create({
                    data: {
                        name,
                        userId: user!.id,
                    }
                })
            ));

            // Fetch again
            notebooks = await prisma.subject.findMany({
                where: {
                    userId: user.id,
                },
                include: {
                    _count: {
                        select: {
                            errorItems: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
        }

        return NextResponse.json(notebooks);
    } catch (error) {
        logger.error({ error }, 'Error fetching notebooks');
        return internalError("Failed to fetch notebooks");
    }
}

/**
 * POST /api/notebooks
 * 创建新错题本
 */
export async function POST(req: Request) {
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

        const body = await req.json();
        const { name } = body;

        if (!name || !name.trim()) {
            return badRequest("Notebook name is required");
        }

        // 编码校验：拒绝含解码损坏标记（U+FFFD）或控制字符的名字
        const nameErr = notebookNameError(name);
        if (nameErr) {
            return badRequest(nameErr);
        }

        // 检查是否已存在同名错题本
        const existing = await prisma.subject.findUnique({
            where: {
                name_userId: {
                    name: name.trim(),
                    userId: user.id,
                },
            },
        });

        if (existing) {
            return conflict("Notebook with this name already exists");
        }

        const notebook = await prisma.subject.create({
            data: {
                name: name.trim(),
                userId: user.id,
            },
            include: {
                _count: {
                    select: {
                        errorItems: true,
                    },
                },
            },
        });

        return NextResponse.json(notebook, { status: 201 });
    } catch (error) {
        logger.error({ error }, 'Error creating notebook');
        return internalError("Failed to create notebook");
    }
}
