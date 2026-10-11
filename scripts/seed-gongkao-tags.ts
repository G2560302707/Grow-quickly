/**
 * 行测（gongkao）系统标签 seed —— 幂等、只增不改：
 * 按 shared/src/tag-data/gongkao.ts 的树逐级"缺了才建"，不删除、不重命名，
 * 因此可重复运行，也适用于 Docker entrypoint 的版本升级场景。
 * 运行：npx ts-node --compiler-options {"module":"CommonJS"} scripts/seed-gongkao-tags.ts
 */
import { PrismaClient } from '@prisma/client';
import { GONGKAO_CURRICULUM, GONGKAO_SUBJECT_KEY } from '../shared/src/tag-data';

const prisma = new PrismaClient();

async function findOrCreate(name: string, parentId: string | null, order: number): Promise<{ id: string; created: boolean }> {
    const existing = await prisma.knowledgeTag.findFirst({
        where: { subject: GONGKAO_SUBJECT_KEY, name, parentId, isSystem: true },
        select: { id: true },
    });
    if (existing) return { id: existing.id, created: false };
    const created = await prisma.knowledgeTag.create({
        data: { name, subject: GONGKAO_SUBJECT_KEY, parentId, isSystem: true, order },
        select: { id: true },
    });
    return { id: created.id, created: true };
}

async function main() {
    let created = 0;
    for (let m = 0; m < GONGKAO_CURRICULUM.length; m++) {
        const mod = GONGKAO_CURRICULUM[m];
        const modNode = await findOrCreate(mod.module, null, m + 1);
        if (modNode.created) created++;

        for (let p = 0; p < mod.points.length; p++) {
            const point = mod.points[p];
            const pointNode = await findOrCreate(point.point, modNode.id, p + 1);
            if (pointNode.created) created++;
            for (let c = 0; c < (point.children?.length || 0); c++) {
                const childNode = await findOrCreate(point.children![c], pointNode.id, c + 1);
                if (childNode.created) created++;
            }
        }
        console.log(`[SeedGongkao] module "${mod.module}" synced`);
    }
    console.log(`[SeedGongkao] done, created ${created} new tags`);
}

main()
    .catch((e) => {
        console.error('[SeedGongkao] Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
