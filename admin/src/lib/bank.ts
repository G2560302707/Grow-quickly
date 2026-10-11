/**
 * 题库管理共享辅助：行测（gongkao）系统标签索引的加载与名称解析。
 * 供导入解析、标签下拉、覆盖度统计三个接口共用。
 */
import { prisma } from "@grow/shared/prisma";

export interface GongkaoLeaf {
    id: string;
    name: string;
    /** 所属一级考点名（叶子自身为一级考点时与 name 相同） */
    pointName: string;
    /** 所属模块名 */
    moduleName: string;
}

/** 拉取 gongkao 全部系统标签并构建叶子清单（供 AI 分类标签池与编辑下拉） */
export async function loadGongkaoLeaves(): Promise<GongkaoLeaf[]> {
    const tags = await prisma.knowledgeTag.findMany({
        where: { subject: "gongkao", isSystem: true },
        select: { id: true, name: true, parentId: true },
        orderBy: { order: "asc" },
    });
    const byId = new Map(tags.map(t => [t.id, t]));
    const leaves: GongkaoLeaf[] = [];
    for (const t of tags) {
        const children = tags.filter(x => x.parentId === t.id);
        if (children.length > 0) continue; // 非叶子
        const parent = t.parentId ? byId.get(t.parentId) : null;
        const grand = parent?.parentId ? byId.get(parent.parentId) : null;
        leaves.push({
            id: t.id,
            name: t.name,
            pointName: parent?.name ?? t.name,
            moduleName: grand?.name ?? parent?.name ?? t.name,
        });
    }
    return leaves;
}

/** AI 输出的标签名 → 系统标签 id（在 gongkao 全部标签中按名精确匹配） */
export async function resolveGongkaoTagIds(names: string[]): Promise<Map<string, string>> {
    const unique = Array.from(new Set(names.map(n => n.trim()).filter(Boolean)));
    const out = new Map<string, string>();
    for (const name of unique) {
        const tag = await prisma.knowledgeTag.findFirst({
            where: { subject: "gongkao", name, isSystem: true },
            select: { id: true },
        });
        if (tag) out.set(name, tag.id);
    }
    return out;
}

/** 简单内存限流（管理端 AI 解析专用，防手滑连点打爆上游） */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function adminRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
    }
    bucket.count += 1;
    if (bucket.count > limit) {
        return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
    }
    return { allowed: true, retryAfterSeconds: 0 };
}
