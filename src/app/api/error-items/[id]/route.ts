import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, forbidden, notFound, internalError } from "@/lib/api-errors";

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
            return unauthorized("No user found in DB");
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
            return notFound("Item not found");
        }

        // Ensure the user owns this item
        if (errorItem.userId !== user.id) {
            return forbidden("Not authorized to access this item");
        }

        return NextResponse.json(errorItem);
    } catch (error) {
        console.error("Error fetching item:", error);
        return internalError("Failed to fetch error item");
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
            return unauthorized();
        }

        const body = await req.json();
        const { knowledgePoints, gradeSemester, paperLevel } = body;

        const errorItem = await prisma.errorItem.findUnique({
            where: { id },
        });

        if (!errorItem) {
            return notFound("Item not found");
        }

        if (errorItem.userId !== user.id) {
            return forbidden("Not authorized to update this item");
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
        return internalError("Failed to update error item");
    }
}
