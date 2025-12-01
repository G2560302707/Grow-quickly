import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

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
            console.log("[API] No session or user found, attempting fallback to first user.");
            user = await prisma.user.findFirst();
        }

        if (!user) {
            return NextResponse.json({ message: "Unauthorized - No user found in DB" }, { status: 401 });
        }

        const errorItem = await prisma.errorItem.findUnique({
            where: {
                id: id,
            },
            include: {
                subject: true,
            },
        });

        if (!errorItem) {
            return NextResponse.json({ message: "Item not found" }, { status: 404 });
        }

        // Ensure the user owns this item
        if (errorItem.userId !== user.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }

        return NextResponse.json(errorItem);
    } catch (error) {
        console.error("Error fetching item:", error);
        return NextResponse.json(
            { message: "Failed to fetch error item" },
            { status: 500 }
        );
    }
}

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
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { knowledgePoints, gradeSemester, paperLevel } = body;

        const errorItem = await prisma.errorItem.findUnique({
            where: { id },
        });

        if (!errorItem) {
            return NextResponse.json({ message: "Item not found" }, { status: 404 });
        }

        if (errorItem.userId !== user.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }

        // 构建更新数据对象,只包含提供的字段
        const updateData: any = {};
        if (knowledgePoints !== undefined) updateData.knowledgePoints = knowledgePoints;
        if (gradeSemester !== undefined) updateData.gradeSemester = gradeSemester;
        if (paperLevel !== undefined) updateData.paperLevel = paperLevel;

        console.log("[API] Updating error item:", id);
        console.log("[API] Update data:", updateData);
        console.log("[API] Current knowledgePoints:", errorItem.knowledgePoints);

        const updated = await prisma.errorItem.update({
            where: { id },
            data: updateData,
        });

        console.log("[API] Updated knowledgePoints:", updated.knowledgePoints);

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Error updating item:", error);
        return NextResponse.json(
            { message: "Failed to update error item" },
            { status: 500 }
        );
    }
}
