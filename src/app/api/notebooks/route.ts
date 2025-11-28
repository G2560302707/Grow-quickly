import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

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

        // If no notebooks exist, create default ones
        if (notebooks.length === 0) {
            const defaultSubjects = ["数学", "语文", "英语", "化学", "物理"];

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
        console.error("Error fetching notebooks:", error);
        return NextResponse.json(
            { message: "Failed to fetch notebooks" },
            { status: 500 }
        );
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

        const body = await req.json();
        const { name } = body;

        if (!name || !name.trim()) {
            return NextResponse.json(
                { message: "Notebook name is required" },
                { status: 400 }
            );
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
            return NextResponse.json(
                { message: "Notebook with this name already exists" },
                { status: 409 }
            );
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
        console.error("Error creating notebook:", error);
        return NextResponse.json(
            { message: "Failed to create notebook" },
            { status: 500 }
        );
    }
}
