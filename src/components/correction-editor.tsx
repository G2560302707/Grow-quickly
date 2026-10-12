"use client";

import { useState, useEffect, useMemo } from "react";
import { ParsedQuestion } from "@grow/shared/ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, RefreshCw, Loader2, Box, AlertTriangle } from "lucide-react";
import { detectUncertainty } from "@grow/shared/ai/uncertainty";
import { useLanguage } from "@/contexts/LanguageContext";
import { frontendLogger } from "@/lib/frontend-logger";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { TagInput } from "@/components/tag-input";
import { NotebookSelector } from "@/components/notebook-selector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@grow/shared/api-client";
import { UserProfile, Notebook } from "@grow/shared/types/api";
import { inferSubjectFromName } from "@/lib/knowledge-tags";
import { normalizeMistakeStatusForSave, type MistakeStatus } from "@grow/shared/mistake-status";
import type { ReanswerQuestionResult } from "@grow/shared/ai/types";
import { buildReanswerRequestBody } from "@/lib/reanswer-request";
import { GeogebraDemo } from "@/components/geogebra-demo";

import { alertDialog } from "@/components/ui/app-dialog";

interface ParsedQuestionWithSubject extends ParsedQuestion {
    subjectId?: string;
    geogebraCommands?: string;
}

interface CorrectionEditorProps {
    initialData: ParsedQuestion;
    onSave: (data: ParsedQuestionWithSubject) => Promise<void>;
    onCancel: () => void;
    imagePreview?: string | null;
    initialSubjectId?: string;
    aiTimeout?: number;
}

type ReanswerErrorMessages = {
    default?: string;
    authError?: string;
    connectionFailed?: string;
    responseError?: string;
};

