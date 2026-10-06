"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
    LayoutDashboard,
    Users,
    Megaphone,
    MessageSquareHeart,
    Settings,
    Wrench,
    LogOut,
    BookOpenCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// 侧边栏分组：与优秀开源管理后台一致，按"概览 / 内容管理 / 系统"分层
const NAV_GROUPS: { label: string; items: { href: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
    {
        label: "概览",
        items: [{ href: "/", label: "仪表盘", icon: LayoutDashboard }],
    },
    {
        label: "内容管理",
        items: [
            { href: "/users", label: "用户管理", icon: Users },
            { href: "/announcements", label: "公告管理", icon: Megaphone },
            { href: "/feedback", label: "反馈管理", icon: MessageSquareHeart },
        ],
    },
    {
        label: "系统",
        items: [
            { href: "/settings", label: "系统设置", icon: Settings },
            { href: "/tools", label: "系统工具", icon: Wrench },
        ],
    },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { data: session } = useSession();

    return (
        <div className="flex min-h-screen bg-muted/40">
            <aside className="flex w-60 shrink-0 flex-col border-r bg-background">
                <div className="flex items-center gap-2.5 border-b px-5 py-5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <BookOpenCheck className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold leading-tight">错题本管理后台</p>
                        <p className="text-xs text-muted-foreground">Grow quickly</p>
                    </div>
                </div>
                <nav className="flex-1 overflow-y-auto p-3">
                    {NAV_GROUPS.map((group) => (
                        <div key={group.label} className="mb-1">
                            <p className="px-3 pt-4 pb-1.5 text-xs font-medium text-muted-foreground">
                                {group.label}
                            </p>
                            <div className="space-y-0.5">
                                {group.items.map(({ href, label, icon: Icon }) => {
                                    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                                    return (
                                        <Link
                                            key={href}
                                            href={href}
                                            className={cn(
                                                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted",
                                                active
                                                    ? "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary"
                                                    : "text-muted-foreground"
                                            )}
                                        >
                                            <Icon className="h-4 w-4" />
                                            {label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
                <div className="border-t p-3">
                    <div className="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {(session?.user?.email || "A").slice(0, 1).toUpperCase()}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                            {session?.user?.email || "…"}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 text-muted-foreground"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                    >
                        <LogOut className="h-4 w-4" />
                        退出登录
                    </Button>
                </div>
            </aside>
            <main className="flex-1 overflow-auto">
                {/* 全站统一居中容器：所有页面内容在此容器内铺排，不满一屏时左右均匀留白 */}
                <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
            </main>
        </div>
    );
}
