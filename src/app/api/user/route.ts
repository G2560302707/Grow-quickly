import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { hash } from "bcryptjs";

const userUpdateSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional().or(z.literal("")),
    educationStage: z.string().optional(),
    enrollmentYear: z.number().optional(),
});

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: {
                name: true,
                email: true,
                educationStage: true,
                enrollmentYear: true,
                // Do not return password
            }
        });

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error("Failed to fetch user profile:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { name, email, password, educationStage, enrollmentYear } = userUpdateSchema.parse(body);

        const updateData: any = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (educationStage) updateData.educationStage = educationStage;
        if (enrollmentYear) updateData.enrollmentYear = enrollmentYear;

        if (password && password.length >= 6) {
            updateData.password = await hash(password, 10);
        }

        const updatedUser = await prisma.user.update({
            where: { email: session.user.email },
            data: updateData,
            select: {
                name: true,
                email: true,
                educationStage: true,
                enrollmentYear: true,
            }
        });

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error("Failed to update user profile:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: "Invalid input", errors: error.issues }, { status: 400 });
        }
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}
