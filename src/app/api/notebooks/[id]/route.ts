import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

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
            user = await prisma.user.findFirst();
        }

        if (!user) {
            // Create default user if DB is empty
            user = await prisma.user.create({
                data: {
                    email: "default@example.com",
                    password: "password",
                    name: "Default User",
                },
            });
        }

        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
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
            return NextResponse.json({ message: "Notebook not found" }, { status: 404 });
        }

        if (notebook.userId !== user.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }

        return NextResponse.json(notebook);
    } catch (error) {
        console.error("Error fetching notebook:", error);
        return NextResponse.json(
            { message: "Failed to fetch notebook" },
            { status: 500 }
        );
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
            user = await prisma.user.findFirst();
        }

        if (!user) {
            // Create default user if DB is empty
            user = await prisma.user.create({
                data: {
                    email: "default@example.com",
                    password: "password",
                    name: "Default User",
                },
            });
        }

        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const notebook = await prisma.subject.findUnique({
            where: { id },
        });

        if (!notebook) {
            return NextResponse.json({ message: "Notebook not found" }, { status: 404 });
        }

        if (notebook.userId !== user.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }

        const body = await req.json();
        const { name } = body;

        if (!name || !name.trim()) {
            return NextResponse.json(
                { message: "Notebook name is required" },
                { status: 400 }
            );
        }

        const updated = await prisma.subject.update({
            where: { id },
            data: {
                name: name.trim(),
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
        console.error("Error updating notebook:", error);
        return NextResponse.json(
            { message: "Failed to update notebook" },
            { status: 500 }
        );
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
            user = await prisma.user.findFirst();
        }

        if (!user) {
            // Create default user if DB is empty
            user = await prisma.user.create({
                data: {
                    email: "default@example.com",
                    password: "password",
                    name: "Default User",
                },
            });
        }

        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
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
            return NextResponse.json({ message: "Notebook not found" }, { status: 404 });
        }

        if (notebook.userId !== user.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }

        // 检查是否有错题
        if (notebook._count.errorItems > 0) {
            return NextResponse.json(
                { message: "Cannot delete notebook with error items. Please move or delete all items first." },
                { status: 400 }
            );
        }

        await prisma.subject.delete({
            where: { id },
        });

        return NextResponse.json({ message: "Notebook deleted successfully" });
    } catch (error) {
        console.error("Error deleting notebook:", error);
        return NextResponse.json(
            { message: "Failed to delete notebook" },
            { status: 500 }
        );
    }
}
