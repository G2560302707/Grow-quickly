import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { internalError, unauthorized, forbidden } from "@grow/shared/api-errors";
import { GONGKAO_CURRICULUM, GONGKAO_SUBJECT_KEY } from "@grow/shared/tag-data";
import { createLogger } from "@grow/shared/logger";

const logger = createLogger('api:admin:migrate-tags');

/**
 * 管理端「标签迁移」：删除非考公系统标签，并幂等补齐行测考点树。
 */
export async function POST() {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return unauthorized();
    }

    if ((session.user as any).role !== 'admin') {
        return forbidden("Admin access required for tag migration");
    }

    try {
        logger.info({ email: session.user.email }, 'Tag migration initiated (gongkao-only)');

        let removed = 0;
        for (let i = 0; i < 8; i++) {
            const res = await prisma.knowledgeTag.deleteMany({
                where: {
                    isSystem: true,
                    subject: { not: GONGKAO_SUBJECT_KEY },
                    children: { none: {} },
                },
            });
            removed += res.count;
            if (res.count === 0) break;
        }
        const rest = await prisma.knowledgeTag.deleteMany({
            where: { isSystem: true, subject: { not: GONGKAO_SUBJECT_KEY } },
        });
        removed += rest.count;

        let created = 0;
        for (let m = 0; m < GONGKAO_CURRICULUM.length; m++) {
            const mod = GONGKAO_CURRICULUM[m];
            let modNode = await prisma.knowledgeTag.findFirst({
                where: {
                    subject: GONGKAO_SUBJECT_KEY,
                    name: mod.module,
                    parentId: null,
                    isSystem: true,
                },
                select: { id: true },
            });
            if (!modNode) {
                modNode = await prisma.knowledgeTag.create({
                    data: {
                        name: mod.module,
                        subject: GONGKAO_SUBJECT_KEY,
                        parentId: null,
                        isSystem: true,
                        order: m + 1,
                    },
                    select: { id: true },
                });
                created++;
            }

            for (let p = 0; p < mod.points.length; p++) {
                const point = mod.points[p];
                let pointNode = await prisma.knowledgeTag.findFirst({
                    where: {
                        subject: GONGKAO_SUBJECT_KEY,
                        name: point.point,
                        parentId: modNode.id,
                        isSystem: true,
                    },
                    select: { id: true },
                });
                if (!pointNode) {
                    pointNode = await prisma.knowledgeTag.create({
                        data: {
                            name: point.point,
                            subject: GONGKAO_SUBJECT_KEY,
                            parentId: modNode.id,
                            isSystem: true,
                            order: p + 1,
                        },
                        select: { id: true },
                    });
                    created++;
                }
                for (let c = 0; c < (point.children?.length || 0); c++) {
                    const leaf = point.children![c];
                    const exists = await prisma.knowledgeTag.findFirst({
                        where: {
                            subject: GONGKAO_SUBJECT_KEY,
                            name: leaf,
                            parentId: pointNode.id,
                            isSystem: true,
                        },
                        select: { id: true },
                    });
                    if (!exists) {
                        await prisma.knowledgeTag.create({
                            data: {
                                name: leaf,
                                subject: GONGKAO_SUBJECT_KEY,
                                parentId: pointNode.id,
                                isSystem: true,
                                order: c + 1,
                            },
                        });
                        created++;
                    }
                }
            }
        }

        const gongkaoCount = await prisma.knowledgeTag.count({
            where: { subject: GONGKAO_SUBJECT_KEY, isSystem: true },
        });

        logger.info({ removed, created, gongkaoCount }, 'Tag migration completed');
        return NextResponse.json({
            success: true,
            removed,
            created,
            gongkaoCount,
            message: `已清理非考公系统标签 ${removed} 个，新建考公标签 ${created} 个，当前考公系统标签共 ${gongkaoCount} 个`,
        });
    } catch (error) {
        logger.error({ error }, 'Tag migration error');
        return internalError("Failed to migrate tags");
    }
}
