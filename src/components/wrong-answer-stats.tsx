"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, Radar, PolarRadiusAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, CheckCircle, BookOpen } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/lib/api-client";
import { AnalyticsData } from "@/types/api";

// 图表配色走主题变量，深浅色自动适配
const AXIS_COLOR = 'var(--muted-foreground)';
const GRID_COLOR = 'var(--border)';

export function WrongAnswerStats() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const { t } = useLanguage();

    interface CustomTooltipProps {
        active?: boolean;
        payload?: Array<{ value?: number | string }>;
        label?: string;
    }

    const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                    <p className="font-medium mb-1">{label}</p>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-violet-500" />
                        <span className="text-muted-foreground">{t.wrongAnswerStats.activity}:</span>
                        <span className="font-bold">{payload[0].value}</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            const data = await apiClient.get<AnalyticsData>("/api/analytics");
            setData(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

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

    if (!data) return null;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-2xl font-bold tracking-tight">
                {t.wrongAnswerStats.title}
            </h2>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t.wrongAnswerStats.totalErrors}</CardTitle>
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.totalErrors}</div>
                        <p className="text-xs text-muted-foreground">
                            {t.wrongAnswerStats.totalErrorsDesc}
                        </p>
                    </CardContent>
                </Card>
                <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t.wrongAnswerStats.mastered}</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.masteredCount}</div>
                        <p className="text-xs text-muted-foreground">
                            {t.wrongAnswerStats.masteredDesc}
                        </p>
                    </CardContent>
                </Card>
                <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t.wrongAnswerStats.masteryRate}</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.masteryRate}%</div>
                        <p className="text-xs text-muted-foreground">
                            {t.wrongAnswerStats.masteryRateDesc}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {/* Subject Distribution — Radar */}
                <Card className="col-span-2 md:col-span-1">
                    <CardHeader>
                        <CardTitle>{t.wrongAnswerStats.SubjectDistribution}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={data.subjectStats} outerRadius="72%">
                                <PolarGrid stroke={GRID_COLOR} />
                                <PolarAngleAxis
                                    dataKey="name"
                                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                                />
                                <PolarRadiusAxis tick={false} axisLine={false} />
                                <Radar
                                    name={t.wrongAnswerStats.totalErrors}
                                    dataKey="value"
                                    stroke="var(--chart-1)"
                                    fill="var(--chart-1)"
                                    fillOpacity={0.35}
                                    strokeWidth={2}
                                />
                                <Tooltip content={<CustomTooltip />} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Monthly Trend */}
                <Card className="col-span-2 md:col-span-1">
                    <CardHeader>
                        <CardTitle>{t.wrongAnswerStats.MonthlyTrend}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
                                <XAxis
                                    dataKey="date"
                                    stroke={AXIS_COLOR}
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke={AXIS_COLOR}
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value}`}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                                <Bar
                                    dataKey="count"
                                    fill="url(#colorCount)"
                                    radius={[4, 4, 0, 0]}
                                    barSize={40}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
