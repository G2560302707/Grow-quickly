"use client";

import dynamic from "next/dynamic";
import { useLanguage } from "@/contexts/LanguageContext";
import { WeakPointCard } from "@/components/weak-point-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, Activity, House } from "lucide-react";
import Link from "next/link";

// recharts 体积较大，图表组件懒加载，移出统计页首屏包
const WrongAnswerStats = dynamic(
    () => import("@/components/wrong-answer-stats").then(mod => mod.WrongAnswerStats),
    { ssr: false, loading: () => <ChartSkeleton /> }
);
const PracticeStats = dynamic(
    () => import("@/components/practice-stats").then(mod => mod.PracticeStats),
    { ssr: false, loading: () => <ChartSkeleton /> }
);

function ChartSkeleton() {
    return (
        <div className="space-y-6">
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

export default function StatsPage() {
    const { t } = useLanguage();

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="flex items-center gap-4 mb-6">
                <BackButton fallbackUrl="/" />
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <BarChart3 className="h-8 w-8" />
                        {t.stats?.headerTitle || "Statistics Center"}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {t.stats?.headerDesc || "View your learning progress and data analysis"}
                    </p>
                </div>
                <div className="ml-auto flex items-center">
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <House className="h-5 w-5" />
                        </Button>
                    </Link>
                </div>
            </div>

            <Tabs defaultValue="wrong" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="wrong" className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        {t.wrongAnswerStats?.title || "Wrong Answer Stats"}
                    </TabsTrigger>
                    <TabsTrigger value="practice" className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        {t.stats?.title || "Practice Stats"}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="wrong" className="space-y-4">
                    <WrongAnswerStats />
                </TabsContent>
                <TabsContent value="practice" className="space-y-4">
                    <WeakPointCard />
                    <PracticeStats />
                </TabsContent>
            </Tabs>
        </div>
    );
}
