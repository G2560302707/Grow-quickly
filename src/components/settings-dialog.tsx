"use client";

/**
 * 学习端设置弹窗（瘦身版）
 * 仅保留学习侧功能：语言、账户、个人数据管理、关于。
 * AI 供应商/Prompts/公告/反馈/邮件/系统重置等管理功能已迁移至管理后台（admin 应用）。
 */
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
import { Settings, Trash2, Loader2, AlertTriangle, Eye, EyeOff, Languages, User, Info, CheckCircle2, Download, Upload } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@grow/shared/api-client";
import { frontendLogger } from "@/lib/frontend-logger";
import { UserProfile, UpdateUserProfileRequest } from "@grow/shared/types/api";
import { alertDialog, confirmDialog } from "@/components/ui/app-dialog";

import { MessageSquareText, ExternalLink, Github, ScrollText } from "lucide-react";

interface ProfileFormState {
    name: string;
    email: string;
    educationStage: string;
    enrollmentYear: string | number;
    password: string;
}

export function SettingsDialog() {
    const { t, language, setLanguage } = useLanguage();
    const [open, setOpen] = useState(false);
    const [clearingPractice, setClearingPractice] = useState(false);
    const [clearingError, setClearingError] = useState(false);
    const [version, setVersion] = useState<string>("");

    // Profile State
    const [profile, setProfile] = useState<ProfileFormState>({
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

    // Import/Export state
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedFileName, setSelectedFileName] = useState<string>("");

    useEffect(() => {
        if (open) {
            fetchProfile();
        }
        // 获取版本号
        fetch("/api/version")
            .then((res) => res.json())
            .then((data) => setVersion(data.version))
            .catch(() => {});
    }, [open]);

    const fetchProfile = async () => {
        setProfileLoading(true);
        try {
            const data = await apiClient.get<UserProfile>("/api/user");
            setProfile({
                name: data.name || "",
                email: data.email || "",
                educationStage: data.educationStage || "",
                enrollmentYear: data.enrollmentYear || "",
                password: ""
            });
        } catch (error) {
            frontendLogger.error('[SettingsDialog]', 'Failed to fetch profile', { error: error instanceof Error ? error.message : String(error) });
        } finally {
            setProfileLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        setProfileSaving(true);
        try {
            // 验证密码一致性（如果用户输入了密码）
            if (profile.password && profile.password !== confirmPassword) {
                await alertDialog({ description: t.settings?.messages?.passwordMismatch || 'Passwords do not match' });
                setProfileSaving(false);
                return;
            }

            const payload: UpdateUserProfileRequest = {
                name: profile.name,
                email: profile.email,
                educationStage: profile.educationStage,
            };

            if (profile.enrollmentYear) {
                payload.enrollmentYear = parseInt(profile.enrollmentYear.toString());
            }

            if (profile.password) {
                payload.password = profile.password;
            }

            await apiClient.patch("/api/user", payload);

            await alertDialog({ description: t.settings?.messages?.profileUpdated || "Profile updated" });
            setProfile(prev => ({ ...prev, password: "" })); // Clear password field
            setConfirmPassword(""); // Clear confirm password field
            setShowPassword(false);
            setShowConfirmPassword(false);
            window.location.reload(); // Reload to update user name in UI
        } catch (error: any) {
            frontendLogger.error('[SettingsDialog]', 'Failed to update profile', { error: error?.data?.message || error?.message || String(error) });
            const message = error.data?.message || (t.settings?.messages?.updateFailed || "Update failed");
            await alertDialog({ description: message });
        } finally {
            setProfileSaving(false);
        }
    };

    const handleClearData = async () => {
        if (!(await confirmDialog({ description: t.settings?.clearDataConfirm || "Are you sure?", danger: true }))) {
            return;
        }

        setClearingPractice(true);
        try {
            await apiClient.delete("/api/stats/practice/clear");
            await alertDialog({ description: t.settings?.clearSuccess || "Success" });
            setOpen(false);
            window.location.reload();
        } catch (error) {
            frontendLogger.error('[SettingsDialog]', 'Failed to clear practice data', { error: error instanceof Error ? error.message : String(error) });
            await alertDialog({ description: t.settings?.clearError || "Failed" });
        } finally {
            setClearingPractice(false);
        }
    };

    const handleClearErrorData = async () => {
        if (!(await confirmDialog({ description: t.settings?.clearErrorDataConfirm || "Are you sure?", danger: true }))) {
            return;
        }

        setClearingError(true);
        try {
            await apiClient.delete("/api/error-items/clear");
            await alertDialog({ description: t.settings?.clearSuccess || "Success" });
            setOpen(false);
            window.location.reload();
        } catch (error) {
            frontendLogger.error('[SettingsDialog]', 'Failed to clear error data', { error: error instanceof Error ? error.message : String(error) });
            await alertDialog({ description: t.settings?.clearError || "Failed" });
        } finally {
            setClearingError(false);
        }
    };

    const handleExportData = async () => {
        setExporting(true);
        try {
            const res = await fetch('/api/export');
            if (!res.ok) {
                throw new Error('Export failed');
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // Get filename from Content-Disposition header or use default
            const disposition = res.headers.get('Content-Disposition');
            const filenameMatch = disposition?.match(/filename="(.+)"/);
            a.download = filenameMatch ? filenameMatch[1] : 'wrong-notebook-export.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            await alertDialog({ description: t.settings?.exportSuccess || "Export successful" });
        } catch (error) {
            frontendLogger.error('[SettingsDialog]', 'Export failed', { error: error instanceof Error ? error.message : String(error) });
            await alertDialog({ description: t.settings?.exportFailed || "Export failed" });
        } finally {
            setExporting(false);
        }
    };

    const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setSelectedFileName(file.name);
        }
    };

    const handleImportData = async () => {
        if (!selectedFile) return;

        if (!(await confirmDialog({ description: t.settings?.importConfirm || "Are you sure you want to import?", danger: true }))) {
            return;
        }

        setImporting(true);
        try {
            const text = await selectedFile.text();
            const data = JSON.parse(text);

            const response = await apiClient.post('/api/import', data);
            const stats = (response as any).stats;

            await alertDialog({ description: (t.settings?.importResultDesc || "Imported {subjects} notebooks, {tags} tags, {items} error items, {schedules} review schedules, {records} practice records.")
                    .replace('{subjects}', String(stats.subjectsCreated))
                    .replace('{tags}', String(stats.tagsCreated))
                    .replace('{items}', String(stats.errorItemsCreated))
                    .replace('{schedules}', String(stats.reviewSchedulesCreated))
                    .replace('{records}', String(stats.practiceRecordsCreated)) });

            setSelectedFile(null);
            setSelectedFileName("");
            window.location.reload();
        } catch (error) {
            frontendLogger.error('[SettingsDialog]', 'Import failed', { error: error instanceof Error ? error.message : String(error) });
            await alertDialog({ description: t.settings?.importFailed || "Import failed" });
        } finally {
            setImporting(false);
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
            <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[900px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t.settings?.title || "Settings"}</DialogTitle>
                    <DialogDescription>
                        {t.settings?.desc || 'Manage your preferences and data.'}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="general" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 sm:grid-cols-4 gap-1 h-auto">
                        <TabsTrigger value="general" className="px-2 sm:px-3">
                            <Languages className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">{t.settings?.tabs?.general || "General"}</span>
                        </TabsTrigger>
                        <TabsTrigger value="account" className="px-2 sm:px-3">
                            <User className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">{t.settings?.tabs?.account || "Account"}</span>
                        </TabsTrigger>
                        <TabsTrigger value="data" className="px-2 sm:px-3">
                            <AlertTriangle className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">{t.settings?.dataManagement || "Data"}</span>
                        </TabsTrigger>
                        <TabsTrigger value="about" className="px-2 sm:px-3">
                            <Info className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">{t.settings?.tabs?.about || "About"}</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* General Tab：语言偏好（即时生效，本地存储） */}
                    <TabsContent value="general" className="space-y-4 py-4">
                        <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                            <div className="space-y-2">
                                <Label>{t.settings?.language || "Language"}</Label>
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>{t.auth?.name || "Name"}</Label>
                                        <Input
                                            value={profile.name || ""}
                                            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t.auth?.email || "Email"}</Label>
                                        <Input
                                            value={profile.email || ""}
                                            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                            type="email"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>{t.auth?.educationStage || "Education Stage"}</Label>
                                        <Select
                                            value={profile.educationStage || ""}
                                            onValueChange={(val) => setProfile({ ...profile, educationStage: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={t.auth?.selectStage || "Select Stage"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="primary">{t.auth?.primary || 'Primary School'}</SelectItem>
                                                <SelectItem value="junior_high">{t.auth?.juniorHigh || 'Junior High'}</SelectItem>
                                                <SelectItem value="senior_high">{t.auth?.seniorHigh || 'Senior High'}</SelectItem>
                                                <SelectItem value="university">{t.auth?.university || 'University'}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t.auth?.enrollmentYear || "Enrollment Year"}</Label>
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
                                        <Label>{t.settings?.account?.changePassword || "Change Password (Leave empty to keep)"}</Label>
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
                                            <Label>{t.auth?.confirmPassword || "Confirm Password"}</Label>
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
                                    {t.settings?.account?.update || "Update Profile"}
                                </Button>
                            </div>
                        )}
                    </TabsContent>

                    {/* Data Tab：个人数据管理（全站导出/导入、系统重置已移至管理后台） */}
                    <TabsContent value="data" className="space-y-4 py-4">
                        <div className="space-y-3">
                            <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
                                <h4 className="text-sm font-bold text-blue-900 mb-3">
                                    {t.settings?.dataManagement || "Data Management"}
                                </h4>

                                {/* Export */}
                                <div className="mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-blue-800 font-medium">
                                            {t.settings?.exportData || "Export Data"}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleExportData}
                                                disabled={exporting}
                                                className="bg-blue-100 hover:bg-blue-200 text-blue-900 border-blue-300"
                                            >
                                                {exporting ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Download className="mr-2 h-4 w-4" />
                                                )}
                                                {t.settings?.exportData || "Export"}
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-blue-700">
                                        {t.settings?.exportDataDesc || "Export all data as JSON file."}
                                    </p>
                                </div>

                                {/* Import */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-blue-800 font-medium">
                                            {t.settings?.importData || "Import Data"}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="file"
                                                accept=".json"
                                                onChange={handleImportFileChange}
                                                className="hidden"
                                                id="import-file-input"
                                                disabled={importing}
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => document.getElementById('import-file-input')?.click()}
                                                disabled={importing}
                                                className="bg-blue-100 hover:bg-blue-200 text-blue-900 border-blue-300"
                                            >
                                                {importing ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Upload className="mr-2 h-4 w-4" />
                                                )}
                                                {selectedFileName || t.settings?.selectFile || "Select File"}
                                            </Button>
                                            {selectedFile && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleImportData}
                                                    disabled={importing}
                                                    className="bg-green-100 hover:bg-green-200 text-green-900 border-green-300"
                                                >
                                                    {importing ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                                    )}
                                                    {t.settings?.importData || "Import"}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-xs text-blue-700">
                                        {t.settings?.importDataDesc || "Import data from JSON file. Existing data will be skipped."}
                                    </p>
                                </div>
                            </div>

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
                                    {t.settings?.clearDataDesc || 'This will permanently delete all practice history. Irreversible.'}
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
                                    {t.settings?.clearErrorDataDesc || 'This will permanently delete all error items. Irreversible.'}
                                </p>
                            </div>
                        </div>
                    </TabsContent>

                    {/* About Tab */}
                    <TabsContent value="about" className="space-y-4 py-4">
                        <div className="flex flex-col items-center justify-center space-y-6 py-8 text-center bg-muted/30 rounded-lg border">
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold">{t.app?.title || "Smart Error Notebook"}</h3>
                                <p className="text-muted-foreground">
                                    {t.settings?.about?.desc || "AI-powered learning assistant"}
                                </p>
                            </div>

                            <div className="flex items-center space-x-2 text-sm text-muted-foreground border px-4 py-2 rounded-full bg-background">
                                <Info className="h-4 w-4" />
                                <span>{t.settings?.about?.version || "Version"}: v{version || "unknown"}</span>
                            </div>

                            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4 w-full sm:w-auto px-4 sm:px-0">
                                <Button variant="outline" asChild className="gap-2 w-full sm:w-auto">
                                    <a href="https://github.com/wttwins/wrong-notebook" target="_blank" rel="noopener noreferrer">
                                        <Github className="h-4 w-4" />
                                        {t.settings?.about?.github || "GitHub Repository"}
                                        <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
                                    </a>
                                </Button>

                                <Button variant="outline" asChild className="gap-2 w-full sm:w-auto">
                                    <a href="https://github.com/wttwins/wrong-notebook/releases" target="_blank" rel="noopener noreferrer">
                                        <ScrollText className="h-4 w-4" />
                                        {t.settings?.about?.releaseNotes || "Release Notes"}
                                        <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
                                    </a>
                                </Button>

                                <Button variant="outline" asChild className="gap-2 w-full sm:w-auto">
                                    <a href="https://github.com/wttwins/wrong-notebook/issues" target="_blank" rel="noopener noreferrer">
                                        <MessageSquareText className="h-4 w-4" />
                                        {t.settings?.about?.feedback || "Feedback"}
                                        <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
                                    </a>
                                </Button>
                            </div>

                            <p className="text-xs text-muted-foreground mt-8">
                                {t.settings?.about?.copyright || "© 2025 Wttwins. All rights reserved."}
                            </p>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
