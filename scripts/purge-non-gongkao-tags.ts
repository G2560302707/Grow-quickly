/**
 * 一次性清理：删除数据库中所有非考公（subject != gongkao）的系统标签，
 * 并幂等补齐行测考点树。用户自定义的非考公标签一并删除。
 *
 * 运行：npx ts-node --compiler-options {"module":"CommonJS"} scripts/purge-non-gongkao-tags.ts
 */
import { PrismaClient } from '@prisma/client';
import { GONGKAO_CURRICULUM, GONGKAO_SUBJECT_KEY } from '../shared/src/tag-data';

const prisma = new PrismaClient();

async function main() {
    const before = await prisma.knowledgeTag.groupBy({
        by: ['subject'],
        _count: { _all: true },
    });
    console.log('[Purge] before:', before);

    let removed = 0;
    for (let i = 0; i < 8; i++) {
        const res = await prisma.knowledgeTag.deleteMany({
            where: {
                subject: { not: GONGKAO_SUBJECT_KEY },
                children: { none: {} },
            },
        });
        removed += res.count;
        if (res.count === 0) break;
    }
    const rest = await prisma.knowledgeTag.deleteMany({
        where: { subject: { not: GONGKAO_SUBJECT_KEY } },
    });
    removed += rest.count;
    console.log(`[Purge] removed ${removed} non-gongkao tags`);

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

    const after = await prisma.knowledgeTag.groupBy({
        by: ['subject'],
        _count: { _all: true },
    });
    console.log(`[Purge] gongkao created=${created}`);
    console.log('[Purge] after:', after);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
