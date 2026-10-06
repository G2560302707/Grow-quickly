import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@grow/shared/prisma"
import { z } from "zod"
import { getAppConfig } from "@grow/shared/config"
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

const userSchema = z.object({
    // 支持标准邮箱和本地邮箱（如 user@localhost）
    email: z.string().regex(/^[^\s@]+@[^\s@]+$/, "Invalid email format"),
    password: z.string().min(6),
    name: z.string().min(1),
    educationStage: z.string().optional(),
    enrollmentYear: z.number().optional(),
})

export async function POST(req: Request) {
    // 限流：注册接口按 IP 每小时最多 5 次，防批量刷号
    const limit = rateLimit(`register:${clientIp(req)}`, { limit: 5, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) {
        return tooManyRequests(limit.retryAfterSeconds, '注册过于频繁，请一小时后再试');
    }

    try {
        // 检查是否允许注册
        const config = getAppConfig();
        if (config.allowRegistration === false) {
            return NextResponse.json(
                { user: null, message: "Registration is currently disabled" },
                { status: 403 }
            );
        }

        const body = await req.json()
        const { email, password, name, educationStage, enrollmentYear } = userSchema.parse(body)

        const existingUser = await prisma.user.findUnique({
            where: { email }
        })

        if (existingUser) {
            return NextResponse.json(
                { user: null, message: "User with this email already exists" },
                { status: 409 }
            )
        }

        const hashedPassword = await hash(password, 10)
        const newUser = await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                educationStage,
                enrollmentYear
            }
        })

        const { password: newUserPassword, ...rest } = newUser

        return NextResponse.json(
            { user: rest, message: "User created successfully" },
            { status: 201 }
        )
    } catch (error) {
        return NextResponse.json(
            { user: null, message: "Something went wrong" },
            { status: 500 }
        )
    }
}
