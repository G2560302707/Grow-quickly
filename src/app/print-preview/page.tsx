"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { format } from "date-fns";
import Image from "next/image";
import { apiClient } from "@/lib/api-client";
import { ErrorItem } from "@/types/api";
import { useLanguage } from "@/contexts/LanguageContext";

function PrintPreviewContent() {
    const searchParams = useSearchParams();
    const { t } = useLanguage();
    const [items, setItems] = useState<ErrorItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAnswers, setShowAnswers] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [showTags, setShowTags] = useState(false);
    const [imageScale, setImageScale] = useState(70);
    const [showQuestionText, setShowQuestionText] = useState(false);

    useEffect(() => {
        fetchItems();
    }, []);
    const fetchItems = async () => {
        try {
            const params = new URLSearchParams(searchParams.toString());
            const data = await apiClient.get<ErrorItem[]>(`/api/error-items/list?${params.toString()}`);
            setItems(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-muted-foreground">{t.common.loading}</p>
            </div>
        );
    }

    return (
        <>
            {/* Print Controls - Hidden when printing */}
            <div className="print:hidden sticky top-0 z-10 bg-background border-b p-4 shadow-sm">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <h1 className="text-xl font-bold whitespace-nowrap">{t.printPreview?.title || 'Print Preview'} ({items.length} {t.notebooks?.items || 'items'})</h1>
                    <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-center md:justify-end">
                        {/* Image Scale Control */}
                        <div className="flex items-center gap-2 text-sm bg-muted/50 px-3 py-1.5 rounded-md">
                            <span className="whitespace-nowrap">{t.printPreview?.imageScale || 'Image Scale'}: {imageScale}%</span>
                            <input
                                type="range"
                                min="30"
                                max="100"
                                value={imageScale}
                                onChange={(e) => setImageScale(Number(e.target.value))}
                                className="w-20 md:w-24 accent-primary"
                            />
                        </div>

                        <div className="flex items-center gap-4 bg-muted/50 px-3 py-1.5 rounded-md">
                            <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap hover:text-primary transition-colors">
                                <input
                                    type="checkbox"
                                    checked={showQuestionText}
                                    onChange={(e) => setShowQuestionText(e.target.checked)}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                {t.printPreview?.showQuestionText || 'Question Text'}
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap hover:text-primary transition-colors">
                                <input
                                    type="checkbox"
                                    checked={showAnswers}
                                    onChange={(e) => setShowAnswers(e.target.checked)}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                {t.printPreview?.showAnswers || 'Show Answers'}
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap hover:text-primary transition-colors">
                                <input
                                    type="checkbox"
                                    checked={showAnalysis}
                                    onChange={(e) => setShowAnalysis(e.target.checked)}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                {t.printPreview?.showAnalysis || 'Show Analysis'}
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap hover:text-primary transition-colors">
                                <input
                                    type="checkbox"
                                    checked={showTags}
                                    onChange={(e) => setShowTags(e.target.checked)}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                {t.printPreview?.showTags || 'Show Tags'}
                            </label>
                        </div>

                        <Button onClick={handlePrint} className="whitespace-nowrap ml-2">
                            {t.printPreview?.printButton || 'Print / Save PDF'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Print Content */}
            <div className="max-w-4xl mx-auto p-8 print:p-0">
                {items.map((item, index) => {
                    // 优先使用 tags 关联，回退到 knowledgePoints
                    let tags: string[] = [];
                    if ((item as any).tags && (item as any).tags.length > 0) {
                        tags = (item as any).tags.map((t: any) => t.name);
                    } else {
                        try {
                            tags = JSON.parse(item.knowledgePoints || "[]");
                        } catch (e) {
                            tags = [];
                        }
                    }

                    return (
                        <div
                            key={item.id}
                            className="mb-8 pb-8 border-b last:border-b-0 print:break-inside-avoid"
                        >
                            {/* Question Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-bold">{t.printPreview?.questionNumber?.replace('{num}', String(index + 1)) || `Question ${index + 1}`}</span>
                                    {item.subject && (
                                        <span className="text-sm text-muted-foreground">
                                            {item.subject.name}
                                        </span>
                                    )}
                                    {item.gradeSemester && (
                                        <span className="text-sm text-muted-foreground">
                                            {item.gradeSemester}
                                        </span>
                                    )}
                                    {item.paperLevel && (
                                        <span className="text-sm text-muted-foreground">
                                            {t.printPreview?.paperLevel || 'Paper Level'}: {item.paperLevel.toUpperCase()}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Original Image or Text */}
                            {showQuestionText && item.questionText ? (
                                <div className="mb-4">
                                    <MarkdownRenderer content={item.questionText} />
                                </div>
                            ) : (
                                item.originalImageUrl && (
                                    <div className="mb-4">
                                        <img
                                            src={item.originalImageUrl}
                                            alt={t.detail?.originalProblem || 'Question Image'}
                                            className="h-auto border rounded"
                                            style={{ maxWidth: `${imageScale}%` }}
                                        />
                                    </div>
                                )
                            )}



                            {/* Knowledge Points */}
                            {showTags && tags.length > 0 && (
                                <div className="mb-4">
                                    <h3 className="font-semibold mb-2">{t.printPreview?.knowledgePoints || 'Knowledge Points'}:</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="px-2 py-1 bg-muted rounded text-sm"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Answer */}
                            {showAnswers && item.answerText && (
                                <div className="mb-4">
                                    <h3 className="font-semibold mb-2">{t.printPreview?.referenceAnswer || 'Reference Answer'}:</h3>
                                    <MarkdownRenderer content={item.answerText} />
                                </div>
                            )}

                            {/* Analysis */}
                            {showAnalysis && item.analysis && (
                                <div className="mb-4">
                                    <h3 className="font-semibold mb-2">{t.printPreview?.analysis || 'Analysis'}:</h3>
                                    <MarkdownRenderer content={item.analysis} />
                                </div>
                            )}
                        </div>
                    );
                })}

                {items.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        {t.printPreview?.noItems || 'No matching error items'}
                    </div>
                )}
            </div>
        </>
    );
}

export default function PrintPreviewPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <PrintPreviewContent />
        </Suspense>
    );
}
