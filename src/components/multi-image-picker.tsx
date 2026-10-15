"use client";

/**
 * 多图拼接预览组件（单题跨多张）
 * 展示待拼接的多张照片：序号、顺序调整（上移/下移）、删除、继续添加、触发合并识别。
 * 拼接动作本身在服务端完成（/api/analyze images[]），这里只负责把多张图按顺序组织好。
 */
import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, X, Plus, Combine } from "lucide-react";

export const MAX_MULTI_IMAGES = 5;

export interface MultiImageItem {
    id: string;
    file: File;
    previewUrl: string;
}

interface MultiImagePickerProps {
    images: MultiImageItem[];
    isAnalyzing: boolean;
    onRemove: (id: string) => void;
    onMove: (id: string, direction: -1 | 1) => void;
    onAddMore: (files: File[]) => void;
    onAnalyze: () => void;
    onCancel: () => void;
}

export function MultiImagePicker({
    images,
    isAnalyzing,
    onRemove,
    onMove,
    onAddMore,
    onAnalyze,
    onCancel,
}: MultiImagePickerProps) {
    const addMoreInputRef = useRef<HTMLInputElement>(null);
    const remaining = MAX_MULTI_IMAGES - images.length;

    const handleAddMore = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            onAddMore(files);
        }
        e.target.value = "";
    };

    return (
        <Card className="border-primary/40">
            <CardContent className="pt-5 space-y-4">
                <div>
                    <h3 className="font-semibold text-base">多图拼接（按顺序合并成一道完整题目）</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        已选 {images.length}/{MAX_MULTI_IMAGES} 张，将按 1→{images.length} 的顺序纵向拼接后整体识别。
                    </p>
                </div>

                {/* 缩略图列表 */}
                <div className="space-y-2">
                    {images.map((item, index) => (
                        <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-lg border bg-muted/40 p-2"
                        >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                                {index + 1}
                            </span>
                            <img
                                src={item.previewUrl}
                                alt={`第 ${index + 1} 张`}
                                className="h-16 w-12 shrink-0 rounded object-cover"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm">{item.file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {(item.file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={isAnalyzing || index === 0}
                                    onClick={() => onMove(item.id, -1)}
                                    aria-label="上移"
                                    title="上移"
                                >
                                    <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={isAnalyzing || index === images.length - 1}
                                    onClick={() => onMove(item.id, 1)}
                                    aria-label="下移"
                                    title="下移"
                                >
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    disabled={isAnalyzing}
                                    onClick={() => onRemove(item.id)}
                                    aria-label="删除"
                                    title="删除"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 操作区 */}
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        ref={addMoreInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleAddMore}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isAnalyzing || remaining <= 0}
                        onClick={() => addMoreInputRef.current?.click()}
                    >
                        <Plus className="h-4 w-4" />
                        添加更多{remaining > 0 ? `（还可加 ${remaining} 张）` : ""}
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        disabled={isAnalyzing || images.length < 2}
                        onClick={onAnalyze}
                        className="ml-auto"
                    >
                        <Combine className="h-4 w-4" />
                        {isAnalyzing ? "拼接识别中..." : "合并并识别"}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isAnalyzing}
                        onClick={onCancel}
                    >
                        清空重选
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
