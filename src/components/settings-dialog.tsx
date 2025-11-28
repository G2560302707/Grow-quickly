"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Settings, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRouter } from "next/navigation";

export function SettingsDialog() {
    const { t, language } = useLanguage();
    const [open, setOpen] = useState(false);
    const [clearing, setClearing] = useState(false);
    const router = useRouter();

    const handleClearData = async () => {
        if (!confirm(t.settings?.clearDataConfirm || "Are you sure?")) {
            return;
        }

        setClearing(true);
        try {
            const res = await fetch("/api/stats/practice/clear", {
                method: "DELETE",
            });

            if (res.ok) {
                alert(t.settings?.clearSuccess || "Success");
                setOpen(false);
                // Refresh page to update stats
                window.location.reload();
            } else {
                alert(t.settings?.clearError || "Failed");
            }
        } catch (error) {
            console.error(error);
            alert(t.settings?.clearError || "Failed");
        } finally {
            setClearing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <Settings className="h-5 w-5" />
                    <span className="sr-only">{t.settings?.title || "Settings"}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t.settings?.title || "Settings"}</DialogTitle>
                    <DialogDescription>
                        {language === 'zh' ? '管理您的应用偏好和数据。' : 'Manage your preferences and data.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-red-500 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            {t.settings?.dangerZone || "Danger Zone"}
                        </h4>
                        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-red-700 font-medium">
                                    {t.settings?.clearData || "Clear Practice Data"}
                                </span>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleClearData}
                                    disabled={clearing}
                                >
                                    {clearing ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            <p className="text-xs text-red-600 mt-2">
                                {language === 'zh'
                                    ? '此操作将永久删除所有练习记录，不可恢复。'
                                    : 'This will permanently delete all practice history. Irreversible.'}
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
