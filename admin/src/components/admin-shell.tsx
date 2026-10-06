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

const NAV_ITEMS = [
    { href: "/", label: "仪表盘", icon: LayoutDashboard },
    { href: "/users", label: "用户管理", icon: Users },
    { href: "/announcements", label: "公告管理", icon: Megaphone },
    { href: "/feedback", label: "反馈管理", icon: MessageSquareHeart },
    { href: "/settings", label: "系统设置", icon: Settings },
    { href: "/tools", label: "系统工具", icon: Wrench },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { data: session } = useSession();

    return (
        <div className="flex min-h-screen bg-slate-100">
            <aside className="flex w-56 shrink-0 flex-col border-r bg-white">
                <div className="flex items-center gap-2 border-b px-4 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <BookOpenCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold leading-tight">错题本管理后台</p>
                        <p className="text-xs text-muted-foreground">Grow quickly</p>
                    </div>
                </div>
                <nav className="flex-1 space-y-1 p-3">
                    {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground",
                                    active && "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </Link>
                        );
                    })}
                </nav>
                <div className="border-t p-3">
                    <p className="truncate px-3 pb-2 text-xs text-muted-foreground">
                        {session?.user?.email || "…"}
                    </p>
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
            <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
    );
}
