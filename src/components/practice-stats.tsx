"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, PieChart, Pie, Cell, Legend, Line } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, BookOpen, Target } from "lucide-react";
import { apiClient } from "@grow/shared/api-client";
import { PracticeStatsData } from "@grow/shared/types/api";

// 图表配色走主题变量，深浅色自动适配
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const AXIS_COLOR = 'var(--muted-foreground)';
const GRID_COLOR = 'var(--border)';
const DIFFICULTY_COLORS: Record<string, string> = {
    'easy': '#4ade80',   // Green-400
    'medium': '#facc15', // Yellow-400
    'hard': '#fb923c',   // Orange-400
    'harder': '#f87171', // Red-400
    'Unknown': '#94a3b8' // Slate-400
};

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ value?: number | string; color?: string; name?: string }>;
    label?: string;
    t: { stats?: { total?: string } };
}

const CustomTooltip = ({ active, payload, label, t }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                <p className="font-medium mb-2">{label}</p>
                {payload.map((entry, index: number) => (
                    <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-muted-foreground">
                            {entry.name}:
                        </span>
                        <span className="font-medium">
                            {entry.value}
                        </span>
                    </div>
                ))}
                <div className="mt-2 pt-2 border-t flex justify-between gap-4">
                    <span className="text-muted-foreground">{t.stats?.total || "Total"}:</span>
                    <span className="font-bold">
                        {payload.reduce((acc: number, curr) => acc + (typeof curr.value === 'number' ? curr.value : 0), 0)}
                    </span>
                </div>
            </div>
        );
    }
    return null;
};

export function PracticeStats() {
    const { t } = useLanguage();
    const [stats, setStats] = useState<PracticeStatsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get<PracticeStatsData>("/api/stats/practice")
            .then(data => {
                setStats(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch stats:", err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <Skeleton className="h-8 w-48" />
                <div className="grid gap-4 md:grid-cols-3">
                    <Skeleton className="h-28 rounded-xl" />
                    <Skeleton className="h-28 rounded-xl" />
                    <Skeleton className="h-28 rounded-xl" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-[360px] rounded-xl" />
                    <Skeleton className="h-[360px] rounded-xl" />
                </div>
            </div>
        );
    }

    if (!stats || stats.overallStats.total === 0) {
        return null; // Don't show if no data
    }

    // Helper to translate difficulty
    const getDifficultyLabel = (key: string) => {
        const difficultyMap = t.practice?.difficulty as Record<string, string> | undefined;
        return difficultyMap?.[key] || key;
    };

    // Get unique difficulties for the bar chart
    const difficulties = stats.difficultyStats.map(d => d.name);

    // 月度正确率（%），供趋势折线使用
    const monthlyWithRate = stats.activityStats.map(d => ({
        ...d,
        rate: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
    }));

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight">{t.stats?.title || "Practice Statistics"}</h2>

            {/* Overview Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {t.stats?.totalPractices || "Total Practiced"}
                        </CardTitle>
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.overallStats.total}</div>
                    </CardContent>
                </Card>
                <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {t.stats?.correctRate || "Correct Rate"}
                        </CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.overallStats.rate}%</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.overallStats.correct} / {stats.overallStats.total} {t.stats?.correct || "Correct"}
                        </p>
                    </CardContent>
                </Card>
                <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {t.stats?.activeDays || "Active Days (6m)"}
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activityStats.filter(d => d.total > 0).length}</div>
                    </CardContent>
                </Card>
            </div>

            {/* 渠道双轨：自由练习 vs 错题强化（举一反三+薄弱点专项），答对率分渠道才有意义 */}
            {stats.channelStats && (
                <div className="grid gap-4 md:grid-cols-2">
                    <Card className="transition-shadow hover:shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">自由练习</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-end gap-6">
                                <div>
                                    <div className="text-2xl font-bold">{stats.channelStats.free.total}</div>
                                    <p className="text-xs text-muted-foreground">练习次数</p>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">{stats.channelStats.free.rate}%</div>
                                    <p className="text-xs text-muted-foreground">答对率</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="transition-shadow hover:shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">错题强化（举一反三 + 薄弱点专项）</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-end gap-6">
                                <div>
                                    <div className="text-2xl font-bold">{stats.channelStats.reinforced.total}</div>
                                    <p className="text-xs text-muted-foreground">练习次数</p>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">{stats.channelStats.reinforced.rate}%</div>
                                    <p className="text-xs text-muted-foreground">答对率</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
                {/* Subject Distribution */}
                <Card className="col-span-2 md:col-span-1">
                    <CardHeader>
                        <CardTitle>{t.stats?.subjectDistribution || "Subject Distribution"}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.subjectStats}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                >
                                    {stats.subjectStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Monthly Activity with Difficulty Stack + Correct Rate Line */}
                <Card className="col-span-2 md:col-span-1">
                    <CardHeader>
                        <CardTitle>{t.stats?.weeklyTrend || "Monthly Trend"}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={monthlyWithRate} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    yAxisId="count"
                                    allowDecimals={false}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                                />
                                <YAxis
                                    yAxisId="rate"
                                    orientation="right"
                                    domain={[0, 100]}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                                    tickFormatter={(v) => `${v}%`}
                                />
                                <Tooltip content={<CustomTooltip t={t} />} cursor={{ fill: 'transparent' }} />
                                <Legend
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ paddingTop: '20px' }}
                                />
                                {difficulties.map((diff, index) => (
                                    <Bar
                                        key={diff}
                                        yAxisId="count"
                                        dataKey={diff}
                                        name={getDifficultyLabel(diff)}
                                        stackId="a"
                                        fill={DIFFICULTY_COLORS[diff] || COLORS[index % COLORS.length]}
                                        radius={index === difficulties.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                        barSize={32}
                                    />
                                ))}
                                <Line
                                    yAxisId="rate"
                                    type="monotone"
                                    dataKey="rate"
                                    name={t.stats?.correctRate || "Correct Rate"}
                                    stroke="var(--chart-1)"
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: 'var(--chart-1)' }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
