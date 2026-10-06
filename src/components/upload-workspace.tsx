"use client";

/**
 * 上传与识别工作区（从首页 page.tsx 原样抽取，行为零变化）
 * 包含：图片上传/裁剪/AI 识别、AI 解题、直接录入三种模式，以及识别后的校对编辑器。
 */
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { UploadZone } from "@/components/upload-zone";
import { CorrectionEditor } from "@/components/correction-editor";
import { ParsedQuestion } from "@grow/shared/ai";
import { apiClient } from "@grow/shared/api-client";
import { AnalyzeResponse, Notebook, AppConfig } from "@grow/shared/types/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { processImageFile } from "@/lib/image-utils";
import { Upload, PenLine } from "lucide-react";
import { ProgressFeedback, ProgressStatus } from "@/components/ui/progress-feedback";
import { frontendLogger } from "@/lib/frontend-logger";
import { TextInputZone } from "@/components/text-input-zone";
import { DirectTextEditor } from "@/components/direct-text-editor";
import { alertDialog } from "@/components/ui/app-dialog";

// 裁剪组件仅在用户点击裁剪时才需要，懒加载以减小首屏包体
const ImageCropper = dynamic(
    () => import("@/components/image-cropper").then(mod => mod.ImageCropper),
    { ssr: false }
);

interface UploadWorkspaceProps {
    /** 从错题本页跳转过来时携带的错题本 id（searchParams ?notebook=） */
    initialNotebookId?: string | null;
}

