"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { WrongAnswerStats } from "@/components/wrong-answer-stats";
import { PracticeStats } from "@/components/practice-stats";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, TrendingUp, Activity } from "lucide-react";
import Link from "next/link";

export default function StatsPage() {
    const { t, language } = useLanguage();

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <BarChart3 className="h-8 w-8" />
                        {language === 'zh' ? "统计中心" : "Statistics Center"}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {language === 'zh' ? "查看您的学习进度和数据分析" : "View your learning progress and data analysis"}
                    </p>
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
                    <PracticeStats />
                </TabsContent>
            </Tabs>
        </div>
    );
}
