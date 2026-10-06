"use client";

/**
 * 反馈管理（管理员）：查看用户从小程序/网页提交的反馈，标记已处理。
 * 数据走 /api/feedback（GET 列表 / PATCH 状态流转）。
 */
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquareText, CheckCheck, RotateCcw } from "lucide-react";
import { apiClient } from "@grow/shared/api-client";
import { alertDialog } from "@/components/ui/app-dialog";

interface FeedbackItem {
    id: string;
    type: string;
    content: string;
    contact: string | null;
    status: string;
    createdAt: string;
    user: { id: string; name: string | null; email: string };
}

const TYPE_LABEL: Record<string, string> = {
    feature: "功能建议",
    bug: "问题反馈",
    other: "其他",
};

export function FeedbackManagement() {
    const [items, setItems] = useState<FeedbackItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get<{ items: FeedbackItem[] }>("/api/feedback?pageSize=50");
            setItems(res?.items ?? []);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const toggleStatus = async (item: FeedbackItem) => {
        setBusy(item.id);
        try {
            await apiClient.patch("/api/feedback", {
                id: item.id,
                status: item.status === "open" ? "resolved" : "open",
            });
            await load();
        } catch (error: any) {
            await alertDialog({ description: error?.data?.message || "操作失败" });
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-3 py-4">
            {loading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">还没有用户反馈。</p>
            ) : (
                items.map(item => (
                    <div
                        key={item.id}
                        className={`border rounded-lg p-3 space-y-2 ${
                            item.status === "open" ? "bg-card" : "bg-muted/30 opacity-75"
                        }`}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 text-sm">
                                <span className="inline-flex items-center gap-1.5 font-medium">
                                    <MessageSquareText className="h-4 w-4 shrink-0 text-primary" />
                                    {item.user.name || item.user.email}
                                    <span className="text-xs font-normal text-muted-foreground">
                                        · {TYPE_LABEL[item.type] || item.type} ·{" "}
                                        {new Date(item.createdAt).toLocaleDateString()}
                                    </span>
                                </span>
                                {item.contact && (
                                    <p className="text-xs text-muted-foreground mt-1">联系方式：{item.contact}</p>
                                )}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={busy === item.id}
                                onClick={() => toggleStatus(item)}
                                className="shrink-0 h-8"
                            >
                                {busy === item.id ? (
                                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : item.status === "open" ? (
                                    <CheckCheck className="mr-1 h-3.5 w-3.5" />
                                ) : (
                                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                )}
                                {item.status === "open" ? "标记已处理" : "重新打开"}
                            </Button>
                        </div>
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words">{item.content}</p>
                    </div>
                ))
            )}
        </div>
    );
}
