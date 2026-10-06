"use client";

/**
 * 仪表盘数据概览：错题总数 / 掌握率 / 本周录入 / 本周活跃天数 + 近7天录入迷你趋势
 * 数据来自现有 /api/analytics（后端零改动）。
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { BookOpen, Target, PenLine, Flame, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@grow/shared/api-client";
import { AnalyticsData } from "@grow/shared/types/api";

/** 数字入场动画：从 0 计数到目标值（rAF，无依赖库） */
function useCountUp(target: number, durationMs = 700): number {
    const [value, setValue] = useState(target);
    const prevRef = useRef(0);

    useEffect(() => {
        const from = prevRef.current;
        prevRef.current = target;
        if (from === target) return;

        let raf: number;
        const start = performance.now();
        const tick = (now: number) => {
            const progress = Math.min(1, (now - start) / durationMs);
            const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
            setValue(Math.round(from + (target - from) * eased));
            if (progress < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, durationMs]);

    return value;
}

function StatCard({ icon: Icon, iconClass, label, value, suffix }: {
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    label: string;
    value: number;
    suffix?: string;
}) {
    const display = useCountUp(value);
    return (
        <Card className="transition-all hover:shadow-md">
            <CardContent className="p-5">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{label}</span>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClass}`}>
                        <Icon className="h-4 w-4" />
                    </span>
                </div>
                <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
                    {display}
                    {suffix && <span className="text-lg font-semibold text-muted-foreground ml-0.5">{suffix}</span>}
                </div>
            </CardContent>
        </Card>
    );
}

export function DashboardStats() {
    const { t } = useLanguage();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get<AnalyticsData>("/api/analytics")
            .then(setData)
            .catch(err => console.error("Failed to fetch analytics:", err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Skeleton className="h-28 rounded-xl" />
                <Skeleton className="h-28 rounded-xl" />
                <Skeleton className="h-28 rounded-xl" />
                <Skeleton className="h-28 rounded-xl" />
            </div>
        );
    }

    // 新用户空态：引导拍第一道题
    if (!data || data.totalErrors === 0) {
        return (
            <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
                <CardContent className="flex flex-col items-center py-10 text-center">
                    <span className="text-4xl mb-3">📸</span>
                    <h3 className="text-lg font-semibold">{t.dashboard?.emptyTitle || "Start with your first wrong answer"}</h3>
                    <p className="text-sm text-muted-foreground mt-2 max-w-md">
                        {t.dashboard?.emptyDesc || "Take a photo of a question below — AI will analyze it and build your knowledge base."}
                    </p>
                </CardContent>
            </Card>
        );
    }

    const weeklyEntries = data.activityData?.reduce((sum, d) => sum + d.count, 0) ?? 0;
    const weeklyActiveDays = data.activityData?.filter(d => d.count > 0).length ?? 0;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    icon={BookOpen}
                    iconClass="bg-primary/10 text-primary"
                    label={t.dashboard?.totalErrors || "Total Errors"}
                    value={data.totalErrors}
                />
                <StatCard
                    icon={Target}
                    iconClass="bg-emerald-500/10 text-emerald-500"
                    label={t.dashboard?.masteryRate || "Mastery Rate"}
                    value={data.masteryRate}
                    suffix="%"
                />
                <StatCard
                    icon={PenLine}
                    iconClass="bg-sky-500/10 text-sky-500"
                    label={t.dashboard?.weeklyEntries || "Entries This Week"}
                    value={weeklyEntries}
                />
                <StatCard
                    icon={Flame}
                    iconClass="bg-orange-500/10 text-orange-500"
                    label={t.dashboard?.weeklyActive || "Active Days This Week"}
                    value={weeklyActiveDays}
                    suffix={t.dashboard?.weekUnit || "days"}
                />
            </div>

            {/* 近 7 天录入趋势（迷你图） */}
            {data.activityData?.length > 0 && (
                <Card>
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">
                                {t.wrongAnswerStats?.activity || "Activity"}
                            </span>
                            <Link
                                href="/stats"
                                className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                            >
                                {t.dashboard?.viewAllStats || "View all statistics"}
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                        <div className="h-24">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.activityData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis hide />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{
                                            background: 'var(--background)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 8,
                                            fontSize: 12,
                                        }}
                                    />
                                    <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
