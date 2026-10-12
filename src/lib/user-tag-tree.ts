/**
 * 学习端个人考点树：导入官方模板、建树、子树收集。
 * 全局 isSystem 树留给题库；学习者只读写 userId = 本人 的节点。
 */
import { prisma } from "@grow/shared/prisma";
import { GONGKAO_CURRICULUM, GONGKAO_SUBJECT_KEY } from "@grow/shared/tag-data";

export const USER_TAG_SUBJECT = GONGKAO_SUBJECT_KEY;
const MAX_DEPTH = 4;

export interface TagTreeNode {
    id: string;
    name: string;
    code: string | null;
    parentId: string | null;
    order: number;
    source: string | null;
    children: TagTreeNode[];
}

export function buildTagTree(
    tags: Array<{
        id: string;
        name: string;
        code: string | null;
        parentId: string | null;
        order: number;
    }>,
): TagTreeNode[] {
    const tagMap = new Map<string, TagTreeNode>();
    const roots: TagTreeNode[] = [];

    for (const tag of tags) {
        tagMap.set(tag.id, {
            id: tag.id,
            name: tag.name,
            code: tag.code,
            parentId: tag.parentId,
            order: tag.order,
            source: tag.code === "template" ? "template" : "user",
            children: [],
        });
    }

    for (const tag of tags) {
        const node = tagMap.get(tag.id)!;
        if (tag.parentId && tagMap.has(tag.parentId)) {
            tagMap.get(tag.parentId)!.children.push(node);
        } else {
            roots.push(node);
        }
    }

    const sortRec = (nodes: TagTreeNode[]) => {
        nodes.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "zh"));
        for (const n of nodes) sortRec(n.children);
    };
    sortRec(roots);
    return roots;
}

/** 收集某节点及其全部子孙 id（含自身） */
export async function collectUserTagSubtreeIds(rootTagId: string, userId: string): Promise<string[]> {
    const all = await prisma.knowledgeTag.findMany({
        where: { userId, subject: USER_TAG_SUBJECT, isSystem: false },
        select: { id: true, parentId: true },
    });
    const childrenMap = new Map<string, string[]>();
    for (const t of all) {
        if (!t.parentId) continue;
        const list = childrenMap.get(t.parentId) || [];
        list.push(t.id);
        childrenMap.set(t.parentId, list);
    }
    const result: string[] = [];
    const stack = [rootTagId];
    while (stack.length) {
        const id = stack.pop()!;
        result.push(id);
        const kids = childrenMap.get(id);
        if (kids) stack.push(...kids);
    }
    return result;
}

/** 子树内全部考点名（去重），用于按名匹配历史挂错 id 的错题 */
export async function collectUserTagSubtreeNames(rootTagId: string, userId: string): Promise<string[]> {
    const ids = await collectUserTagSubtreeIds(rootTagId, userId);
    if (ids.length === 0) return [];
    const rows = await prisma.knowledgeTag.findMany({
        where: { id: { in: ids }, userId, isSystem: false },
        select: { name: true },
    });
    return [...new Set(rows.map((r) => r.name).filter(Boolean))];
}

/**
 * 错题打标解析：优先挂到个人考点树节点（有父级的叶子/节点），
 * 避免 findFirst 误挂到同名系统标签或孤立根节点，导致按模块筛子树时漏题。
 */
export async function resolveTagIdForErrorItem(
    userId: string,
    tagName: string,
    subjectKey: string = USER_TAG_SUBJECT,
): Promise<string> {
    const personal = await prisma.knowledgeTag.findMany({
        where: {
            name: tagName,
            userId,
            isSystem: false,
            subject: USER_TAG_SUBJECT,
        },
        select: { id: true, parentId: true },
    });
    const underTree = personal.find((t) => t.parentId != null) || personal[0];
    if (underTree) return underTree.id;

    const systemOrOther = await prisma.knowledgeTag.findFirst({
        where: {
            name: tagName,
            OR: [{ isSystem: true }, { userId }],
        },
        select: { id: true },
    });
    if (systemOrOther) return systemOrOther.id;

    const created = await prisma.knowledgeTag.create({
        data: {
            name: tagName,
            subject: subjectKey || USER_TAG_SUBJECT,
            isSystem: false,
            userId,
            parentId: null,
        },
        select: { id: true },
    });
    return created.id;
}

