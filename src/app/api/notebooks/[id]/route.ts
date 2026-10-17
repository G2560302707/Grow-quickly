import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, forbidden, notFound, badRequest, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";
import { normalizeNotebookIconKey } from "@grow/shared/subjects";
import { notebookNameError } from "@/lib/name-validation";

const logger = createLogger('api:notebooks:id');

/**
 * GET /api/notebooks/[id]
 * 获取单个错题本详情
 */
export async function GET(
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

        const notebook = await prisma.subject.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        errorItems: true,
                    },
                },
            },
        });

        if (!notebook) {
            return notFound("Notebook not found");
        }

        if (notebook.userId !== user.id) {
            return forbidden("Not authorized to access this notebook");
        }

        return NextResponse.json(notebook);
    } catch (error) {
        logger.error({ error }, 'Error fetching notebook');
        return internalError("Failed to fetch notebook");
    }
}

/**
 * PUT /api/notebooks/[id]
 * 更新错题本信息
 */
export async function PUT(
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

        const notebook = await prisma.subject.findUnique({
            where: { id },
        });

        if (!notebook) {
            return notFound("Notebook not found");
        }

        if (notebook.userId !== user.id) {
            return forbidden("Not authorized to update this notebook");
        }

        const body = await req.json();
        const { name, iconKey } = body;

        if (!name || !name.trim()) {
            return badRequest("Notebook name is required");
        }

        // 编码校验：拒绝含解码损坏标记（U+FFFD）或控制字符的名字
        const nameErr = notebookNameError(name);
        if (nameErr) {
            return badRequest(nameErr);
        }

        const updated = await prisma.subject.update({
            where: { id },
            data: {
                name: name.trim(),
                iconKey: normalizeNotebookIconKey(iconKey ?? notebook.iconKey),
            },
            include: {
                _count: {
                    select: {
                        errorItems: true,
                    },
                },
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        logger.error({ error }, 'Error updating notebook');
        return internalError("Failed to update notebook");
    }
}

/**
 * DELETE /api/notebooks/[id]
 * 删除错题本
 */
export async function DELETE(
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

        const notebook = await prisma.subject.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        errorItems: true,
                    },
                },
            },
        });

        if (!notebook) {
            return notFound("Notebook not found");
        }

        if (notebook.userId !== user.id) {
            return forbidden("Not authorized to delete this notebook");
        }

        // 默认本不可删除
        if (notebook.isDefault) {
            return badRequest("默认错题本不可删除");
        }

        // 有错题时迁入用户默认本（无则先补建），再删除本
        if (notebook._count.errorItems > 0) {
            let defaultNb = await prisma.subject.findFirst({
                where: { userId: user.id, isDefault: true },
            });
            if (!defaultNb) {
                defaultNb = await prisma.subject.create({
                    data: { name: "其他", userId: user.id, iconKey: "other", isDefault: true },
                });
            }
            await prisma.errorItem.updateMany({
                where: { subjectId: id },
                data: { subjectId: defaultNb.id },
            });
        }

        await prisma.subject.delete({
            where: { id },
        });

        return NextResponse.json({ message: "Notebook deleted successfully" });
    } catch (error) {
        logger.error({ error }, 'Error deleting notebook');
        return internalError("Failed to delete notebook");
    }
}
