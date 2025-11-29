/**
 * 数据库数据检查脚本
 * 功能：统计 ErrorItem (错题) 表的总记录数，并列出最近 3 条错题的简要信息。
 * 用途：用于快速确认数据库连接正常以及数据写入是否成功。
 */
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function checkData() {
    try {
        const count = await prisma.errorItem.count();
        console.log(`Total ErrorItems in DB: ${count}`);

        const items = await prisma.errorItem.findMany({
            take: 3,
            select: {
                id: true,
                questionText: true,
                userId: true,
                createdAt: true,
            },
        });

        console.log('\nRecent ErrorItems:');
        items.forEach(item => {
            console.log(`- ID: ${item.id}, User: ${item.userId}`);
            console.log(`  Question: ${item.questionText?.substring(0, 50)}...`);
            console.log(`  Created: ${item.createdAt}`);
        });
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

checkData();
