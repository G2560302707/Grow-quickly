"use client";

/**
 * 管理端系统工具：标签迁移、系统重置、Prompt 调试入口
 * 自学习端设置弹窗"危险操作"区移植。
 */
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, RefreshCw, FlaskConical } from "lucide-react";
import { apiClient } from "@grow/shared/api-client";
import { alertDialog, confirmDialog, promptDialog } from "@/components/ui/app-dialog";

export default function AdminToolsPage() {
    const [systemResetting, setSystemResetting] = useState(false);
    const [migratingTags, setMigratingTags] = useState(false);

    const handleSystemReset = async () => {
        // Double confirm
        if (!(await confirmDialog({ description: "警告：将删除全部数据且无法恢复。确定继续？", danger: true }))) {
            return;
        }

        // 输入 RESET 三重确认
        const userInput = await promptDialog({
            description: "输入 RESET 以确认执行系统初始化：",
            defaultValue: "",
        });
        if (userInput !== 'RESET') {
            if (userInput !== null) await alertDialog({ description: "确认失败" });
            return;
        }

        setSystemResetting(true);
        try {
            await apiClient.post("/api/admin/system-reset", {});
            await alertDialog({ description: "系统初始化完成" });
        } catch (error) {
            await alertDialog({ description: "系统重置失败" });
        } finally {
            setSystemResetting(false);
        }
    };

    const handleMigrateTags = async () => {
        if (!(await confirmDialog({ description: "将按内置数据重建系统标签（保留用户关联），确定执行？", danger: true }))) {
            return;
        }

        setMigratingTags(true);
        try {
            const res = await apiClient.post("/api/admin/migrate-tags", {});
            await alertDialog({ description: `迁移完成：${(res as any).count || 0} 个标签` });
        } catch (error) {
            await alertDialog({ description: "标签迁移失败" });
        } finally {
            setMigratingTags(false);
        }
    };

    return (
        <div className="space-y-4 max-w-5xl">
            <h1 className="text-2xl font-bold">系统工具</h1>

            <div className="grid gap-4 md:grid-cols-2">
                {/* Prompt/公式调试 */}
                <div className="p-5 border rounded-lg bg-white flex flex-col">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold flex items-center gap-2">
                                <FlaskConical className="h-4 w-4" />
                                Prompt / 公式调试
                            </span>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/tools/latex-test">打开</Link>
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                        验证 Markdown / LaTeX 渲染效果与 AI 输出格式。
                    </p>
                </div>

                {/* Migrate Tags */}
                <div className="p-5 border border-blue-200 rounded-lg bg-blue-50 flex flex-col">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-sm text-blue-900 font-bold flex items-center gap-2">
                                <RefreshCw className="h-4 w-4" />
                                标签迁移
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleMigrateTags}
                            disabled={migratingTags}
                            className="bg-blue-100 hover:bg-blue-200 text-blue-900 border-blue-300"
                        >
                            {migratingTags ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                    <p className="text-xs text-blue-800 mt-3 font-medium">
                        按内置标签数据重建系统标签，用于版本升级后同步标签体系。
                    </p>
                </div>

                {/* System Reset：危险操作独占整行 */}
                <div className="p-5 border border-red-600/50 rounded-lg bg-red-100/50 md:col-span-2">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-sm text-red-900 font-bold flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                系统初始化
                            </span>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleSystemReset}
                            disabled={systemResetting}
                            className="bg-red-700 hover:bg-red-800"
                        >
                            {systemResetting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <AlertTriangle className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                    <p className="text-xs text-red-800 mt-3 font-medium">
                        将系统恢复到出厂状态，删除全部数据，不可撤销。
                    </p>
                </div>
            </div>
        </div>
    );
}
