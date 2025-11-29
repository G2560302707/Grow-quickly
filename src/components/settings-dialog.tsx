"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Settings, Trash2, Loader2, AlertTriangle, Save, Eye, EyeOff, Languages } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRouter } from "next/navigation";

interface AppConfig {
    aiProvider: 'gemini' | 'openai';
    openai?: {
        apiKey?: string;
        baseUrl?: string;
        model?: string;
    };
    gemini?: {
        apiKey?: string;
        baseUrl?: string;
        model?: string;
    };
}

export function SettingsDialog() {
    const { t, language, setLanguage } = useLanguage();
    const [open, setOpen] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [config, setConfig] = useState<AppConfig>({ aiProvider: 'gemini' });
    const router = useRouter();

    useEffect(() => {
        if (open) {
            fetchSettings();
        }
    }, [open]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/settings");
            if (res.ok) {
                const data = await res.json();
                setConfig(data);
            }
        } catch (error) {
            console.error("Failed to fetch settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });

            if (res.ok) {
                alert(language === 'zh' ? "设置已保存" : "Settings saved");
                setOpen(false);
                window.location.reload();
            } else {
                alert(language === 'zh' ? "保存失败" : "Failed to save");
            }
        } catch (error) {
            console.error("Failed to save settings:", error);
            alert(language === 'zh' ? "保存失败" : "Failed to save");
        } finally {
            setSaving(false);
        }
    };

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

    const handleClearErrorData = async () => {
        if (!confirm(t.settings?.clearErrorDataConfirm || "Are you sure?")) {
            return;
        }

        setClearing(true);
        try {
            const res = await fetch("/api/error-items/clear", {
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

    const updateConfig = (section: 'openai' | 'gemini', key: string, value: string) => {
        setConfig(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value
            }
        }));
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <Settings className="h-5 w-5" />
                    <span className="sr-only">{t.settings?.title || "Settings"}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t.settings?.title || "Settings"}</DialogTitle>
                    <DialogDescription>
                        {language === 'zh' ? '管理您的应用偏好和数据。' : 'Manage your preferences and data.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    {/* General Settings */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                            <Languages className="h-4 w-4" />
                            {language === 'zh' ? "通用设置" : "General Settings"}
                        </h4>
                        <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                            <div className="space-y-2">
                                <Label>{language === 'zh' ? "语言" : "Language"}</Label>
                                <Select
                                    value={language}
                                    onValueChange={(val: 'zh' | 'en') => setLanguage(val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="zh">中文 (Chinese)</SelectItem>
                                        <SelectItem value="en">English</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* AI Configuration Section */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                            {language === 'zh' ? "AI 模型设置" : "AI Model Settings"}
                        </h4>

                        {loading ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                                <div className="space-y-2">
                                    <Label>{language === 'zh' ? "AI 提供商" : "AI Provider"}</Label>
                                    <Select
                                        value={config.aiProvider}
                                        onValueChange={(val: 'gemini' | 'openai') => setConfig(prev => ({ ...prev, aiProvider: val }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="gemini">Google Gemini</SelectItem>
                                            <SelectItem value="openai">OpenAI / Compatible</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {config.aiProvider === 'openai' && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                        <div className="space-y-2">
                                            <Label>API Key</Label>
                                            <div className="relative">
                                                <Input
                                                    type={showApiKey ? "text" : "password"}
                                                    value={config.openai?.apiKey || ''}
                                                    onChange={(e) => updateConfig('openai', 'apiKey', e.target.value)}
                                                    placeholder="sk-..."
                                                    className="pr-10"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                                    onClick={() => setShowApiKey(!showApiKey)}
                                                >
                                                    {showApiKey ? (
                                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                    ) : (
                                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Base URL (Optional)</Label>
                                            <Input
                                                value={config.openai?.baseUrl || ''}
                                                onChange={(e) => updateConfig('openai', 'baseUrl', e.target.value)}
                                                placeholder="https://api.openai.com/v1"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Model Name</Label>
                                            <Input
                                                value={config.openai?.model || ''}
                                                onChange={(e) => updateConfig('openai', 'model', e.target.value)}
                                                placeholder="gpt-4o-mini"
                                            />
                                        </div>
                                    </div>
                                )}

                                {config.aiProvider === 'gemini' && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                        <div className="space-y-2">
                                            <Label>API Key</Label>
                                            <div className="relative">
                                                <Input
                                                    type={showApiKey ? "text" : "password"}
                                                    value={config.gemini?.apiKey || ''}
                                                    onChange={(e) => updateConfig('gemini', 'apiKey', e.target.value)}
                                                    placeholder="AIza..."
                                                    className="pr-10"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                                    onClick={() => setShowApiKey(!showApiKey)}
                                                >
                                                    {showApiKey ? (
                                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                    ) : (
                                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Base URL (Optional)</Label>
                                            <Input
                                                value={config.gemini?.baseUrl || ''}
                                                onChange={(e) => updateConfig('gemini', 'baseUrl', e.target.value)}
                                                placeholder="https://generativelanguage.googleapis.com"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Model Name</Label>
                                            <Input
                                                value={config.gemini?.model || ''}
                                                onChange={(e) => updateConfig('gemini', 'model', e.target.value)}
                                                placeholder="gemini-1.5-flash"
                                            />
                                        </div>
                                    </div>
                                )}

                                <Button onClick={handleSaveSettings} disabled={saving} className="w-full">
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {language === 'zh' ? "保存设置" : "Save Settings"}
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-red-500 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            {t.settings?.dangerZone || "Danger Zone"}
                        </h4>
                        <div className="space-y-3">
                            {/* Clear Practice Data */}
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
                                        ? '此操作将永久删除所有练习记录,不可恢复。'
                                        : 'This will permanently delete all practice history. Irreversible.'}
                                </p>
                            </div>

                            {/* Clear Error Data */}
                            <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-red-700 font-medium">
                                        {t.settings?.clearErrorData || "Clear Error Data"}
                                    </span>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleClearErrorData}
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
                                        ? '此操作将永久删除所有错题记录,不可恢复。'
                                        : 'This will permanently delete all error items. Irreversible.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