export function CorrectionEditor({ initialData, onSave, onCancel, imagePreview, initialSubjectId, aiTimeout }: CorrectionEditorProps) {
    const [data, setData] = useState<ParsedQuestionWithSubject>({
        ...initialData,
        wrongAnswerText: initialData.wrongAnswerText || "",
        mistakeAnalysis: initialData.mistakeAnalysis || "",
        mistakeStatus: initialData.mistakeStatus || "unknown",
        subjectId: initialSubjectId,
    });
    const { t, language } = useLanguage();
    const [isReanswering, setIsReanswering] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isAnalyzingGeogebra, setIsAnalyzingGeogebra] = useState(false);
    const [geogebraError, setGeogebraError] = useState<string | null>(null);

    const [educationStage, setEducationStage] = useState<string | undefined>(undefined);
    const [notebooks, setNotebooks] = useState<Notebook[]>([]);

    // 识别不确定度：AI 输出中的 [?]、「可能不完整」、「需人工核对」等标记，保存前提示用户对照原图核对
    const uncertainty = useMemo(
        () => detectUncertainty({
            questionText: data.questionText,
            answerText: data.answerText,
            analysis: data.analysis,
        }),
        [data.questionText, data.answerText, data.analysis]
    );



    // Fetch user info and calculate grade on mount
    useEffect(() => {
        // Fetch notebooks for mapping
        apiClient.get<Notebook[]>("/api/notebooks")
            .then(setNotebooks)
            .catch(err => console.error("Failed to fetch notebooks:", err));

        apiClient.get<UserProfile>("/api/user")
            .then(user => {
                if (user?.educationStage) {
                    setEducationStage(user.educationStage);
                }
            })
            .catch(err => console.error("Failed to fetch user info:", err));
    }, []);

    // 重新解题函数
    const handleReanswer = async () => {
        if (!data.questionText.trim()) {
            await alertDialog({ description: t.editor.enterQuestionFirst || 'Please enter question text first' });
            return;
        }

        setIsReanswering(true);
        try {
            const requestBody = buildReanswerRequestBody({
                questionText: data.questionText,
                language,
                subject: data.subject,
                imagePreview,
            });

            if (requestBody.imageBase64) {
                console.log("[Reanswer] Sending image + text (Image available for mistake analysis)");
            } else {
                console.log("[Reanswer] Sending text only (No image available)");
            }

            frontendLogger.info('[Reanswer]', 'Sending request', { timeout: aiTimeout });

            const result = await apiClient.post<ReanswerQuestionResult>("/api/reanswer", requestBody, { timeout: aiTimeout || 180000 });

            setData(prev => ({
                ...prev,
                answerText: result.answerText,
                analysis: result.analysis,
                knowledgePoints: result.knowledgePoints,
                wrongAnswerText: result.wrongAnswerText || "",
                mistakeAnalysis: result.mistakeAnalysis || "",
                mistakeStatus: normalizeMistakeStatusForSave(
                    result.mistakeStatus,
                    result.wrongAnswerText
                ),
            }));

            await alertDialog({ description: t.editor.reanswerSuccess || '✅ Answer and analysis updated!' });
        } catch (error: unknown) {
            console.error("Reanswer failed:", error);
            const apiError = error as { data?: { message?: string } };
            const msg = apiError.data?.message || '';

            const reanswerErrors: ReanswerErrorMessages = t.errors?.reanswer || {};
            let errorText = reanswerErrors.default || 'Reanswer failed';

            if (msg.includes('AI_AUTH_ERROR')) {
                errorText = reanswerErrors.authError || t.errors?.AI_AUTH_ERROR || errorText;
            } else if (msg.includes('AI_CONNECTION_FAILED')) {
                errorText = reanswerErrors.connectionFailed || t.errors?.AI_CONNECTION_FAILED || errorText;
            } else if (msg.includes('AI_RESPONSE_ERROR')) {
                errorText = reanswerErrors.responseError || t.errors?.AI_RESPONSE_ERROR || errorText;
            }

            await alertDialog({ description: errorText });

        } finally {
            setIsReanswering(false);
        }
    };

    const handleAnalyzeGeogebra = async () => {
        if (!data.questionText.trim()) {
            await alertDialog({ description: t.editor.enterQuestionFirst || '请先输入题目文本' });
            return;
        }
        if (!data.answerText.trim()) {
            await alertDialog({ description: '请先生成或输入答案' });
            return;
        }

        setIsAnalyzingGeogebra(true);
        setGeogebraError(null);
        try {
            const response = await fetch("/api/geogebra-analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    questionText: data.questionText,
                    answerText: data.answerText,
                    analysis: data.analysis,
                }),
            });

            if (!response.ok) {
                throw new Error("Analysis failed");
            }

            const result = await response.json();
            if (result.suitable && result.commands?.length > 0) {
                setData(prev => ({
                    ...prev,
                    geogebraCommands: JSON.stringify(result.commands),
                }));
            } else {
                setGeogebraError(result.description || "该题目不适合用 GeoGebra 演示");
            }
        } catch (error: any) {
            console.error("GeoGebra analysis failed:", error);
            setGeogebraError("分析失败，请稍后重试");
        } finally {
            setIsAnalyzingGeogebra(false);
        }
    };


    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">{t.editor.title}</h2>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={onCancel}>
                        {t.editor.cancel}
                    </Button>
                    <Button
                        onClick={async () => {
                            if (!data.subjectId) {
                                await alertDialog({ description: t.editor.messages?.selectNotebook || "Please select a notebook" });
                                return;
                            }
                            if (isSaving) return; // 防止重复点击
                            setIsSaving(true);
                            try {
                                await onSave({
                                    ...data,
                                    mistakeStatus: normalizeMistakeStatusForSave(
                                        data.mistakeStatus,
                                        data.wrongAnswerText
                                    ),
                                });
                            } finally {
                                setIsSaving(false);
                            }
                        }}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        {isSaving ? (t.common?.pleaseWait || "Please wait...") : t.editor.save}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* 左侧：编辑区 */}
                <div className="space-y-6">
                    {imagePreview && (
                        <Card>
                            <CardContent className="p-4">
                                <img src={imagePreview} alt="Original" className="w-full rounded-md" />
                            </CardContent>
                        </Card>
                    )}

                    <div className="space-y-2">
                        <Label>{t.editor.selectNotebook || "Select Notebook"}</Label>
                        <NotebookSelector
                            value={data.subjectId}
                            onChange={(id) => setData({ ...data, subjectId: id })}
                        />
                    </div>

                    {uncertainty.uncertain && (
                        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                            <p className="font-medium flex items-center gap-1.5">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                识别结果可能不准确，请对照原图核对
                            </p>
                            <ul className="mt-1.5 list-disc pl-5 space-y-0.5">
                                {uncertainty.signals.map((s) => (
                                    <li key={s.key}>{s.message}</li>
                                ))}
                            </ul>
                            <p className="mt-1.5 text-xs text-amber-700">
                                修正题目文本后点击下方「重新解答」，答案与解析会按修正后的题目重新生成。
                            </p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>{t.editor.question}</Label>
                        <Textarea
                            value={data.questionText}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setData({ ...data, questionText: e.target.value })}
                            className="min-h-[150px] font-mono text-sm"
                            placeholder={t.editor.placeholder || "Supports Markdown and LaTeX..."}
                        />
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleReanswer}
                            disabled={isReanswering || !data.questionText.trim()}
                            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium"
                        >
                            {isReanswering ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t.editor.reanswering || 'AI solving...'}
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    {t.editor.reanswer || '🔄 Reanswer (based on corrected question)'}
                                </>
                            )}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            {t.editor.reanswerHint || '💡 If the question was misrecognized, correct it and click to regenerate answer'}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>{t.editor.tags}</Label>
                        <TagInput
                            value={data.knowledgePoints}
                            onChange={(tags) => setData({ ...data, knowledgePoints: tags })}
                            placeholder={t.editor.tagsPlaceholder || "Enter knowledge tags..."}
                            enterHint={t.editor.createTagHint}
                            subject={inferSubjectFromName(notebooks.find(n => n.id === data.subjectId)?.name || null) || inferSubjectFromName(data.subject || null) || undefined}
                            gradeStage={educationStage}
                        />
                        <p className="text-xs text-muted-foreground">
                            {t.editor.tagsHint || "💡 Tag suggestions will appear as you type"}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>{t.editor.answer}</Label>
                        <Textarea
                            value={data.answerText}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setData({ ...data, answerText: e.target.value })}
                            className="min-h-[100px] font-mono text-sm"
                            placeholder={t.editor.placeholder || "Supports Markdown and LaTeX..."}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t.editor.analysis}</Label>
                        <Textarea
                            value={data.analysis}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setData({ ...data, analysis: e.target.value })}
                            className="min-h-[200px] font-mono text-sm"
                            placeholder={t.editor.placeholder || "Supports Markdown and LaTeX..."}
                        />
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t.editor.mistakeAnalysisTitle || "错因分析"}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>{t.editor.mistakeStatus || "作答状态"}</Label>
                                <Select
                                    value={data.mistakeStatus || "unknown"}
                                    onValueChange={(val) => setData({ ...data, mistakeStatus: val as MistakeStatus })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="not_attempted">{t.editor.mistakeStatuses?.notAttempted || "不会做"}</SelectItem>
                                        <SelectItem value="wrong_attempt">{t.editor.mistakeStatuses?.wrongAttempt || "做错了"}</SelectItem>
                                        <SelectItem value="unknown">{t.editor.mistakeStatuses?.unknown || "未判断"}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t.editor.wrongAnswerText || "错误解答原文"}</Label>
                                <Textarea
                                    value={data.wrongAnswerText || ""}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setData({
                                        ...data,
                                        wrongAnswerText: e.target.value,
                                        mistakeStatus: e.target.value.trim() ? "wrong_attempt" : data.mistakeStatus,
                                    })}
                                    className="min-h-[100px] font-mono text-sm"
                                    placeholder={t.editor.wrongAnswerPlaceholder || "如果图片里没有错误解答，可留空"}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t.editor.mistakeAnalysis || "错因分析"}</Label>
                                <Textarea
                                    value={data.mistakeAnalysis || ""}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setData({
                                        ...data,
                                        mistakeAnalysis: e.target.value,
                                    })}
                                    className="min-h-[140px] font-mono text-sm"
                                    placeholder={t.editor.mistakeAnalysisPlaceholder || "分析错误可能发生在哪一步、为什么错、导致什么后果"}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 右侧：预览区 */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t.editor.preview?.question || "Question Preview"}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <MarkdownRenderer content={data.questionText} />
                        </CardContent>
                    </Card>

                    {/* GeoGebra Dynamic Demo */}
                    {data.geogebraCommands ? (
                        <GeogebraDemo commands={data.geogebraCommands} height={350} onRegenerate={handleAnalyzeGeogebra} />
                    ) : data.questionText.trim() && data.answerText.trim() ? (
                        <div className="rounded-lg border border-dashed p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Box className="h-4 w-4" />
                                    <span>GeoGebra 动态演示</span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAnalyzeGeogebra}
                                    disabled={isAnalyzingGeogebra}
                                >
                                    {isAnalyzingGeogebra ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            AI 分析中...
                                        </>
                                    ) : (
                                        <>
                                            <Box className="mr-2 h-4 w-4" />
                                            生成演示
                                        </>
                                    )}
                                </Button>
                            </div>
                            {geogebraError && (
                                <p className="text-xs text-muted-foreground mt-2">{geogebraError}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                                AI 将判断本题是否可以用 GeoGebra 进行动态演示
                            </p>
                        </div>
                    ) : null}

                    <Card>
                        <CardHeader>
                            <CardTitle>{t.editor.preview?.answer || "Answer Preview"}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <MarkdownRenderer content={data.answerText} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t.editor.preview?.analysis || "Analysis Preview"}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <MarkdownRenderer content={data.analysis} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t.editor.preview?.mistakeAnalysis || "错因分析预览"}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="text-muted-foreground">
                                {t.editor.mistakeStatus || "作答状态"}：
                                {data.mistakeStatus === 'wrong_attempt'
                                    ? (t.editor.mistakeStatuses?.wrongAttempt || "做错了")
                                    : data.mistakeStatus === 'not_attempted'
                                        ? (t.editor.mistakeStatuses?.notAttempted || "不会做")
                                        : (t.editor.mistakeStatuses?.unknown || "未判断")}
                            </div>
                            {data.wrongAnswerText && (
                                <div>
                                    <div className="font-medium mb-1">{t.editor.wrongAnswerText || "错误解答原文"}</div>
                                    <MarkdownRenderer content={data.wrongAnswerText} />
                                </div>
                            )}
                            {data.mistakeAnalysis && (
                                <div>
                                    <div className="font-medium mb-1">{t.editor.mistakeAnalysis || "错因分析"}</div>
                                    <MarkdownRenderer content={data.mistakeAnalysis} />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
