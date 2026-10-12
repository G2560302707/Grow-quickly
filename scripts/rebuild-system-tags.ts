/**
 * 系统标签维护：删除非考公系统标签，并确保行测考点树存在。
 * Docker entrypoint 版本升级时会调用；本地也可手动运行。
 */
import { PrismaClient } from '@prisma/client';
import { GONGKAO_CURRICULUM, GONGKAO_SUBJECT_KEY } from '../shared/src/tag-data';

const prisma = new PrismaClient();

async function purgeNonGongkaoSystemTags() {
    // 自底向上删，避免层级外键卡住
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
    // 兜底：仍残留的非考公系统标签（含孤儿节点）
    const rest = await prisma.knowledgeTag.deleteMany({
        where: { isSystem: true, subject: { not: GONGKAO_SUBJECT_KEY } },
    });
    removed += rest.count;
    return removed;
}

async function findOrCreate(
    name: string,
    parentId: string | null,
    order: number,
): Promise<{ created: boolean }> {
    const existing = await prisma.knowledgeTag.findFirst({
        where: { subject: GONGKAO_SUBJECT_KEY, name, parentId, isSystem: true },
        select: { id: true },
    });
    if (existing) return { created: false };
    await prisma.knowledgeTag.create({
        data: { name, subject: GONGKAO_SUBJECT_KEY, parentId, isSystem: true, order },
    });
    return { created: true };
}

async function seedGongkao() {
    let created = 0;
    for (let m = 0; m < GONGKAO_CURRICULUM.length; m++) {
        const mod = GONGKAO_CURRICULUM[m];
        const modNode = await prisma.knowledgeTag.findFirst({
            where: { subject: GONGKAO_SUBJECT_KEY, name: mod.module, parentId: null, isSystem: true },
            select: { id: true },
        });
        let modId = modNode?.id;
        if (!modId) {
            const createdMod = await prisma.knowledgeTag.create({
                data: {
                    name: mod.module,
                    subject: GONGKAO_SUBJECT_KEY,
                    parentId: null,
                    isSystem: true,
                    order: m + 1,
                },
                select: { id: true },
            });
            modId = createdMod.id;
            created++;
        }

        for (let p = 0; p < mod.points.length; p++) {
            const point = mod.points[p];
            const pointRes = await findOrCreate(point.point, modId, p + 1);
            if (pointRes.created) created++;
            const pointNode = await prisma.knowledgeTag.findFirst({
                where: {
                    subject: GONGKAO_SUBJECT_KEY,
                    name: point.point,
                    parentId: modId,
                    isSystem: true,
                },
                select: { id: true },
            });
            if (!pointNode) continue;
            for (let c = 0; c < (point.children?.length || 0); c++) {
                const childRes = await findOrCreate(point.children![c], pointNode.id, c + 1);
                if (childRes.created) created++;
            }
        }
    }
    return created;
}

async function main() {
    console.log('[RebuildTags] Purging non-gongkao system tags...');
    const removed = await purgeNonGongkaoSystemTags();
    console.log(`[RebuildTags] Removed ${removed} non-gongkao system tags`);

    console.log('[RebuildTags] Ensuring gongkao tag tree...');
    const created = await seedGongkao();
    console.log(`[RebuildTags] Gongkao tags created: ${created}`);

    const gongkaoCount = await prisma.knowledgeTag.count({
        where: { subject: GONGKAO_SUBJECT_KEY, isSystem: true },
    });
    console.log(`[RebuildTags] Done. Gongkao system tags: ${gongkaoCount}`);
}

main()
    .catch((e) => {
        console.error('[RebuildTags] Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
