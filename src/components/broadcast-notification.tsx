"use client";

/**
 * 公告通知铃铛：从 /api/announcements 拉取管理员发布的动态公告。
 * 红点 = 存在未读公告；打开面板即调用 read-all 标记已读。
 */
import { useState, useEffect, useCallback } from "react";
import { Bell, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@grow/shared/api-client";
import { AnnouncementItem } from "@grow/shared/types/api";

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays <= 0) return "今天";
    if (diffDays === 1) return "昨天";
    if (diffDays < 30) return `${diffDays} 天前`;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function BroadcastNotification() {
    const { t } = useLanguage();
    const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasUnread, setHasUnread] = useState(false);

    const fetchAnnouncements = useCallback(async () => {
        try {
            const res = await apiClient.get<{ announcements: AnnouncementItem[] }>("/api/announcements");
            const list = res?.announcements ?? [];
            setAnnouncements(list);
            setHasUnread(list.some(a => !a.read));
        } catch {
            // 未登录或网络异常时静默：铃铛显示空态即可
            setAnnouncements([]);
            setHasUnread(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAnnouncements();
    }, [fetchAnnouncements]);

    const handleOpen = useCallback(async (open: boolean) => {
        if (!open) return;
        // 打开面板时把全部公告标记为已读（红点随之熄灭）
        if (announcements.some(a => !a.read)) {
            setAnnouncements(prev => prev.map(a => ({ ...a, read: true })));
            setHasUnread(false);
            try {
                await apiClient.post("/api/announcements/read-all", {});
            } catch {
                // 标记失败不影响浏览；下次打开红点会重现
                fetchAnnouncements();
            }
        }
    }, [announcements, fetchAnnouncements]);

    return (
        <DropdownMenu onOpenChange={handleOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-muted-foreground hover:text-primary relative"
                    title={t.broadcast?.title || "Announcements"}
                >
                    <Bell className="h-5 w-5" />
                    {/* 未读角标 */}
                    {hasUnread && (
                        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                    )}
                    <span className="sr-only">{t.broadcast?.title || "Announcements"}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-72 sm:w-80 p-0"
            >
                <DropdownMenuLabel className="flex items-center gap-2 px-4 py-3 bg-primary/5 border-b">
                    <Bell className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{t.broadcast?.title || "Announcements"}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="m-0" />
                <div className="max-h-[60vh] overflow-y-auto p-3 space-y-2">
                    {loading ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                            {t.common?.loading || "加载中..."}
                        </div>
                    ) : announcements.length === 0 ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                            {t.broadcast?.empty || "暂无公告"}
                        </div>
                    ) : (
                        announcements.map(a => (
                            <div
                                key={a.id}
                                className={`flex gap-3 items-start p-3 rounded-lg border ${
                                    a.read
                                        ? "bg-muted/30 border-transparent"
                                        : "bg-primary/5 border-primary/20"
                                }`}
                            >
                                <div className="shrink-0 mt-0.5">
                                    <Megaphone className={`h-4 w-4 ${a.read ? "text-muted-foreground" : "text-primary"}`} />
                                </div>
                                <div className="space-y-1 text-sm min-w-0">
                                    <p className="font-medium text-foreground leading-relaxed break-words">
                                        {a.title}
                                        {!a.read && (
                                            <span className="ml-2 align-middle inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                                        )}
                                    </p>
                                    <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap break-words">
                                        {a.content}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
