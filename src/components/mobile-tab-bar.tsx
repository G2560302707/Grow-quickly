"use client";

/**
 * 移动端底部导航栏
 * 仅在 <md 视口渲染；登录/注册/打印页自动隐藏。
 * 固定底部 + 安全区适配，自带占位符防止页面内容被遮挡。
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, BarChart3, Tags } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const HIDDEN_PREFIXES = ["/login", "/register", "/print-preview"];

export function MobileTabBar() {
    const pathname = usePathname();
    const { t } = useLanguage();

    if (!pathname || HIDDEN_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
        return null;
    }

    const tabs = [
        { href: "/", label: t.mobileNav?.home || "首页", icon: Home },
        { href: "/notebooks", label: t.mobileNav?.notebooks || "错题本", icon: BookOpen },
        { href: "/stats", label: t.mobileNav?.stats || "统计", icon: BarChart3 },
        { href: "/tags", label: t.mobileNav?.tags || "标签", icon: Tags },
    ];

    const isActive = (href: string) =>
        href === "/" ? pathname === "/" : pathname.startsWith(href);

    return (
        <>
            {/* 占位：防止固定底栏遮挡页面末尾内容 */}
            <div className="md:hidden h-16" aria-hidden="true" />
            <nav
                className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
                <div className="grid grid-cols-4 h-14">
                    {tabs.map(({ href, label, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] leading-tight transition-colors ${
                                isActive(href)
                                    ? "text-primary font-medium"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                            aria-current={isActive(href) ? "page" : undefined}
                        >
                            <Icon className="h-5 w-5" />
                            <span>{label}</span>
                        </Link>
                    ))}
                </div>
            </nav>
        </>
    );
}
