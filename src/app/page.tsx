"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { UploadZone } from "@/components/upload-zone";
import { CorrectionEditor } from "@/components/correction-editor";
import { ImageCropper } from "@/components/image-cropper";
import { ParsedQuestion } from "@/lib/ai";
import { UserWelcome } from "@/components/user-welcome";
import { apiClient } from "@/lib/api-client";
import { AnalyzeResponse, Notebook } from "@/types/api";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { processImageFile } from "@/lib/image-utils";
import { Upload, BookOpen, Tags, LogOut, BarChart3, ArrowLeft } from "lucide-react";
import { SettingsDialog } from "@/components/settings-dialog";
import { signOut, useSession } from "next-auth/react";

import { ProgressFeedback, ProgressStatus } from "@/components/ui/progress-feedback";

function HomeContent() {
    const [step, setStep] = useState<"upload" | "review">("upload");
    const [analysisStep, setAnalysisStep] = useState<ProgressStatus>('idle');
    const [progress, setProgress] = useState(0);
    const [parsedData, setParsedData] = useState<ParsedQuestion | null>(null);
    const [currentImage, setCurrentImage] = useState<string | null>(null);
    const { t, language } = useLanguage();
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialNotebookId = searchParams.get("notebook");
    const [notebooks, setNotebooks] = useState<{ id: string; name: string }[]>([]);
    const [autoSelectedNotebookId, setAutoSelectedNotebookId] = useState<string | null>(null);

    // Cropper state
    const [croppingImage, setCroppingImage] = useState<string | null>(null);
    const [isCropperOpen, setIsCropperOpen] = useState(false);

    useEffect(() => {
        // Fetch notebooks for auto-selection
        apiClient.get<Notebook[]>("/api/notebooks")
            .then(data => setNotebooks(data))
            .catch(err => console.error("Failed to fetch notebooks:", err));
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

            // Safety timeout: auto-reset after 60s to prevent stuck overlay
            timeout = setTimeout(() => {
                console.warn('[Progress] Safety timeout triggered - resetting analysisStep');
                setAnalysisStep('idle');
            }, 60000);
        }
        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [analysisStep]);

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
        try {
            // 1. Compressing
            setAnalysisStep('compressing');
            console.log('开始处理图片...');
            const base64Image = await processImageFile(file);
            setCurrentImage(base64Image);

            // 2. Uploading / Analyzing (API call)
            setAnalysisStep('analyzing'); // Combined step for simplicity, or split if we had real upload progress

            const data = await apiClient.post<AnalyzeResponse>("/api/analyze", {
                imageBase64: base64Image,
                language: language,
                subjectId: initialNotebookId || autoSelectedNotebookId || undefined
            });

            // 3. Processing result
            setAnalysisStep('processing');
            setProgress(100);

            // Auto-select notebook based on subject
            if (data.subject) {
                const matchedNotebook = notebooks.find(n =>
                    n.name.includes(data.subject!) || data.subject!.includes(n.name)
                );
                if (matchedNotebook) {
                    setAutoSelectedNotebookId(matchedNotebook.id);
                    console.log(`Auto-selected notebook: ${matchedNotebook.name} for subject: ${data.subject}`);
                }
            }

            setParsedData(data);
            setStep("review");
        } catch (error: any) {
            console.error('分析错误:', error);

            let userMessage = t.common?.messages?.analysisFailed || 'Analysis failed, please try again';

            // Check if it's our ApiError
            const errorText = error.data ? JSON.stringify(error.data) : error.message || "";

            if (errorText.includes('AI_CONNECTION_FAILED')) {
                userMessage = t.errors?.aiConnectionFailed || '⚠️ Cannot connect to AI service\n\nPlease check:\n• Internet connection\n• Proxy settings\n• Firewall configuration';
            } else if (errorText.includes('AI_RESPONSE_ERROR')) {
                userMessage = t.errors?.aiResponseError || '⚠️ AI returned invalid response\n\nPlease try again, contact support if issue persists';
            } else if (errorText.includes('AI_AUTH_ERROR')) {
                userMessage = t.errors?.aiAuth || '⚠️ Invalid API key\n\nPlease check GOOGLE_API_KEY environment variable';
            }

            alert(userMessage);
        } finally {
            setAnalysisStep('idle');
        }
    };

    const handleSave = async (finalData: ParsedQuestion & { subjectId?: string }) => {
        try {
            await apiClient.post("/api/error-items", {
                ...finalData,
                originalImageUrl: currentImage || "",
            });

            setStep("upload");
            setParsedData(null);
            setCurrentImage(null);
            alert(t.common?.messages?.saveSuccess || 'Saved successfully!');

            // Redirect to notebook page if subjectId is present
            if (finalData.subjectId) {
                router.push(`/notebooks/${finalData.subjectId}`);
            }
        } catch (error) {
            console.error(error);
            alert(t.common?.messages?.saveFailed || 'Failed to save');
        }
    };

    const getProgressMessage = () => {
        switch (analysisStep) {
            case 'compressing': return t.common.progress?.compressing || "Compressing...";
            case 'uploading': return t.common.progress?.uploading || "Uploading...";
            case 'analyzing': return t.common.progress?.analyzing || "Analyzing...";
            case 'processing': return t.common.progress?.processing || "Processing...";
            default: return "";
        }
    };

    return (
        <main className="min-h-screen bg-background">
            <ProgressFeedback
                status={analysisStep}
                progress={progress}
                message={getProgressMessage()}
            />

            <div className="container mx-auto p-4 space-y-8 pb-20">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <UserWelcome />

                    <div className="flex items-center gap-2 bg-card p-2 rounded-lg border shadow-sm">
                        <SettingsDialog />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full text-muted-foreground hover:text-destructive"
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            title={t.app?.logout || 'Logout'}
                        >
                            <LogOut className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Action Center */}
                <div className={initialNotebookId ? "flex justify-center mb-6" : "grid grid-cols-1 md:grid-cols-4 gap-4"}>
                    <Button
                        size="lg"
                        className={`h-auto py-4 text-base shadow-sm hover:shadow-md transition-all ${initialNotebookId ? "w-full max-w-md" : ""}`}
                        variant={step === "upload" ? "default" : "secondary"}
                        onClick={() => setStep("upload")}
                    >
                        <div className="flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            <span>{t.app.uploadNew}</span>
                        </div>
                    </Button>

                    {!initialNotebookId && (
                        <>
                            <Link href="/notebooks" className="w-full">
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="w-full h-auto py-4 text-base shadow-sm hover:shadow-md transition-all border hover:border-primary/50 hover:bg-accent/50"
                                >
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="h-5 w-5" />
                                        <span>{t.app.viewNotebook}</span>
                                    </div>
                                </Button>
                            </Link>

                            <Link href="/tags" className="w-full">
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="w-full h-auto py-4 text-base shadow-sm hover:shadow-md transition-all border hover:border-primary/50 hover:bg-accent/50"
                                >
                                    <div className="flex items-center gap-2">
                                        <Tags className="h-5 w-5" />
                                        <span>{t.app?.tags || 'Tags'}</span>
                                    </div>
                                </Button>
                            </Link>

                            <Link href="/stats" className="w-full">
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="w-full h-auto py-4 text-base shadow-sm hover:shadow-md transition-all border hover:border-primary/50 hover:bg-accent/50"
                                >
                                    <div className="flex items-center gap-2">
                                        <BarChart3 className="h-5 w-5" />
                                        <span>{t.app?.stats || 'Stats'}</span>
                                    </div>
                                </Button>
                            </Link>
                        </>
                    )}
                </div>

                {step === "upload" && (
                    <UploadZone onImageSelect={onImageSelect} isAnalyzing={analysisStep !== 'idle'} />
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
                    />
                )}

            </div>
        </main>
    );
}

export default function Home() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <HomeContent />
        </Suspense>
    );
}
