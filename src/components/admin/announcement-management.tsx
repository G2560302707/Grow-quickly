"use client";

/**
 * 公告管理（管理员）：发布、编辑、上/下架、删除系统公告。
 * 数据走 /api/announcements 系列；成功与确认均使用应用内弹窗。
 */
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Megaphone, Plus, Trash2, Pencil, Eye, EyeOff } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { alertDialog, confirmDialog } from "@/components/ui/app-dialog";
import { AdminAnnouncement } from "@grow/shared/types/api";

export function AnnouncementManagement() {
    const [items, setItems] = useState<AdminAnnouncement[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // 创建/编辑表单（editingId 为空表示新建）
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get<{ announcements: AdminAnnouncement[] }>("/api/announcements?all=true");
            setItems(res?.announcements ?? []);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const resetForm = () => {
        setTitle("");
        setContent("");
        setEditingId(null);
    };

    const handleSubmit = async () => {
        if (!title.trim() || !content.trim()) {
            await alertDialog({ description: "标题和内容不能为空" });
            return;
        }
        setSubmitting(true);
        try {
            if (editingId) {
                await apiClient.patch(`/api/announcements/${editingId}`, { title: title.trim(), content: content.trim() });
                await alertDialog({ description: "公告已更新" });
            } else {
                await apiClient.post("/api/announcements", { title: title.trim(), content: content.trim() });
                await alertDialog({ description: "公告已发布" });
            }
            resetForm();
            await load();
        } catch (error: any) {
            await alertDialog({ description: error?.data?.message || error?.message || "操作失败" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleActive = async (item: AdminAnnouncement) => {
        try {
            await apiClient.patch(`/api/announcements/${item.id}`, { isActive: !item.isActive });
            await load();
        } catch (error: any) {
            await alertDialog({ description: error?.data?.message || "操作失败" });
        }
    };

    const handleDelete = async (item: AdminAnnouncement) => {
        const ok = await confirmDialog({
            title: "删除公告",
            description: `确定删除「${item.title}」吗？该操作不可撤销。`,
            danger: true,
        });
        if (!ok) return;
        try {
            await apiClient.delete(`/api/announcements/${item.id}`);
            await alertDialog({ description: "公告已删除" });
            if (editingId === item.id) resetForm();
            await load();
        } catch (error: any) {
            await alertDialog({ description: error?.data?.message || "删除失败" });
        }
    };

    const startEdit = (item: AdminAnnouncement) => {
        setEditingId(item.id);
        setTitle(item.title);
        setContent(item.content);
    };

    return (
        <div className="space-y-4 py-4">
            {/* 发布 / 编辑表单 */}
            <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                    <Label>{editingId ? "编辑公告" : "发布新公告"}</Label>
                    {editingId && (
                        <Button variant="ghost" size="sm" onClick={resetForm}>
                            取消编辑
                        </Button>
                    )}
                </div>
                <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="公告标题（必填，100 字以内）"
                    maxLength={100}
                />
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="公告内容（必填，2000 字以内，支持换行）"
                    maxLength={2000}
                    rows={4}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingId ? "保存修改" : "发布公告"}
                </Button>
            </div>

            {/* 公告列表 */}
            {loading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                    还没有公告，使用上方表单发布第一条吧。
                </p>
            ) : (
                <div className="space-y-2">
                    {items.map(item => (
                        <div
                            key={item.id}
                            className={`border rounded-lg p-3 space-y-2 ${
                                item.isActive ? "bg-card" : "bg-muted/40 opacity-70"
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Megaphone className={`h-4 w-4 shrink-0 ${item.isActive ? "text-primary" : "text-muted-foreground"}`} />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">{item.title}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(item.createdAt).toLocaleString()} · 阅读 {item.readCount} 人
                                            {!item.isActive && " · 已下架"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        title={item.isActive ? "下架" : "上架"}
                                        onClick={() => handleToggleActive(item)}
                                    >
                                        {item.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        title="编辑"
                                        onClick={() => startEdit(item)}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        title="删除"
                                        onClick={() => handleDelete(item)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words">{item.content}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