export async function countUserTags(userId: string): Promise<number> {
    return prisma.knowledgeTag.count({
        where: { userId, subject: USER_TAG_SUBJECT, isSystem: false },
    });
}

export async function listUserTags(userId: string) {
    return prisma.knowledgeTag.findMany({
        where: { userId, subject: USER_TAG_SUBJECT, isSystem: false },
        orderBy: [{ order: "asc" }, { name: "asc" }],
    });
}

/** 可选打标节点：叶子，或无子节点的任意节点 */
export function selectableTagNames(
    tags: Array<{ id: string; name: string; parentId: string | null }>,
): Array<{ id: string; name: string }> {
    const parentIds = new Set(tags.map((t) => t.parentId).filter(Boolean) as string[]);
    return tags.filter((t) => !parentIds.has(t.id)).map((t) => ({ id: t.id, name: t.name }));
}

async function findOrCreateUserTag(
    userId: string,
    name: string,
    parentId: string | null,
    order: number,
): Promise<{ id: string; created: boolean }> {
    const existing = await prisma.knowledgeTag.findFirst({
        where: {
            userId,
            subject: USER_TAG_SUBJECT,
            isSystem: false,
            name,
            parentId,
        },
        select: { id: true },
    });
    if (existing) return { id: existing.id, created: false };
    const created = await prisma.knowledgeTag.create({
        data: {
            name,
            subject: USER_TAG_SUBJECT,
            parentId,
            isSystem: false,
            userId,
            order,
            code: "template",
        },
        select: { id: true },
    });
    return { id: created.id, created: true };
}

/**
 * 从官方行测模板导入到用户个人树。
 * merge: 缺了才建；replace: 先删个人树再导入。
 */
export async function importTemplateForUser(
    userId: string,
    mode: "merge" | "replace",
): Promise<{ created: number; removed: number }> {
    let removed = 0;
    if (mode === "replace") {
        // 自底向上删除个人树
        for (let i = 0; i < 8; i++) {
            const res = await prisma.knowledgeTag.deleteMany({
                where: {
                    userId,
                    subject: USER_TAG_SUBJECT,
                    isSystem: false,
                    children: { none: {} },
                },
            });
            removed += res.count;
            if (res.count === 0) break;
        }
        const rest = await prisma.knowledgeTag.deleteMany({
            where: { userId, subject: USER_TAG_SUBJECT, isSystem: false },
        });
        removed += rest.count;
    }

    let created = 0;
    for (let m = 0; m < GONGKAO_CURRICULUM.length; m++) {
        const mod = GONGKAO_CURRICULUM[m];
        const modNode = await findOrCreateUserTag(userId, mod.module, null, m + 1);
        if (modNode.created) created++;

        for (let p = 0; p < mod.points.length; p++) {
            const point = mod.points[p];
            const pointNode = await findOrCreateUserTag(userId, point.point, modNode.id, p + 1);
            if (pointNode.created) created++;
            for (let c = 0; c < (point.children?.length || 0); c++) {
                const leaf = await findOrCreateUserTag(userId, point.children![c], pointNode.id, c + 1);
                if (leaf.created) created++;
            }
        }
    }
    return { created, removed };
}

export async function assertOwnedTag(userId: string, tagId: string) {
    return prisma.knowledgeTag.findFirst({
        where: { id: tagId, userId, subject: USER_TAG_SUBJECT, isSystem: false },
    });
}

export async function getNodeDepth(tagId: string | null): Promise<number> {
    let depth = 0;
    let currentId = tagId;
    while (currentId) {
        depth++;
        if (depth > MAX_DEPTH + 2) break;
        const node = await prisma.knowledgeTag.findUnique({
            where: { id: currentId },
            select: { parentId: true },
        });
        currentId = node?.parentId ?? null;
    }
    return depth;
}

export { MAX_DEPTH };
