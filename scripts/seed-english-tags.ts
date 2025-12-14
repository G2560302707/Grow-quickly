/**
 * 英语标签导入脚本
 * 将英语课程大纲导入到 KnowledgeTag 表
 * 
 * 使用方法: npx tsx scripts/seed-english-tags.ts
 */

import { PrismaClient } from '@prisma/client';
import { ENGLISH_CURRICULUM, ENGLISH_GRADE_ORDER } from '../src/lib/tag-data/english';

const prisma = new PrismaClient();

async function main() {
    console.log('📚 开始导入英语标签...');

    // 清空现有英语系统标签
    console.log('🗑️  清空现有英语系统标签...');
    await prisma.knowledgeTag.deleteMany({
        where: { isSystem: true, subject: 'english' }
    });

    let totalCreated = 0;

    for (const [gradeSemester, chapters] of Object.entries(ENGLISH_CURRICULUM)) {
        console.log(`\n📚 处理年级: ${gradeSemester}`);

        // 创建年级节点
        const gradeNode = await prisma.knowledgeTag.create({
            data: {
                name: gradeSemester,
                subject: 'english',
                parentId: null,
                isSystem: true,
                order: ENGLISH_GRADE_ORDER[gradeSemester] || 99,
            },
        });
        totalCreated++;

        for (let chapterIdx = 0; chapterIdx < chapters.length; chapterIdx++) {
            const chapter = chapters[chapterIdx];
            console.log(`  📖 章节: ${chapter.chapter}`);

            // 创建章节节点
            const chapterNode = await prisma.knowledgeTag.create({
                data: {
                    name: chapter.chapter,
                    subject: 'english',
                    parentId: gradeNode.id,
                    isSystem: true,
                    order: chapterIdx + 1,
                },
            });
            totalCreated++;

            // 创建知识点
            for (let tagIdx = 0; tagIdx < chapter.tags.length; tagIdx++) {
                const tagName = chapter.tags[tagIdx];
                await prisma.knowledgeTag.create({
                    data: {
                        name: tagName,
                        subject: 'english',
                        parentId: chapterNode.id,
                        isSystem: true,
                        order: tagIdx + 1,
                    },
                });
                totalCreated++;
            }
        }
    }

    console.log(`\n✅ 英语标签导入完成! 共创建 ${totalCreated} 个标签`);
}

main()
    .catch((e) => {
        console.error('❌ 导入失败:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
