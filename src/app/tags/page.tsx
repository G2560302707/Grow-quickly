"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
    TrendingUp,
    Plus,
    Trash2,
    ChevronDown,
    ChevronRight,
    House,
    Loader2,
    Pencil,
    Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@grow/shared/api-client";
import { alertDialog, confirmDialog } from "@/components/ui/app-dialog";

interface TagTreeNode {
    id: string;
    name: string;
    code: string | null;
    parentId: string | null;
    order: number;
    source?: string | null;
    children: TagTreeNode[];
}

interface TagStat {
    tag: string;
    tagId?: string;
    count: number;
}

export default function TagsPage() {
    const [tree, setTree] = useState<TagTreeNode[]>([]);
    const [needsImport, setNeedsImport] = useState(false);
    const [stats, setStats] = useState<TagStat[]>([]);
    const [untagged, setUntagged] = useState(0);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [addingUnder, setAddingUnder] = useState<string | "root" | null>(null);
    const [newName, setNewName] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const fetchTree = useCallback(async () => {
        try {
            const data = await apiClient.get<{ tags: TagTreeNode[]; needsImport: boolean }>(
                "/api/tags?subject=gongkao",
            );
            setTree(data.tags || []);
            setNeedsImport(!!data.needsImport);
            // 默认展开根
            const next: Record<string, boolean> = {};
            for (const root of data.tags || []) next[root.id] = true;
            setExpanded((prev) => ({ ...next, ...prev }));
        } catch (e) {
            console.error(e);
        }
    }, []);

    const fetchStats = useCallback(async () => {
        try {
            const data = await apiClient.get<{
                stats: TagStat[];
                untagged?: number;
            }>("/api/tags/stats");
            setStats(data.stats || []);
            setUntagged(data.untagged || 0);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTree();
        fetchStats();
    }, [fetchTree, fetchStats]);

    const handleImport = async (mode: "merge" | "replace") => {
        if (mode === "replace") {
            if (
                !(await confirmDialog({
                    description: "将清空你当前的个人考点树并重新导入官方行测树，确定？",
                    danger: true,
                }))
            ) {
                return;
            }
        }
        setImporting(true);
        try {
            const res = await apiClient.post<{ message?: string; tags?: TagTreeNode[] }>(
                "/api/tags/import-template",
                { mode },
            );
            if (res.tags) setTree(res.tags);
            else await fetchTree();
            setNeedsImport(false);
            await alertDialog({ description: res.message || "导入完成" });
            await fetchStats();
        } catch {
            await alertDialog({ description: "导入失败" });
        } finally {
            setImporting(false);
        }
    };

    const handleAdd = async (parentId: string | null) => {
        if (!newName.trim()) {
            await alertDialog({ description: "请输入名称" });
            return;
        }
        setSubmitting(true);
        try {
            await apiClient.post("/api/tags", {
                name: newName.trim(),
                parentId: parentId || undefined,
            });
            setNewName("");
            setAddingUnder(null);
            await fetchTree();
        } catch (e: any) {
            await alertDialog({
                description: e?.data?.error || e?.message || "添加失败",
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleRename = async (id: string) => {
        if (!editName.trim()) return;
        setSubmitting(true);
        try {
            await apiClient.patch(`/api/tags/${id}`, { name: editName.trim() });
            setEditingId(null);
            await fetchTree();
            await fetchStats();
        } catch (e: any) {
            await alertDialog({ description: e?.data?.error || "重命名失败" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (node: TagTreeNode) => {
        if (
            !(await confirmDialog({
                description: `删除「${node.name}」及其子节点？相关错题将解除该考点关联。`,
                danger: true,
            }))
        ) {
            return;
        }
        try {
            await apiClient.delete(`/api/tags?id=${node.id}`);
            await fetchTree();
            await fetchStats();
        } catch {
            await alertDialog({ description: "删除失败" });
        }
    };

    const renderNode = (node: TagTreeNode, depth = 0): React.ReactNode => {
        const hasChildren = node.children.length > 0;
        const isOpen = !!expanded[node.id];
        const isEditing = editingId === node.id;
        const isAdding = addingUnder === node.id;
        const stat = stats.find((s) => s.tagId === node.id || s.tag === node.name);

        return (
            <div key={node.id} className="select-none">
                <div
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60 group"
                    style={{ paddingLeft: 8 + depth * 16 }}
                >
                    <button
                        type="button"
                        className="w-5 h-5 flex items-center justify-center text-muted-foreground"
                        onClick={() =>
                            hasChildren &&
                            setExpanded((p) => ({ ...p, [node.id]: !p[node.id] }))
                        }
                    >
                        {hasChildren ? (
                            isOpen ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )
                        ) : (
                            <span className="w-4" />
                        )}
                    </button>

                    {isEditing ? (
                        <form
                            className="flex flex-1 items-center gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleRename(node.id);
                            }}
                        >
                            <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="h-8"
                                autoFocus
                            />
                            <Button type="submit" size="sm" disabled={submitting}>
                                保存
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                            >
                                取消
                            </Button>
                        </form>
                    ) : (
                        <>
                            <span className="font-medium text-sm flex-1 truncate">{node.name}</span>
                            {stat ? (
                                <span className="text-xs text-muted-foreground">
                                    {stat.count} 题
                                </span>
                            ) : null}
                            <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 flex gap-1">
                                <button
                                    type="button"
                                    title="添加子节点"
                                    onClick={() => {
                                        setAddingUnder(node.id);
                                        setNewName("");
                                        setExpanded((p) => ({ ...p, [node.id]: true }));
                                    }}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    type="button"
                                    title="重命名"
                                    onClick={() => {
                                        setEditingId(node.id);
                                        setEditName(node.name);
                                    }}
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    type="button"
                                    title="删除"
                                    className="text-destructive"
                                    onClick={() => handleDelete(node)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </span>
                        </>
                    )}
                </div>

                {isAdding && (
                    <div
                        className="flex items-center gap-2 py-1"
                        style={{ paddingLeft: 28 + depth * 16 }}
                    >
                        <Input
                            placeholder="子考点名称"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="h-8"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleAdd(node.id);
                                if (e.key === "Escape") setAddingUnder(null);
                            }}
                        />
                        <Button
                            size="sm"
                            disabled={submitting}
                            onClick={() => handleAdd(node.id)}
                        >
                            添加
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setAddingUnder(null)}>
                            取消
                        </Button>
                    </div>
                )}

                {hasChildren && isOpen && (
                    <div>{node.children.map((c) => renderNode(c, depth + 1))}</div>
                )}
            </div>
        );
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="flex items-center gap-4 mb-6">
                <BackButton fallbackUrl="/" />
                <div className="flex-1">
                    <h1 className="text-3xl font-bold">考点树</h1>
                    <p className="text-muted-foreground mt-1">
                        管理你的行测考点；官方树可一键导入，之后可自由增删改
                    </p>
                </div>
                <Link href="/">
                    <Button variant="ghost" size="icon">
                        <House className="h-5 w-5" />
                    </Button>
                </Link>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
                <Button onClick={() => handleImport("merge")} disabled={importing}>
                    {importing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <Download className="h-4 w-4 mr-2" />
                    )}
                    导入官方行测树
                </Button>
                <Button
                    variant="outline"
                    onClick={() => handleImport("replace")}
                    disabled={importing}
                >
                    重置为官方树
                </Button>
                <Button
                    variant="secondary"
                    onClick={() => {
                        setAddingUnder("root");
                        setNewName("");
                    }}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    添加根模块
                </Button>
            </div>

            <Tabs defaultValue="tree" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="tree">我的考点树</TabsTrigger>
                    <TabsTrigger value="stats">使用统计</TabsTrigger>
                </TabsList>

                <TabsContent value="tree">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg">公考 · 行测</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {needsImport && tree.length === 0 ? (
                                <div className="py-12 text-center text-muted-foreground space-y-4">
                                    <p>还没有个人考点树。先导入官方行测模板，再按需修改。</p>
                                    <Button onClick={() => handleImport("merge")} disabled={importing}>
                                        一键导入官方树
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {addingUnder === "root" && (
                                        <div className="flex items-center gap-2 pb-3">
                                            <Input
                                                placeholder="模块名称，如「言语理解」"
                                                value={newName}
                                                onChange={(e) => setNewName(e.target.value)}
                                                className="h-8"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleAdd(null);
                                                    if (e.key === "Escape") setAddingUnder(null);
                                                }}
                                            />
                                            <Button
                                                size="sm"
                                                disabled={submitting}
                                                onClick={() => handleAdd(null)}
                                            >
                                                添加
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setAddingUnder(null)}
                                            >
                                                取消
                                            </Button>
                                        </div>
                                    )}
                                    {tree.map((n) => renderNode(n))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="stats">
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">加载中…</div>
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <TrendingUp className="h-5 w-5" />
                                    考点使用次数（按错题关联）
                                </CardTitle>
                                {untagged > 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        另有 {untagged} 道错题尚未挂考点
                                    </p>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {stats.length === 0 ? (
                                    <p className="text-muted-foreground text-sm py-6 text-center">
                                        暂无挂标错题。导入考点树并给错题打标后这里会有数据。
                                    </p>
                                ) : (
                                    stats.slice(0, 30).map((stat) => {
                                        const max = stats[0]?.count || 1;
                                        const pct = (stat.count / max) * 100;
                                        return (
                                            <div key={stat.tagId || stat.tag} className="space-y-1">
                                                <div className="flex justify-between text-sm">
                                                    <span className="font-medium">{stat.tag}</span>
                                                    <span className="text-muted-foreground">
                                                        {stat.count} 次
                                                    </span>
                                                </div>
                                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary transition-all"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
