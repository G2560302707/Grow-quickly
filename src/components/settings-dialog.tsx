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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Trash2, Loader2, AlertTriangle, Save, Eye, EyeOff, Languages, User, Bot, Shield } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { UserManagement } from "@/components/admin/user-management";

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

interface UserProfile {
    name: string;
    email: string;
    educationStage: string;
    enrollmentYear: number | string;
    password?: string;
}

export function SettingsDialog() {
    const { data: session } = useSession();
    const { t, language, setLanguage } = useLanguage();
    const [open, setOpen] = useState(false);
    const [clearingPractice, setClearingPractice] = useState(false);
    const [clearingError, setClearingError] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [config, setConfig] = useState<AppConfig>({ aiProvider: 'gemini' });

    // Profile State
    const [profile, setProfile] = useState<UserProfile>({
        name: "",
        email: "",
        educationStage: "",
        enrollmentYear: "",
        password: ""
    });
    const [confirmPassword, setConfirmPassword] = useState("");
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileSaving, setProfileSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const router = useRouter();

    useEffect(() => {
        if (open) {
            fetchSettings();
            fetchProfile();
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

    const fetchProfile = async () => {
        setProfileLoading(true);
        try {
            const res = await fetch("/api/user");
            if (res.ok) {
                const data = await res.json();
                setProfile({
                    ...data,
                    password: "" // Don't show password
                });
            }
        } catch (error) {
            console.error("Failed to fetch profile:", error);
        } finally {
            setProfileLoading(false);
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
                // window.location.reload(); // Reload might be too aggressive if just changing AI settings
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

    const handleSaveProfile = async () => {
        setProfileSaving(true);
        try {
            // 验证密码一致性（如果用户输入了密码）
            if (profile.password && profile.password !== confirmPassword) {
                alert(language === 'zh' ? '两次密码不一致' : 'Passwords do not match');
                setProfileSaving(false);
                return;
            }

            const payload: any = { ...profile };
            if (!payload.password) delete payload.password;
            if (payload.enrollmentYear) payload.enrollmentYear = parseInt(payload.enrollmentYear.toString());

            const res = await fetch("/api/user", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                alert(language === 'zh' ? "个人信息已更新" : "Profile updated");
                setProfile(prev => ({ ...prev, password: "" })); // Clear password field
                setConfirmPassword(""); // Clear confirm password field
                setShowPassword(false);
                setShowConfirmPassword(false);
                window.location.reload(); // Reload to update user name in UI
            } else {
                const data = await res.json();
                alert(data.message || (language === 'zh' ? "更新失败" : "Update failed"));
            }
        } catch (error) {
            console.error("Failed to update profile:", error);
            alert(language === 'zh' ? "更新失败" : "Update failed");
        } finally {
            setProfileSaving(false);
        }
    };

    const handleClearData = async () => {
        if (!confirm(t.settings?.clearDataConfirm || "Are you sure?")) {
            return;
        }

        setClearingPractice(true);
        try {
            const res = await fetch("/api/stats/practice/clear", {
                method: "DELETE",
            });

            if (res.ok) {
                alert(t.settings?.clearSuccess || "Success");
                setOpen(false);
                window.location.reload();
            } else {
                alert(t.settings?.clearError || "Failed");
            }
        } catch (error) {
            console.error(error);
            alert(t.settings?.clearError || "Failed");
        } finally {
            setClearingPractice(false);
        }
    };

    const handleClearErrorData = async () => {
        if (!confirm(t.settings?.clearErrorDataConfirm || "Are you sure?")) {
            return;
        }

        setClearingError(true);
        try {
            const res = await fetch("/api/error-items/clear", {
                method: "DELETE",
            });

            if (res.ok) {
                alert(t.settings?.clearSuccess || "Success");
                setOpen(false);
                window.location.reload();
            } else {
                alert(t.settings?.clearError || "Failed");
            }
        } catch (error) {
            console.error(error);
            alert(t.settings?.clearError || "Failed");
        } finally {
            setClearingError(false);
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
            <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t.settings?.title || "Settings"}</DialogTitle>
                    <DialogDescription>
                        {language === 'zh' ? '管理您的应用偏好和数据。' : 'Manage your preferences and data.'}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="general" className="w-full">
                    <TabsList className={`grid w-full ${(session?.user as any)?.role === 'admin' ? 'grid-cols-5' : 'grid-cols-4'}`}>
                        <TabsTrigger value="general">
                            <Languages className="h-4 w-4 mr-2" />
                            {language === 'zh' ? "通用" : "General"}
                        </TabsTrigger>
                        <TabsTrigger value="account">
                            <User className="h-4 w-4 mr-2" />
                            {language === 'zh' ? "账户" : "Account"}
                        </TabsTrigger>
                        <TabsTrigger value="ai">
                            <Bot className="h-4 w-4 mr-2" />
                            {language === 'zh' ? "AI 提供商" : "AI Provider"}
                        </TabsTrigger>
                        {(session?.user as any)?.role === 'admin' && (
                            <TabsTrigger value="admin">
                                <Shield className="h-4 w-4 mr-2" />
                                {language === 'zh' ? "用户管理" : "User Management"}
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="danger">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            {language === 'zh' ? "危险" : "Danger"}
                        </TabsTrigger>
                    </TabsList>

                    {/* General Tab */}
                    <TabsContent value="general" className="space-y-4 py-4">
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
                    </TabsContent>

                    {/* Account Tab */}
                    <TabsContent value="account" className="space-y-4 py-4">
                        {profileLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>{language === 'zh' ? "姓名" : "Name"}</Label>
                                        <Input
                                            value={profile.name || ""}
                                            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{language === 'zh' ? "邮箱" : "Email"}</Label>
                                        <Input
                                            value={profile.email || ""}
                                            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                            type="email"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>{language === 'zh' ? "教育阶段" : "Education Stage"}</Label>
                                        <Select
                                            value={profile.educationStage || ""}
                                            onValueChange={(val) => setProfile({ ...profile, educationStage: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={language === 'zh' ? "选择阶段" : "Select Stage"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="primary">{language === 'zh' ? '小学' : 'Primary School'}</SelectItem>
                                                <SelectItem value="junior_high">{language === 'zh' ? '初中' : 'Junior High'}</SelectItem>
                                                <SelectItem value="senior_high">{language === 'zh' ? '高中' : 'Senior High'}</SelectItem>
                                                <SelectItem value="university">{language === 'zh' ? '大学' : 'University'}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{language === 'zh' ? "入学年份" : "Enrollment Year"}</Label>
                                        <Input
                                            type="number"
                                            value={profile.enrollmentYear || ""}
                                            onChange={(e) => setProfile({ ...profile, enrollmentYear: e.target.value })}
                                            placeholder="YYYY"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2 border-t">
                                    <div className="space-y-2">
                                        <Label>{language === 'zh' ? "修改密码 (留空不修改)" : "Change Password (Leave empty to keep)"}</Label>
                                        <div className="relative">
                                            <Input
                                                type={showPassword ? "text" : "password"}
                                                value={profile.password}
                                                onChange={(e) => setProfile({ ...profile, password: e.target.value })}
                                                placeholder="******"
                                                minLength={6}
                                                className="pr-10"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                                onClick={() => setShowPassword(!showPassword)}
                                                tabIndex={-1}
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                    {profile.password && (
                                        <div className="space-y-2">
                                            <Label>{language === 'zh' ? "确认密码" : "Confirm Password"}</Label>
                                            <div className="relative">
                                                <Input
                                                    type={showConfirmPassword ? "text" : "password"}
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    placeholder="******"
                                                    minLength={6}
                                                    className="pr-10"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    tabIndex={-1}
                                                >
                                                    {showConfirmPassword ? (
                                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                    ) : (
                                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <Button onClick={handleSaveProfile} disabled={profileSaving} className="w-full">
                                    {profileSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {language === 'zh' ? "更新个人信息" : "Update Profile"}
                                </Button>
                            </div>
                        )}
                    </TabsContent>

                    {/* AI Tab */}
                    <TabsContent value="ai" className="space-y-4 py-4">
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
                                    {language === 'zh' ? "保存 AI 设置" : "Save AI Settings"}
                                </Button>
                            </div>
                        )}
                    </TabsContent>

                    {/* Admin Tab */}
                    {(session?.user as any)?.role === 'admin' && (
                        <TabsContent value="admin" className="space-y-4 py-4">
                            <UserManagement />
                        </TabsContent>
                    )}

                    {/* Danger Zone Tab */}
                    <TabsContent value="danger" className="space-y-4 py-4">
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
                                        disabled={clearingPractice}
                                    >
                                        {clearingPractice ? (
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
                                        disabled={clearingError}
                                    >
                                        {clearingError ? (
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
                    </TabsContent>

                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
