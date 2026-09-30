"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { Upload, BookOpen, Tags, LogOut, BarChart3, PenLine } from "lucide-react";
import { UserWelcome } from "@/components/user-welcome";
import { SettingsDialog } from "@/components/settings-dialog";
import { BroadcastNotification } from "@/components/broadcast-notification";
import { DashboardStats } from "@/components/dashboard-stats";
import { UploadWorkspace } from "@/components/upload-workspace";
import { signOut } from "next-auth/react";

function HomeContent() {
    const { t } = useLanguage();
    const searchParams = useSearchParams();
    const initialNotebookId = searchParams.get("notebook");

    return (
        <main className="min-h-screen bg-background">
            <div className="container mx-auto p-4 space-y-8 pb-20">
                {/* Header Section */}
                <div className="flex justify-between items-start gap-4">
                    <UserWelcome />

                    <div className="flex items-center gap-2 bg-card p-2 rounded-lg border shadow-sm shrink-0">
                        <BroadcastNotification />
                        <SettingsDialog />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full text-muted-foreground hover:text-destructive"
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            title={t.app?.logout || 'Logout'}
                        >
                            <LogOut className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* 数据概览（含新用户空态引导） */}
                <DashboardStats />

                {/* Quick Entries */}
                <div>
                    <h2 className="text-sm font-medium text-muted-foreground mb-3">
                        {t.dashboard?.quickActions || "Quick Actions"}
                    </h2>
                    <div className="grid grid-cols-3 gap-4">
                        <Link href="/notebooks" className="w-full">
                            <Button
                                variant="outline"
                                size="lg"
                                className="w-full h-auto py-4 text-base shadow-sm hover:shadow-md transition-all border hover:border-primary/50 hover:bg-accent/50"
                            >
                                <div className="flex items-center gap-2">
                                    <BookOpen className="h-5 w-5" />
                                    <span>{t.app.viewNotebook}</span>
                                </div>
                            </Button>
                        </Link>

                        <Link href="/tags" className="w-full">
                            <Button
                                variant="outline"
                                size="lg"
                                className="w-full h-auto py-4 text-base shadow-sm hover:shadow-md transition-all border hover:border-primary/50 hover:bg-accent/50"
                            >
                                <div className="flex items-center gap-2">
                                    <Tags className="h-5 w-5" />
                                    <span>{t.app?.tags || 'Tags'}</span>
                                </div>
                            </Button>
                        </Link>

                        <Link href="/stats" className="w-full">
                            <Button
                                variant="outline"
                                size="lg"
                                className="w-full h-auto py-4 text-base shadow-sm hover:shadow-md transition-all border hover:border-primary/50 hover:bg-accent/50"
                            >
                                <div className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5" />
                                    <span>{t.app?.stats || 'Stats'}</span>
                                </div>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* 上传与识别工作区 */}
                <section className="space-y-4">
                    <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                        <Upload className="h-4 w-4 text-primary" />
                        <PenLine className="h-4 w-4 text-primary" />
                        {t.app.uploadNew}
                    </h2>
                    <UploadWorkspace initialNotebookId={initialNotebookId} />
                </section>
            </div>
        </main>
    );
}

export default function Home() {
    return (
        <Suspense fallback={<HomeSkeleton />}>
            <HomeContent />
        </Suspense>
    );
}

function HomeSkeleton() {
    return (
        <main className="min-h-screen bg-background">
            <div className="container mx-auto p-4 space-y-8 pb-20">
                <div className="flex justify-between items-start">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-56" />
                        <Skeleton className="h-4 w-40" />
                    </div>
                    <Skeleton className="h-12 w-32 rounded-lg" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Skeleton className="h-28 rounded-xl" />
                    <Skeleton className="h-28 rounded-xl" />
                    <Skeleton className="h-28 rounded-xl" />
                    <Skeleton className="h-28 rounded-xl" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <Skeleton className="h-14 rounded-lg" />
                    <Skeleton className="h-14 rounded-lg" />
                    <Skeleton className="h-14 rounded-lg" />
                </div>
                <Skeleton className="h-72 rounded-xl" />
            </div>
        </main>
    );
}
