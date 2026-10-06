"use client";

/**
 * 整页题目框选弹层：把 AI 定位到的题目框（百分比 bbox）叠加在原图上，
 * 点击某个框裁出该题进入单题识别；无题号/定位失败时由父级回退自由裁剪。
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";

export interface DetectedBox {
    number: number;
    label?: string;
    bbox: { x1: number; y1: number; x2: number; y2: number };
}

interface QuestionBoxPickerProps {
    imageSrc: string;
    questions: DetectedBox[];
    open: boolean;
    onClose: () => void;
    onSelect: (bbox: DetectedBox["bbox"]) => void;
    onFreeCrop: () => void;
}

export function QuestionBoxPicker({
    imageSrc,
    questions,
    open,
    onClose,
    onSelect,
    onFreeCrop,
}: QuestionBoxPickerProps) {
    const { t } = useLanguage();

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 gap-0" aria-describedby={undefined}>
                <DialogHeader className="p-4 border-b shrink-0">
                    <DialogTitle>{t.common.detect?.title || "选择要识别的题"}</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-auto bg-black/90 flex items-center justify-center p-4">
                    <div className="relative inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={imageSrc}
                            alt="questions page"
                            className="block max-h-[62vh] max-w-full"
                        />
                        <div className="absolute inset-0">
                            {questions.map((q, i) => (
                                <button
                                    key={`${q.number}-${i}`}
                                    type="button"
                                    className="absolute border-2 border-dashed border-blue-600 bg-blue-500/15 hover:bg-blue-500/35 hover:border-solid rounded transition-colors flex items-start justify-start cursor-pointer"
                                    style={{
                                        left: `${q.bbox.x1}%`,
                                        top: `${q.bbox.y1}%`,
                                        width: `${q.bbox.x2 - q.bbox.x1}%`,
                                        height: `${q.bbox.y2 - q.bbox.y1}%`,
                                    }}
                                    onClick={() => onSelect(q.bbox)}
                                >
                                    <span className="bg-blue-600 text-white text-xs leading-none px-1.5 py-1 rounded-br rounded-tl">
                                        {q.label || `#${q.number}`}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-background shrink-0 flex justify-between items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                        {t.common.detect?.hint || "点击题号框识别该题，也可自由框选"}
                    </p>
                    <div className="flex gap-2 shrink-0">
                        <Button variant="outline" onClick={onClose}>
                            {t.common.cancel || "Cancel"}
                        </Button>
                        <Button variant="outline" onClick={onFreeCrop}>
                            {t.common.detect?.freeCrop || "自由框选"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
