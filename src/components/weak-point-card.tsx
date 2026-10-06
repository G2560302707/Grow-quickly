"use client";

/**
 * 薄弱点诊断卡（统计中心）：展示知识点级弱项排名与证据，
 * 每个弱项可直接跳转专项练习（/practice/smart）。
 * 数据来自 GET /api/diagnosis/weakness，与小程序端统计页同源。
 */
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, Minus, Target } from "lucide-react";
import { apiClient } from "@grow/shared/api-client";
import { useLanguage } from "@/contexts/LanguageContext";

interface KpDiagnosis {
    tagId: string;
    name: string;
    chapterId: string | null;
    chapterName: string | null;
    errorCount: number;
    practiceAttempts: number;
    practiceAccuracy: number | null;
    score: number;
    confidence: number;
    trend: "worsening" | "flat" | "improving" | "unknown";
    ready: boolean;
}

interface WeaknessReport {
    totalErrorItems: number;
    readyKpCount: number;
    kps: KpDiagnosis[];
    topKps: KpDiagnosis[];
}

const RANK_STYLES = ["bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300", "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"];

export function WeakPointCard() {
    const router = useRouter();
    const { t } = useLanguage();
    const [report, setReport] = useState<WeaknessReport | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get<WeaknessReport>("/api/diagnosis/weakness");
            setReport(res);
        } catch {
            setReport(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const trendIcon = (trend: KpDiagnosis["trend"]) => {
        if (trend === "worsening") return <TrendingUp className="h-4 w-4 text-red-600" />;
        if (trend === "improving") return <TrendingDown className="h-4 w-4 text-green-600" />;
        if (trend === "flat") return <Minus className="h-4 w-4 text-muted-foreground" />;
        return null;
    };

    const trendText = (trend: KpDiagnosis["trend"]) => {
        if (trend === "worsening") return "恶化中";
        if (trend === "improving") return "改善中";
        if (trend === "flat") return "持平";
        return "观察";
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    薄弱点诊断
                </CardTitle>
                {report && (
                    <span className="text-xs text-muted-foreground">
                        基于 {report.totalErrorItems} 道错题
                    </span>
                )}
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : !report || report.topKps.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                        {report && report.totalErrorItems > 0
                            ? "证据积累中：给错题标注知识点后，这里会指出你的薄弱环节"
                            : "还没有错题数据，先去录入错题吧"}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {report.topKps.map((kp, idx) => (
                            <div key={kp.tagId} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                                <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${RANK_STYLES[idx] ?? RANK_STYLES[2]}`}>
                                    {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-semibold truncate">{kp.name}</span>
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                                            {trendIcon(kp.trend)}
                                            {trendText(kp.trend)}
                                        </span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-600 transition-all"
                                            style={{ width: `${kp.score}%` }}
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                                        <span>薄弱度 {kp.score}</span>
                                        <span>错 {kp.errorCount} 题</span>
                                        {kp.chapterName && <span>{kp.chapterName}</span>}
                                        {kp.practiceAccuracy !== null && <span>练习正确率 {Math.round(kp.practiceAccuracy * 100)}%</span>}
                                        <span>证据 {Math.round(kp.confidence * 100)}%</span>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    className="shrink-0"
                                    onClick={() => router.push(`/practice/smart?tagId=${kp.tagId}&tagName=${encodeURIComponent(kp.name)}`)}
                                >
                                    专项练
                                </Button>
                            </div>
                        ))}
                        <p className="text-xs text-muted-foreground pt-1">
                            薄弱度综合错题积累、复发频率与掌握进度，随练习动态更新。
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
