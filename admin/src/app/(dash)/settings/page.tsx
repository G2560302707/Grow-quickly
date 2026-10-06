"use client";

/**
 * 管理端系统设置：AI 供应商 / Prompts / 邮件通知
 * 自学习端 settings-dialog 的管理标签页移植，中文固定文案。
 */
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Trash2, Loader2, Eye, EyeOff, Bot, Mail, Send, Plus, Zap, CheckCircle2, XCircle, MessageSquareText } from "lucide-react";
import { apiClient } from "@grow/shared/api-client";
import { AppConfig, OpenAIInstance } from "@grow/shared/types/api";
import { ModelSelector } from "@/components/ui/model-selector";
import { PromptSettings } from "@/components/settings/prompt-settings";
import { alertDialog, confirmDialog } from "@/components/ui/app-dialog";

const MAX_OPENAI_INSTANCES = 10;

// 生成唯一 ID
function generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export default function AdminSettingsPage() {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [config, setConfig] = useState<AppConfig>({ aiProvider: 'gemini' });
    // OpenAI 多实例状态
    const [selectedInstanceId, setSelectedInstanceId] = useState<string | undefined>(undefined);

    // AI 连接测试状态
    const [testing, setTesting] = useState(false);
    const [smtpTesting, setSmtpTesting] = useState(false);
    const [smtpTestResult, setSmtpTestResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [testResult, setTestResult] = useState<{
        success: boolean;
        textSupport: boolean;
        visionSupport: boolean;
        textError?: string;
        visionError?: string;
        modelInfo?: string;
    } | null>(null);

    useEffect(() => {
        fetchSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const data = await apiClient.get<AppConfig>("/api/settings");
            setConfig(data);
        } catch (error) {
            await alertDialog({ description: "加载配置失败，请刷新重试" });
        } finally {
            setLoading(false);
        }
    };

    // 验证 OpenAI 实例必填字段
    const validateOpenAIInstances = (): string | null => {
        if (config.aiProvider !== 'openai') return null;
        const instances = config.openai?.instances || [];
        for (const instance of instances) {
            if (!instance.name?.trim()) return '实例名称不能为空';
            if (!instance.apiKey?.trim()) return 'API Key 不能为空';
            if (!instance.baseUrl?.trim()) return 'Base URL 不能为空';
            if (!instance.model?.trim()) return '模型名称不能为空';
        }
        return null;
    };

    // 验证 Azure OpenAI 必填字段
    const validateAzureConfig = (): string | null => {
        if (config.aiProvider !== 'azure') return null;
        if (!config.azure?.endpoint?.trim()) return 'Azure Endpoint 不能为空';
        if (!config.azure?.deploymentName?.trim()) return 'Deployment Name 不能为空';
        if (!config.azure?.apiKey?.trim()) return 'API Key 不能为空';
        return null;
    };

    /** 更新邮件通知表单（smtp 节整体合并） */
    const updateSmtp = (patch: Partial<NonNullable<AppConfig["smtp"]>>) => {
        setConfig(prev => ({
            ...prev,
            smtp: { host: "", user: "", pass: "", ...(prev.smtp || {}), ...patch },
        }));
    };

    /** 用当前表单值（未保存也可）发送测试邮件 */
    const handleSmtpTest = async () => {
        setSmtpTesting(true);
        setSmtpTestResult(null);
        try {
            const res = await apiClient.post<{ ok: boolean; message: string }>("/api/settings/smtp-test", {
                smtp: config.smtp,
            });
            setSmtpTestResult(res);
        } catch (e: any) {
            setSmtpTestResult({ ok: false, message: e?.message || "测试请求失败" });
        } finally {
            setSmtpTesting(false);
        }
    };

    const handleSaveSettings = async () => {
        const openaiValidationError = validateOpenAIInstances();
        if (openaiValidationError) {
            await alertDialog({ description: openaiValidationError });
            return;
        }

        const azureValidationError = validateAzureConfig();
        if (azureValidationError) {
            await alertDialog({ description: azureValidationError });
            return;
        }

        setSaving(true);
        try {
            await apiClient.post("/api/settings", config);
            await alertDialog({ description: "设置已保存" });
        } catch (error) {
            await alertDialog({ description: "保存失败，请重试" });
        } finally {
            setSaving(false);
        }
    };

    const updateConfig = (section: 'openai' | 'gemini', key: string, value: string) => {
        if (section === 'gemini') {
            setConfig(prev => ({
                ...prev,
                gemini: {
                    ...prev.gemini,
                    [key]: value
                }
            }));
        }
    };

    // 获取当前选中的 OpenAI 实例
    const getSelectedInstance = (): OpenAIInstance | undefined => {
        const instances = config.openai?.instances || [];
        const activeId = selectedInstanceId || config.openai?.activeInstanceId;
        return instances.find(i => i.id === activeId);
    };

    // 更新当前选中的 OpenAI 实例属性
    const updateOpenAIInstance = (key: keyof OpenAIInstance, value: string) => {
        const instances = config.openai?.instances || [];
        const activeId = selectedInstanceId || config.openai?.activeInstanceId;
        const updatedInstances = instances.map(instance =>
            instance.id === activeId ? { ...instance, [key]: value } : instance
        );
        setConfig(prev => ({
            ...prev,
            openai: {
                ...prev.openai,
                instances: updatedInstances,
            }
        }));
    };

    // 添加新的 OpenAI 实例
    const addOpenAIInstance = () => {
        const instances = config.openai?.instances || [];
        if (instances.length >= MAX_OPENAI_INSTANCES) return;

        const newInstance: OpenAIInstance = {
            id: generateId(),
            name: `Instance ${instances.length + 1}`,
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4o',
        };

        setConfig(prev => ({
            ...prev,
            openai: {
                instances: [...(prev.openai?.instances || []), newInstance],
                activeInstanceId: newInstance.id,
            }
        }));
        setSelectedInstanceId(newInstance.id);
    };

    // 删除 OpenAI 实例
    const deleteOpenAIInstance = (instanceId: string) => {
        const instances = config.openai?.instances || [];
        const updatedInstances = instances.filter(i => i.id !== instanceId);
        const newActiveId = updatedInstances.length > 0 ? updatedInstances[0].id : undefined;

        setConfig(prev => ({
            ...prev,
            openai: {
                instances: updatedInstances,
                activeInstanceId: newActiveId,
            }
        }));
        setSelectedInstanceId(newActiveId);
    };

    // 切换激活的 OpenAI 实例
    const setActiveOpenAIInstance = (instanceId: string) => {
        setSelectedInstanceId(instanceId);
        setConfig(prev => ({
            ...prev,
            openai: {
                ...prev.openai,
                activeInstanceId: instanceId,
            }
        }));
    };

    // 同步 selectedInstanceId 与 config
    useEffect(() => {
        if (config.openai?.activeInstanceId && !selectedInstanceId) {
            setSelectedInstanceId(config.openai.activeInstanceId);
        }
    }, [config.openai?.activeInstanceId, selectedInstanceId]);

    const updatePrompts = (type: 'analyze' | 'similar', value: string) => {
        setConfig(prev => ({
            ...prev,
            prompts: {
                ...prev.prompts,
                [type]: value
            }
        }));
    };

    // 测试 AI 连接
    const handleTestConnection = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            let requestBody: Record<string, unknown>;
            if (config.aiProvider === 'openai') {
                const instance = getSelectedInstance();
                if (!instance?.apiKey) {
                    setTestResult({ success: false, textSupport: false, visionSupport: false, textError: 'API Key 不能为空' });
                    setTesting(false);
                    return;
                }
                requestBody = {
                    provider: 'openai',
                    apiKey: instance.apiKey,
                    baseUrl: instance.baseUrl,
                    model: instance.model,
                    language: 'zh'
                };
            } else if (config.aiProvider === 'gemini') {
                if (!config.gemini?.apiKey) {
                    setTestResult({ success: false, textSupport: false, visionSupport: false, textError: 'API Key 不能为空' });
                    setTesting(false);
                    return;
                }
                requestBody = {
                    provider: 'gemini',
                    apiKey: config.gemini.apiKey,
                    baseUrl: config.gemini.baseUrl,
                    model: config.gemini.model,
                    language: 'zh'
                };
            } else if (config.aiProvider === 'azure') {
                if (!config.azure?.apiKey || !config.azure?.endpoint || !config.azure?.deploymentName) {
                    setTestResult({ success: false, textSupport: false, visionSupport: false, textError: 'Azure 配置不完整' });
                    setTesting(false);
                    return;
                }
                requestBody = {
                    provider: 'azure',
                    apiKey: config.azure.apiKey,
                    endpoint: config.azure.endpoint,
                    deploymentName: config.azure.deploymentName,
                    apiVersion: config.azure.apiVersion,
                    model: config.azure.model,
                    language: 'zh'
                };
            } else {
                setTesting(false);
                return;
            }

            const response = await apiClient.post<{
                success: boolean;
                textSupport: boolean;
                visionSupport: boolean;
                textError?: string;
                visionError?: string;
                modelInfo?: string;
            }>('/api/ai/test', requestBody);

            setTestResult(response);
        } catch (error) {
            setTestResult({
                success: false,
                textSupport: false,
                visionSupport: false,
                textError: error instanceof Error ? error.message : String(error)
            });
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="space-y-4 max-w-4xl">
            <h1 className="text-2xl font-bold">系统设置</h1>

            <Tabs defaultValue="ai" className="w-full">
                <TabsList className="grid w-full grid-cols-3 sm:grid-cols-3 gap-1 h-auto">
                    <TabsTrigger value="ai" className="px-2 sm:px-3">
                        <Bot className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">AI 供应商</span>
                    </TabsTrigger>
                    <TabsTrigger value="prompts" className="px-2 sm:px-3">
                        <MessageSquareText className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Prompts</span>
                    </TabsTrigger>
                    <TabsTrigger value="email" className="px-2 sm:px-3">
                        <Mail className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">邮件通知</span>
                    </TabsTrigger>
                </TabsList>

                {/* AI Tab */}
                <TabsContent value="ai" className="space-y-4 py-4">
                    {loading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="space-y-4 border rounded-lg p-4 bg-white">
                            <div className="space-y-2">
                                <Label>AI 供应商</Label>
                                <Select
                                    value={config.aiProvider}
                                    onValueChange={(val: 'gemini' | 'openai' | 'azure') => setConfig(prev => ({ ...prev, aiProvider: val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="gemini">Google Gemini</SelectItem>
                                        <SelectItem value="openai">OpenAI / Compatible</SelectItem>
                                        <SelectItem value="azure">Azure OpenAI</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {config.aiProvider === 'openai' && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    {/* 实例选择器 */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>实例</Label>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={addOpenAIInstance}
                                                disabled={(config.openai?.instances?.length || 0) >= MAX_OPENAI_INSTANCES}
                                                className="h-7 px-2 text-xs"
                                            >
                                                <Plus className="h-3 w-3 mr-1" />
                                                添加
                                            </Button>
                                        </div>
                                        {(config.openai?.instances?.length || 0) > 0 ? (
                                            <div className="flex gap-2">
                                                <Select
                                                    value={selectedInstanceId || config.openai?.activeInstanceId || ''}
                                                    onValueChange={setActiveOpenAIInstance}
                                                >
                                                    <SelectTrigger className="flex-1">
                                                        <SelectValue placeholder="选择实例" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {(config.openai?.instances || []).map((instance) => (
                                                            <SelectItem key={instance.id} value={instance.id}>
                                                                {instance.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {(config.openai?.instances?.length || 0) > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={async () => {
                                                            const activeId = selectedInstanceId || config.openai?.activeInstanceId;
                                                            if (activeId && await confirmDialog({ description: '确定删除此实例？', danger: true })) {
                                                                deleteOpenAIInstance(activeId);
                                                            }
                                                        }}
                                                        className="h-10 w-10 text-destructive hover:text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                尚未配置实例，点击「添加」创建一个。
                                            </p>
                                        )}
                                        {(config.openai?.instances?.length || 0) >= MAX_OPENAI_INSTANCES && (
                                            <p className="text-xs text-amber-600">
                                                已达实例上限（10）
                                            </p>
                                        )}
                                    </div>

                                    {/* 实例配置表单 */}
                                    {getSelectedInstance() && (
                                        <div className="space-y-3 p-3 border rounded-md bg-background">
                                            <div className="space-y-2">
                                                <Label>实例名称 <span className="text-destructive">*</span></Label>
                                                <Input
                                                    value={getSelectedInstance()?.name || ''}
                                                    onChange={(e) => updateOpenAIInstance('name', e.target.value)}
                                                    placeholder="e.g. 智谱 GLM-4V"
                                                    className={!getSelectedInstance()?.name?.trim() ? 'border-destructive' : ''}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>API Key <span className="text-destructive">*</span></Label>
                                                <div className="relative">
                                                    <Input
                                                        type={showApiKey ? "text" : "password"}
                                                        value={getSelectedInstance()?.apiKey || ''}
                                                        onChange={(e) => updateOpenAIInstance('apiKey', e.target.value)}
                                                        placeholder="sk-..."
                                                        className={`pr-10 ${!getSelectedInstance()?.apiKey?.trim() ? 'border-destructive' : ''}`}
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
                                            <div className="space-y-2 pt-4 border-t">
                                                <Label>Base URL <span className="text-destructive">*</span></Label>
                                                <Input
                                                    value={getSelectedInstance()?.baseUrl || ''}
                                                    onChange={(e) => updateOpenAIInstance('baseUrl', e.target.value)}
                                                    placeholder="https://api.openai.com/v1"
                                                    className={!getSelectedInstance()?.baseUrl?.trim() ? 'border-destructive' : ''}
                                                />
                                            </div>
                                            <ModelSelector
                                                provider="openai"
                                                apiKey={getSelectedInstance()?.apiKey}
                                                baseUrl={getSelectedInstance()?.baseUrl}
                                                currentModel={getSelectedInstance()?.model}
                                                onModelChange={(model) => updateOpenAIInstance('model', model)}
                                            />
                                        </div>
                                    )}
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
                                        <Label>Base URL（可选）</Label>
                                        <Input
                                            value={config.gemini?.baseUrl || ''}
                                            onChange={(e) => updateConfig('gemini', 'baseUrl', e.target.value)}
                                            placeholder="https://generativelanguage.googleapis.com"
                                        />
                                    </div>
                                    <ModelSelector
                                        provider="gemini"
                                        apiKey={config.gemini?.apiKey}
                                        baseUrl={config.gemini?.baseUrl}
                                        currentModel={config.gemini?.model}
                                        onModelChange={(model) => updateConfig('gemini', 'model', model)}
                                    />
                                </div>
                            )}

                            {config.aiProvider === 'azure' && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <div className="space-y-2">
                                        <Label>Azure Endpoint <span className="text-destructive">*</span></Label>
                                        <Input
                                            value={config.azure?.endpoint || ''}
                                            onChange={(e) => setConfig(prev => ({ ...prev, azure: { ...prev.azure, endpoint: e.target.value } }))}
                                            placeholder="https://your-resource.openai.azure.com"
                                            className={!config.azure?.endpoint?.trim() ? 'border-destructive' : ''}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Deployment Name <span className="text-destructive">*</span></Label>
                                        <Input
                                            value={config.azure?.deploymentName || ''}
                                            onChange={(e) => setConfig(prev => ({ ...prev, azure: { ...prev.azure, deploymentName: e.target.value } }))}
                                            placeholder="gpt-4o-deployment"
                                            className={!config.azure?.deploymentName?.trim() ? 'border-destructive' : ''}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>API Key <span className="text-destructive">*</span></Label>
                                        <div className="relative">
                                            <Input
                                                type={showApiKey ? "text" : "password"}
                                                value={config.azure?.apiKey || ''}
                                                onChange={(e) => setConfig(prev => ({ ...prev, azure: { ...prev.azure, apiKey: e.target.value } }))}
                                                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                                className={`pr-10 ${!config.azure?.apiKey?.trim() ? 'border-destructive' : ''}`}
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
                                        <Label>API Version</Label>
                                        <Input
                                            value={config.azure?.apiVersion || ''}
                                            onChange={(e) => setConfig(prev => ({ ...prev, azure: { ...prev.azure, apiVersion: e.target.value } }))}
                                            placeholder="2024-02-15-preview"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>模型显示名</Label>
                                        <Input
                                            value={config.azure?.model || ''}
                                            onChange={(e) => setConfig(prev => ({ ...prev, azure: { ...prev.azure, model: e.target.value } }))}
                                            placeholder="gpt-4o"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* 测试连接和保存按钮 */}
                            <div className="space-y-3 pt-3 border-t">
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleTestConnection}
                                        disabled={testing || saving}
                                        className="flex-1"
                                    >
                                        {testing ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Zap className="mr-2 h-4 w-4" />
                                        )}
                                        {testing ? "测试中..." : "测试连接"}
                                    </Button>
                                    <Button onClick={handleSaveSettings} disabled={saving || testing} className="flex-1">
                                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        保存 AI 设置
                                    </Button>
                                </div>

                                {/* 测试结果显示 */}
                                {testResult && (
                                    <div className={`p-3 rounded-md text-sm ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                        <div className="flex items-center gap-2 font-medium mb-2">
                                            {testResult.success ? (
                                                <>
                                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                    <span className="text-green-700">连接成功</span>
                                                    {testResult.modelInfo && <span className="text-green-600 text-xs">({testResult.modelInfo})</span>}
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle className="h-4 w-4 text-red-600" />
                                                    <span className="text-red-700">连接失败</span>
                                                </>
                                            )}
                                        </div>
                                        {testResult.success && (
                                            <div className="space-y-1 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">文本生成:</span>
                                                    <span className="text-green-600">✓ 支持</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">图像识别/多模态:</span>
                                                    {testResult.visionSupport ? (
                                                        <span className="text-green-600">✓ 支持</span>
                                                    ) : (
                                                        <span className="text-amber-600">✗ {
                                                            testResult.visionError
                                                                ? testResult.visionError.replace('UNKNOWN:', '')
                                                                : "不支持"
                                                        }</span>
                                                    )}
                                                </div>
                                                <p className="text-muted-foreground/60 text-[10px] pl-1">* 由于网络问题，可能测试结果不准确</p>
                                            </div>
                                        )}
                                        {!testResult.success && testResult.textError && (
                                            <p className="text-red-600 text-xs mt-1">{testResult.textError.replace('UNKNOWN:', '')}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </TabsContent>

                {/* Prompts Tab */}
                <TabsContent value="prompts" className="space-y-4 py-4">
                    <PromptSettings config={config} onUpdate={updatePrompts} />
                    <Button onClick={handleSaveSettings} disabled={saving} className="w-full">
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        保存 Prompt 设置
                    </Button>
                </TabsContent>

                {/* Email Notification Tab */}
                <TabsContent value="email" className="space-y-4 py-4">
                    <div className="space-y-4 border rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <Label>启用反馈邮件通知</Label>
                                <p className="text-xs text-muted-foreground mt-1">
                                    用户在"帮助与反馈"提交内容后，立即推送到你的邮箱；关闭后仅保存配置
                                </p>
                            </div>
                            <Switch
                                checked={config.smtp?.enabled !== false}
                                onCheckedChange={(v) => updateSmtp({ enabled: v })}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>SMTP 主机</Label>
                                <Input
                                    placeholder="smtp.qq.com / smtp.163.com"
                                    value={config.smtp?.host || ""}
                                    onChange={(e) => updateSmtp({ host: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>端口</Label>
                                <Input
                                    type="number"
                                    placeholder="465（SSL）或 587（STARTTLS）"
                                    value={config.smtp?.port ?? ""}
                                    onChange={(e) => updateSmtp({ port: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>发件邮箱账号</Label>
                                <Input
                                    placeholder="you@qq.com"
                                    value={config.smtp?.user || ""}
                                    onChange={(e) => updateSmtp({ user: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>授权码 / 密码</Label>
                                <Input
                                    type="password"
                                    placeholder="邮箱设置里生成的 SMTP 授权码"
                                    value={config.smtp?.pass || ""}
                                    onChange={(e) => updateSmtp({ pass: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>收件邮箱（可选）</Label>
                                <Input
                                    placeholder="缺省发到发件邮箱自己"
                                    value={config.smtp?.to || ""}
                                    onChange={(e) => updateSmtp({ to: e.target.value || undefined })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>加密方式</Label>
                                <div className="flex items-center gap-2 h-10">
                                    <Switch
                                        checked={config.smtp?.secure ?? true}
                                        onCheckedChange={(v) => updateSmtp({ secure: v })}
                                    />
                                    <span className="text-sm text-muted-foreground">
                                        {(config.smtp?.secure ?? true) ? "SSL（465 端口）" : "STARTTLS / 不加密"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button variant="outline" onClick={handleSmtpTest} disabled={smtpTesting}>
                                {smtpTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                发送测试邮件
                            </Button>
                            {smtpTestResult && (
                                <span className={`text-sm ${(smtpTestResult as any).ok ? "text-green-600" : "text-destructive"}`}>
                                    {(smtpTestResult as any).ok ? "✓ " : "✗ "}{(smtpTestResult as any).message}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            QQ/163 邮箱需在邮箱设置中开启 SMTP 服务并生成授权码；测试成功后记得点下方保存。
                        </p>
                    </div>
                    <Button onClick={handleSaveSettings} disabled={saving} className="w-full">
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        保存设置
                    </Button>
                </TabsContent>
            </Tabs>
        </div>
    );
}
