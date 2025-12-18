/**
 * 从数据库获取 AI 分析所需的标签
 * 替代原有的 getMathTagsByGrade 函数
 */

import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ai:tag-service');

interface TagTreeNode {
    id: string;
    name: string;
    parentId: string | null;
    children?: TagTreeNode[];
}

/**
 * 从数据库获取指定年级的数学标签
 * @param grade - 年级 (7-9:初中, 10-12:高中) 或 null
 * @returns 标签名称数组
 */
export async function getMathTagsFromDB(grade: 7 | 8 | 9 | 10 | 11 | 12 | null): Promise<string[]> {
    const gradeToSemesterMap: Record<number, string[]> = {
        7: ['七年级上', '七年级下'],
        8: ['八年级上', '八年级下'],
        9: ['九年级上', '九年级下'],
        10: ['高一上', '高一下'],
        11: ['高二上', '高二下'],
        12: ['高三上', '高三下'],
    };

    // 确定要查询的年级学期
    let semesterNames: string[] = [];

    if (!grade) {
        // 无年级信息，返回所有标签
        semesterNames = Object.values(gradeToSemesterMap).flat();
    } else if (grade >= 7 && grade <= 9) {
        // 初中累进式：当前年级及之前
        for (let g = 7; g <= grade; g++) {
            semesterNames.push(...(gradeToSemesterMap[g] || []));
        }
    } else {
        // 高中累进式：从高一开始
        for (let g = 10; g <= grade; g++) {
            semesterNames.push(...(gradeToSemesterMap[g] || []));
        }
    }

    try {
        // 获取所有顶层节点（年级学期）
        const topLevelTags = await prisma.knowledgeTag.findMany({
            where: {
                subject: 'math',
                parentId: null,
                name: { in: semesterNames },
            },
            select: { id: true },
        });

        const topLevelIds = topLevelTags.map(t => t.id);

        // 递归获取所有叶子节点标签
        const allTags = await prisma.knowledgeTag.findMany({
            where: {
                subject: 'math',
                isSystem: true,
            },
            select: {
                id: true,
                name: true,
                parentId: true,
            },
        });

        // 构建父子关系映射
        const childMap = new Map<string, string[]>();
        allTags.forEach(tag => {
            if (tag.parentId) {
                const children = childMap.get(tag.parentId) || [];
                children.push(tag.id);
                childMap.set(tag.parentId, children);
            }
        });

        // 递归收集所有后代ID
        const collectDescendants = (nodeId: string): string[] => {
            const children = childMap.get(nodeId) || [];
            if (children.length === 0) return [nodeId]; // 叶子节点
            return children.flatMap(cid => collectDescendants(cid));
        };

        // 收集所有目标年级的叶子节点
        const leafIds = new Set<string>();
        topLevelIds.forEach(id => {
            collectDescendants(id).forEach(leafId => leafIds.add(leafId));
        });

        // 获取叶子节点名称
        const tagNameMap = new Map(allTags.map(t => [t.id, t.name]));
        const result = Array.from(leafIds)
            .map(id => tagNameMap.get(id))
            .filter((name): name is string => !!name);

        return result;
    } catch (error) {
        logger.error({ error }, 'getMathTagsFromDB error');
        return [];
    }
}

/**
 * 从数据库获取指定学科的标签
 * @param subject - 学科 (math, physics, chemistry, english, etc.)
 * @returns 标签名称数组
 */
export async function getTagsFromDB(subject: string): Promise<string[]> {
    try {
        const tags = await prisma.knowledgeTag.findMany({
            where: {
                subject,
                isSystem: true,
                // 只获取叶子节点
                children: { none: {} },
            },
            select: { name: true },
            orderBy: { order: 'asc' },
        });

        return tags.map(t => t.name);
    } catch (error) {
        logger.error({ error }, 'getTagsFromDB error');
        return [];
    }
}
