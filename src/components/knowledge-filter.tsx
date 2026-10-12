"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@grow/shared/api-client";

interface TagTreeNode {
    id: string;
    name: string;
    code: string | null;
    children: TagTreeNode[];
}

export type KnowledgeFilterChange = {
    /** 个人考点树节点 id；筛选含子树 */
    tagId?: string;
    /** 兼容旧字段：叶子名 */
    tag?: string;
};

interface KnowledgeFilterProps {
    tagId?: string | null;
    onFilterChange: (filters: KnowledgeFilterChange) => void;
    className?: string;
    tag?: string | null;
    subjectName?: string;
}

export function KnowledgeFilter({
    tagId: initialTagId,
    onFilterChange,
    className,
}: KnowledgeFilterProps) {
    const [moduleId, setModuleId] = useState("");
    const [pointId, setPointId] = useState("");
    const [leafId, setLeafId] = useState(initialTagId || "");
    const [tagTree, setTagTree] = useState<TagTreeNode[]>([]);
    const [needsImport, setNeedsImport] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (initialTagId !== undefined) setLeafId(initialTagId || "");
    }, [initialTagId]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const data = await apiClient.get<{ tags: TagTreeNode[]; needsImport?: boolean }>(
                    "/api/tags?subject=gongkao",
                );
                setTagTree(data.tags || []);
                setNeedsImport(!!data.needsImport);
            } catch (e) {
                console.warn("Failed to fetch personal tag tree", e);
                setTagTree([]);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const modules = tagTree;
    const points = modules.find((m) => m.id === moduleId)?.children || [];
    const leaves = points.find((p) => p.id === pointId)?.children || [];

    const emit = (next: { moduleId?: string; pointId?: string; leafId?: string }) => {
        const m = next.moduleId !== undefined ? next.moduleId : moduleId;
        const p = next.pointId !== undefined ? next.pointId : pointId;
        const l = next.leafId !== undefined ? next.leafId : leafId;
        const activeId = l || p || m || undefined;
        let leafName: string | undefined;
        if (l) {
            leafName = leaves.find((x) => x.id === l)?.name;
        }
        onFilterChange({
            tagId: activeId,
            tag: leafName,
        });
    };

    const handleModuleChange = (val: string) => {
        const next = val === "all" ? "" : val;
        setModuleId(next);
        setPointId("");
        setLeafId("");
        emit({ moduleId: next, pointId: "", leafId: "" });
    };

    const handlePointChange = (val: string) => {
        const next = val === "all" ? "" : val;
        setPointId(next);
        setLeafId("");
        emit({ pointId: next, leafId: "" });
    };

    const handleLeafChange = (val: string) => {
        const next = val === "all" ? "" : val;
        setLeafId(next);
        emit({ leafId: next });
    };

    if (!loading && needsImport) {
        return (
            <div className={`text-sm text-muted-foreground ${className || ""}`}>
                尚未导入考点树，请先到{" "}
                <Link href="/tags" className="text-primary underline">
                    考点管理
                </Link>{" "}
                一键导入官方模板。
            </div>
        );
    }

    return (
        <div className={`flex flex-wrap gap-2 ${className || ""}`}>
            <Select value={moduleId || "all"} onValueChange={handleModuleChange} disabled={loading}>
                <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="模块" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">全部模块</SelectItem>
                    {modules.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                            {m.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select
                value={pointId || "all"}
                onValueChange={handlePointChange}
                disabled={!moduleId}
            >
                <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="一级考点" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">全部考点</SelectItem>
                    {points.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                            {p.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select
                value={leafId || "all"}
                onValueChange={handleLeafChange}
                disabled={!pointId || leaves.length === 0}
            >
                <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="二级考点" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">全部细分</SelectItem>
                    {leaves.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                            {t.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
