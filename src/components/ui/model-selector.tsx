"use client";

import { useState } from "react";
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
import { RefreshCw, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { AIModel, ModelsResponse } from "@/types/api";

interface ModelSelectorProps {
    provider: 'openai' | 'gemini';
    apiKey?: string;
    baseUrl?: string;
    currentModel?: string;
    onModelChange: (model: string) => void;
}

export function ModelSelector({ provider, apiKey, baseUrl, currentModel, onModelChange }: ModelSelectorProps) {
    const [models, setModels] = useState<AIModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [customModel, setCustomModel] = useState(currentModel || '');
    const [useCustom, setUseCustom] = useState(false);

    const fetchModels = async () => {
        if (!apiKey) {
            setError("请先填写API Key");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                provider,
                apiKey,
                ...(baseUrl && { baseUrl }),
            });

            const data = await apiClient.get<ModelsResponse>(`/api/ai/models?${params}`);

            // Check if there's an error message in the response
            if ('error' in data && typeof data.error === 'string') {
                setError(data.error);
                setUseCustom(true);
                setModels([]);
                return;
            }

            setModels(data.models);

            if (data.models.length === 0) {
                setError("未找到支持vision的模型，请手动输入");
                setUseCustom(true);
            }
        } catch (err: any) {
            console.error("Failed to fetch models:", err);
            const errorMsg = err?.message || "获取模型列表失败";
            setError(errorMsg + "，请手动输入");
            setUseCustom(true);
        } finally {
            setLoading(false);
        }
    };

    const handleModelSelect = (modelId: string) => {
        if (modelId === '_custom') {
            setUseCustom(true);
        } else {
            setUseCustom(false);
            setCustomModel(modelId);
            onModelChange(modelId);
        }
    };

    const handleCustomModelChange = (value: string) => {
        setCustomModel(value);
        onModelChange(value);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Label className="flex-1">模型名称</Label>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchModels}
                    disabled={loading || !apiKey}
                >
                    {loading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                        <RefreshCw className="h-3 w-3" />
                    )}
                </Button>
            </div>

            {error && (
                <p className="text-xs text-yellow-600">{error}</p>
            )}

            {useCustom || models.length === 0 ? (
                <div className="space-y-2">
                    <Input
                        value={customModel}
                        onChange={(e) => handleCustomModelChange(e.target.value)}
                        placeholder={provider === 'openai' ? "gpt-4o" : "gemini-1.5-flash"}
                    />
                    {models.length > 0 && (
                        <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => setUseCustom(false)}
                        >
                            从列表中选择
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    <Select
                        value={currentModel}
                        onValueChange={handleModelSelect}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="选择模型" />
                        </SelectTrigger>
                        <SelectContent>
                            {models.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                    {model.name}
                                    {model.owned_by && ` (${model.owned_by})`}
                                </SelectItem>
                            ))}
                            <SelectItem value="_custom">自定义输入...</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );
}