export function UploadWorkspace({ initialNotebookId }: UploadWorkspaceProps) {
    const [step, setStep] = useState<"upload" | "review">("upload");
    const [analysisStep, setAnalysisStep] = useState<ProgressStatus>('idle');
    const [progress, setProgress] = useState(0);
    const [parsedData, setParsedData] = useState<ParsedQuestion | null>(null);
    const [currentImage, setCurrentImage] = useState<string | null>(null);
    const { t, language } = useLanguage();
    const router = useRouter();
    const [notebooks, setNotebooks] = useState<{ id: string; name: string }[]>([]);
    const [autoSelectedNotebookId, setAutoSelectedNotebookId] = useState<string | null>(null);

    const [config, setConfig] = useState<AppConfig | null>(null);

    // Input mode: "image" for photo upload, "text" for AI solve, "direct" for manual entry
    const [inputMode, setInputMode] = useState<"image" | "text" | "direct">("image");

    // Cropper state
    const [croppingImage, setCroppingImage] = useState<string | null>(null);
    const [isCropperOpen, setIsCropperOpen] = useState(false);

    // Timeout Config
    const aiTimeout = config?.timeouts?.analyze || 180000;
    const safetyTimeout = aiTimeout + 10000;

    // Cleanup Blob URL to prevent memory leak
    useEffect(() => {
        return () => {
            if (croppingImage) {
                URL.revokeObjectURL(croppingImage);
            }
        };
    }, [croppingImage]);

    useEffect(() => {
        // Fetch notebooks for auto-selection
        apiClient.get<Notebook[]>("/api/notebooks")
            .then(data => setNotebooks(data))
            .catch(err => console.error("Failed to fetch notebooks:", err));

        // Fetch settings for timeouts
        apiClient.get<AppConfig>("/api/settings")
            .then(data => {
                setConfig(data);
                if (data.timeouts?.analyze) {
                    frontendLogger.info('[Config]', 'Loaded timeout settings', {
                        analyze: data.timeouts.analyze
                    });
                }
            })
            .catch(err => console.error("Failed to fetch config:", err));
    }, []);

    // Simulate progress for smoother UX with timeout protection
    useEffect(() => {
        let interval: NodeJS.Timeout;
        let timeout: NodeJS.Timeout;
        if (analysisStep !== 'idle') {
            setProgress(0);
            interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 90) return prev; // Cap at 90% until complete
                    return prev + Math.random() * 10;
                });
            }, 500);

            // Safety timeout: auto-reset after configurable time to prevent stuck overlay
            timeout = setTimeout(() => {
                console.warn('[Progress] Safety timeout triggered - resetting analysisStep');
                setAnalysisStep('idle');
            }, safetyTimeout);
        }
        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [analysisStep, safetyTimeout]);

    const onImageSelect = (file: File) => {
        const imageUrl = URL.createObjectURL(file);
        setCroppingImage(imageUrl);
        setIsCropperOpen(true);
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        setIsCropperOpen(false);
        // Convert Blob to File
        const file = new File([croppedBlob], "cropped-image.jpg", { type: "image/jpeg" });
        handleAnalyze(file);
    };

    const handleAnalyze = async (file: File) => {
        const startTime = Date.now();
        frontendLogger.info('[HomeAnalyze]', 'Starting analysis flow', {
            timeoutSettings: {
                apiTimeout: aiTimeout,
                safetyTimeout
            }
        });

        try {
            frontendLogger.info('[HomeAnalyze]', 'Step 1/5: Compressing image');
            setAnalysisStep('compressing');
            const base64Image = await processImageFile(file);
            setCurrentImage(base64Image);
            frontendLogger.info('[HomeAnalyze]', 'Image compressed successfully', {
                size: base64Image.length
            });

            frontendLogger.info('[HomeAnalyze]', 'Step 2/5: Calling API endpoint /api/analyze');
            setAnalysisStep('analyzing');
            const apiStartTime = Date.now();
            const data = await apiClient.post<AnalyzeResponse>("/api/analyze", {
                imageBase64: base64Image,
                language: language,
                subjectId: initialNotebookId || autoSelectedNotebookId || undefined
            }, { timeout: aiTimeout }); // Use configured timeout
            const apiDuration = Date.now() - apiStartTime;
            frontendLogger.info('[HomeAnalyze]', 'API response received, validating data', {
                apiDuration
            });

            // Validate response data
            if (!data || typeof data !== 'object') {
                frontendLogger.error('[HomeAnalyze]', 'Validation failed - invalid response data', {
                    data
                });
                throw new Error('Invalid API response: data is null or not an object');
            }
            frontendLogger.info('[HomeAnalyze]', 'Response data validated successfully');

            frontendLogger.info('[HomeAnalyze]', 'Step 3/5: Setting processing state and progress to 100%');
            setAnalysisStep('processing');
            setProgress(100);
            frontendLogger.info('[HomeAnalyze]', 'Progress updated to 100%');

            frontendLogger.info('[HomeAnalyze]', 'Step 4/5: Setting parsed data and auto-selecting notebook');
            const dataSize = JSON.stringify(data).length;
            // Auto-select notebook based on subject
            if (data.subject) {
                const matchedNotebook = notebooks.find(n =>
                    n.name.includes(data.subject!) || data.subject!.includes(n.name)
                );
                if (matchedNotebook) {
                    setAutoSelectedNotebookId(matchedNotebook.id);
                    frontendLogger.info('[HomeAnalyze]', 'Auto-selected notebook', {
                        notebook: matchedNotebook.name,
                        subject: data.subject
                    });
                }
            }
            const setDataStart = Date.now();
            setParsedData(data);
            const setDataDuration = Date.now() - setDataStart;
            frontendLogger.info('[HomeAnalyze]', 'Parsed data set successfully', {
                dataSize,
                setDataDuration
            });

            frontendLogger.info('[HomeAnalyze]', 'Step 5/5: Switching to review page');
            const setStepStart = Date.now();
            setStep("review");
            const setStepDuration = Date.now() - setStepStart;
            frontendLogger.info('[HomeAnalyze]', 'Step switched to review', {
                setStepDuration
            });
            const totalDuration = Date.now() - startTime;
            frontendLogger.info('[HomeAnalyze]', 'Analysis completed successfully', {
                totalDuration
            });
        } catch (error: any) {
            const errorDuration = Date.now() - startTime;
            frontendLogger.error('[HomeError]', 'Analysis failed', {
                errorDuration,
                error: error.message || String(error)
            });

            // 安全的错误处理逻辑，防止在报错时二次报错
            try {
                let errorMessage = t.common?.messages?.analysisFailed || 'Analysis failed, please try again';

                // ApiError 的结构：error.data.message 包含后端返回的错误类型
                const backendErrorType = error?.data?.message;

                if (backendErrorType && typeof backendErrorType === 'string') {
                    // 检查是否是已知的 AI 错误类型
                    if (t.errors && typeof t.errors === 'object' && backendErrorType in t.errors) {
                        const mappedError = (t.errors as any)[backendErrorType];
                        if (typeof mappedError === 'string') {
                            errorMessage = mappedError;
                            frontendLogger.info('[HomeError]', `Matched error type: ${backendErrorType}`, {
                                errorMessage
                            });
                        }
                    } else {
                        // 使用后端返回的具体错误消息
                        errorMessage = backendErrorType;
                        frontendLogger.info('[HomeError]', 'Using backend error message', {
                            errorMessage
                        });
                    }
                } else if (error?.message) {
                    // Fallback：检查 error.message（用于非 API 错误）
                    if (error.message.includes('fetch') || error.message.includes('network')) {
                        errorMessage = t.errors?.AI_CONNECTION_FAILED || '网络连接失败';
                    } else if (typeof error.data === 'string') {
                        frontendLogger.info('[HomeError]', 'Raw error data', {
                            errorDataPreview: error.data.substring(0, 100)
                        });
                        errorMessage += ` (${error.status || 'Error'})`;
                    }
                }

                await alertDialog({ description: errorMessage });
            } catch (innerError) {
                frontendLogger.error('[HomeError]', 'Failed to process error message', {
                    innerError: String(innerError)
                });
                await alertDialog({ description: 'Analysis failed. Please try again.' });
            }
        } finally {
            // Always reset analysis state, even if setState throws
            frontendLogger.info('[HomeAnalyze]', 'Finally: Resetting analysis state to idle');
            setAnalysisStep('idle');
            frontendLogger.info('[HomeAnalyze]', 'Analysis state reset complete');
        }
    };

    const handleSave = async (finalData: ParsedQuestion & { subjectId?: string }): Promise<void> => {
        frontendLogger.info('[HomeSave]', 'Starting save process', {
            hasQuestionText: !!finalData.questionText,
            hasAnswerText: !!finalData.answerText,
            subjectId: finalData.subjectId,
            knowledgePointsCount: finalData.knowledgePoints?.length || 0,
            hasImage: !!currentImage,
            imageSize: currentImage?.length || 0,
        });

        try {
            const result = await apiClient.post<{ id: string; duplicate?: boolean }>("/api/error-items", {
                ...finalData,
                originalImageUrl: currentImage || "",
            });

            // 检查是否是重复提交（后端去重返回）
            if (result.duplicate) {
                frontendLogger.info('[HomeSave]', 'Duplicate submission detected, using existing record');
            }

            frontendLogger.info('[HomeSave]', 'Save successful');
            setStep("upload");
            setParsedData(null);
            setCurrentImage(null);
            await alertDialog({ description: t.common?.messages?.saveSuccess || 'Saved successfully!' });

            // Redirect to notebook page if subjectId is present
            if (finalData.subjectId) {
                router.push(`/notebooks/${finalData.subjectId}`);
            }
        } catch (error: any) {
            frontendLogger.error('[HomeSave]', 'Save failed', {
                errorStatus: error?.status,
                errorMessage: error?.data?.message || error?.message || String(error),
                errorData: error?.data,
            });
            await alertDialog({ description: t.common?.messages?.saveFailed || 'Failed to save' });
        }
    };

    const handleTextSubmit = async (questionText: string) => {
        const startTime = Date.now();
        frontendLogger.info('[HomeTextSubmit]', 'Starting text-based analysis', { textLength: questionText.length });

        try {
            setAnalysisStep('analyzing');

            // Infer subject from auto-selected notebook
            const targetNotebookId = initialNotebookId || autoSelectedNotebookId;
            const matchedNotebook = targetNotebookId
                ? notebooks.find(n => n.id === targetNotebookId)
                : undefined;

            const result = await apiClient.post<{
                answerText: string;
                analysis: string;
                knowledgePoints: string[];
                wrongAnswerText: string;
                mistakeAnalysis: string;
                mistakeStatus: string;
            }>("/api/reanswer", {
                questionText,
                language,
                subject: matchedNotebook?.name || undefined,
            }, { timeout: aiTimeout });

            setAnalysisStep('processing');
            setProgress(100);

            const parsed: ParsedQuestion = {
                questionText,
                answerText: result.answerText,
                analysis: result.analysis,
                knowledgePoints: result.knowledgePoints || [],
                wrongAnswerText: result.wrongAnswerText || "",
                mistakeAnalysis: result.mistakeAnalysis || "",
                mistakeStatus: (result.mistakeStatus as any) || "unknown",
                subject: "判断推理", // Default, will be overridden by notebook selection
                requiresImage: false,
            };

            setCurrentImage(null); // No image for text input
            setParsedData(parsed);
            setStep("review");

            const totalDuration = Date.now() - startTime;
            frontendLogger.info('[HomeTextSubmit]', 'Text analysis completed', { totalDuration });
        } catch (error: any) {
            const errorDuration = Date.now() - startTime;
            frontendLogger.error('[HomeTextSubmit]', 'Analysis failed', {
                errorDuration,
                error: error.message || String(error)
            });

            try {
                let errorMessage = t.common?.messages?.analysisFailed || 'Analysis failed, please try again';
                const backendErrorType = error?.data?.message;
                if (backendErrorType && typeof backendErrorType === 'string') {
                    if (t.errors && typeof t.errors === 'object' && backendErrorType in t.errors) {
                        const mappedError = (t.errors as any)[backendErrorType];
                        if (typeof mappedError === 'string') errorMessage = mappedError;
                    } else {
                        errorMessage = backendErrorType;
                    }
                }
                await alertDialog({ description: errorMessage });
            } catch {
                await alertDialog({ description: 'Analysis failed. Please try again.' });
            }
        } finally {
            setAnalysisStep('idle');
        }
    };

    const handleDirectSave = async (data: {
        questionText: string;
        answerText: string;
        analysis: string;
        wrongAnswerText: string;
        mistakeAnalysis: string;
        mistakeStatus: string;
        knowledgePoints: string[];
        subjectId: string;
        gradeSemester?: string;
        paperLevel?: string;
    }): Promise<void> => {
        frontendLogger.info('[HomeDirectSave]', 'Starting direct save', {
            hasQuestionText: !!data.questionText,
            hasAnswerText: !!data.answerText,
            subjectId: data.subjectId,
        });

        try {
            setAnalysisStep('saving');
            const result = await apiClient.post<{ id: string; duplicate?: boolean }>("/api/error-items", {
                questionText: data.questionText,
                answerText: data.answerText,
                analysis: data.analysis,
                wrongAnswerText: data.wrongAnswerText || null,
                mistakeAnalysis: data.mistakeAnalysis || null,
                mistakeStatus: data.mistakeStatus || "unknown",
                knowledgePoints: data.knowledgePoints,
                subjectId: data.subjectId,
                gradeSemester: data.gradeSemester,
                paperLevel: data.paperLevel,
                originalImageUrl: "",
            });

            if (result.duplicate) {
                frontendLogger.info('[HomeDirectSave]', 'Duplicate detected');
            }

            frontendLogger.info('[HomeDirectSave]', 'Save successful');
            setAnalysisStep('idle');
            await alertDialog({ description: t.common?.messages?.saveSuccess || 'Saved successfully!' });

            if (data.subjectId) {
                router.push(`/notebooks/${data.subjectId}`);
            }
        } catch (error: any) {
            frontendLogger.error('[HomeDirectSave]', 'Save failed', {
                errorStatus: error?.status,
                errorMessage: error?.data?.message || error?.message || String(error),
            });
            setAnalysisStep('idle');
            await alertDialog({ description: t.common?.messages?.saveFailed || 'Failed to save' });
        }
    };

    const getProgressMessage = () => {
        switch (analysisStep) {
            case 'compressing': return t.common.progress?.compressing || "Compressing...";
            case 'uploading': return t.common.progress?.uploading || "Uploading...";
            case 'analyzing': return t.common.progress?.analyzing || "Analyzing...";
            case 'processing': return t.common.progress?.processing || "Processing...";
            case 'saving': return "保存中...";
            default: return "";
        }
    };

    return (
        <>
            <ProgressFeedback
                status={analysisStep}
                progress={progress}
                message={getProgressMessage()}
            />

            {step === "upload" && (
                <div className="space-y-4">
                    {/* Input mode tabs */}
                    <div className="flex gap-2 border-b">
                        <button
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                                inputMode === "image"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => setInputMode("image")}
                        >
                            <Upload className="h-4 w-4" />
                            {t.app?.uploadImage || "拍照上传"}
                        </button>
                        <button
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                                inputMode === "text"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => setInputMode("text")}
                        >
                            <PenLine className="h-4 w-4" />
                            {t.app?.manualInput || "AI解题"}
                        </button>
                        <button
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                                inputMode === "direct"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => setInputMode("direct")}
                        >
                            <PenLine className="h-4 w-4" />
                            直接录入
                        </button>
                    </div>

                    {inputMode === "image" ? (
                        <UploadZone onImageSelect={onImageSelect} isAnalyzing={analysisStep !== 'idle'} />
                    ) : inputMode === "text" ? (
                        <TextInputZone
                            onSubmit={handleTextSubmit}
                            isAnalyzing={analysisStep !== 'idle'}
                            defaultNotebookName={
                                (initialNotebookId || autoSelectedNotebookId)
                                    ? notebooks.find(n => n.id === (initialNotebookId || autoSelectedNotebookId))?.name
                                    : undefined
                            }
                        />
                    ) : (
                        <DirectTextEditor
                            onSubmit={handleDirectSave}
                            defaultNotebookId={initialNotebookId || autoSelectedNotebookId || undefined}
                            defaultNotebookName={
                                (initialNotebookId || autoSelectedNotebookId)
                                    ? notebooks.find(n => n.id === (initialNotebookId || autoSelectedNotebookId))?.name
                                    : undefined
                            }
                            isSaving={analysisStep === 'saving'}
                        />
                    )}
                </div>
            )}

            {croppingImage && (
                <ImageCropper
                    imageSrc={croppingImage}
                    open={isCropperOpen}
                    onClose={() => setIsCropperOpen(false)}
                    onCropComplete={handleCropComplete}
                />
            )}

            {step === "review" && parsedData && (
                <CorrectionEditor
                    initialData={parsedData}
                    onSave={handleSave}
                    onCancel={() => setStep("upload")}
                    imagePreview={currentImage}
                    initialSubjectId={initialNotebookId || autoSelectedNotebookId || undefined}
                    aiTimeout={aiTimeout}
                />
            )}
        </>
    );
}
