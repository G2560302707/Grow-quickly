"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { UploadCloud, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface UploadZoneProps {
    onImageSelect: (file: File) => void;  // 改为传递 File 对象
    isAnalyzing: boolean;
}

export function UploadZone({ onImageSelect, isAnalyzing }: UploadZoneProps) {
    const { t } = useLanguage();

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            const file = acceptedFiles[0];
            if (file) {
                // 直接传递 File 对象，让父组件处理压缩
                onImageSelect(file);
            }
        },
        [onImageSelect]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "image/*": [".jpeg", ".jpg", ".png"],
        },
        maxFiles: 1,
        disabled: isAnalyzing,
    });

    return (
        <Card
            {...getRootProps()}
            className={`border-2 border-dashed cursor-pointer transition-colors hover:border-primary/50 ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                }`}
        >
            <CardContent className="flex flex-col items-center justify-center py-12 space-y-4 text-center min-h-[300px]">
                <input {...getInputProps()} />
                <div className="p-4 bg-muted rounded-full">
                    {isAnalyzing ? (
                        <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    ) : (
                        <UploadCloud className="h-10 w-10 text-muted-foreground" />
                    )}
                </div>
                <div className="space-y-1">
                    <h3 className="font-semibold text-lg">
                        {isAnalyzing ? t.app.analyzing : t.upload.analyze}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {isAnalyzing ? t.app.analyzing : t.app.dragDrop}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                        {t.upload.support}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
