"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { UploadZone } from "@/components/upload-zone";
import { CorrectionEditor } from "@/components/correction-editor";
import { ImageCropper } from "@/components/image-cropper";
import { ParsedQuestion } from "@/lib/ai";
import { UserWelcome } from "@/components/user-welcome";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { processImageFile } from "@/lib/image-utils";
import { Upload, BookOpen, Tags, LogOut, BarChart3 } from "lucide-react";
import { SettingsDialog } from "@/components/settings-dialog";
import { signOut, useSession } from "next-auth/react";

function HomeContent() {
    const [step, setStep] = useState<"upload" | "review">("upload");
    const [analyzing, setAnalyzing] = useState(false);
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
        fetch("/api/notebooks")
            .then(res => res.ok ? res.json() : [])
            .then(data => setNotebooks(data))
            .catch(err => console.error("Failed to fetch notebooks:", err));
    }, []);

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
        setAnalyzing(true);
        try {
            // 处理图片（压缩如果需要）
            console.log('开始处理图片...');
            const base64Image = await processImageFile(file);

            setCurrentImage(base64Image);

            const res = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageBase64: base64Image,
                    language: language,
                    subjectId: initialNotebookId || autoSelectedNotebookId || undefined
                }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error("API 错误:", res.status, errorText);

                // Parse error message for user-friendly display
                let userMessage = language === 'zh' ? '分析失败，请重试' : 'Analysis failed, please try again';

                if (errorText.includes('AI_CONNECTION_FAILED')) {
                    userMessage = language === 'zh'
                        ? '⚠️ 无法连接到 AI 服务\n\n请检查：\n• 网络连接是否正常\n• 是否需要配置代理\n• 防火墙设置'
                        : '⚠️ Cannot connect to AI service\n\nPlease check:\n• Internet connection\n• Proxy settings\n• Firewall configuration';
                } else if (errorText.includes('AI_RESPONSE_ERROR')) {
                    userMessage = language === 'zh'
                        ? '⚠️ AI 返回了无效的响应\n\n请重试，如果问题持续请联系支持'
                        : '⚠️ AI returned invalid response\n\nPlease try again, contact support if issue persists';
                } else if (errorText.includes('AI_AUTH_ERROR')) {
                    userMessage = language === 'zh'
                        ? '⚠️ API 密钥无效\n\n请检查环境变量 GOOGLE_API_KEY'
                        : '⚠️ Invalid API key\n\nPlease check GOOGLE_API_KEY environment variable';
                }

                alert(userMessage);
                throw new Error(`Analysis failed: ${res.status} ${errorText}`); // Keep throwing for catch block
            }

            const data = await res.json();

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
        } catch (error) {
            console.error('分析错误:', error);
            // Error already shown to user via alert
        } finally {
            setAnalyzing(false);
        }
    };

    const handleSave = async (finalData: ParsedQuestion & { subjectId?: string }) => {
        try {
            const res = await fetch("/api/error-items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...finalData,
                    originalImageUrl: currentImage || "",
                }),
            });

            if (res.ok) {
                setStep("upload");
                setParsedData(null);
                setCurrentImage(null);
                alert(language === 'zh' ? '保存成功！' : 'Saved successfully!');

                // Redirect to notebook page if subjectId is present
                if (finalData.subjectId) {
                    router.push(`/notebooks/${finalData.subjectId}`);
                }
            } else {
                alert(language === 'zh' ? '保存失败' : 'Failed to save');
            }
        } catch (error) {
            console.error(error);
            alert(language === 'zh' ? '保存时出错' : 'Error saving');
        }
    };

    return (
        <main className="min-h-screen bg-background">
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
                            title={language === 'zh' ? '退出登录' : 'Logout'}
                        >
                            <LogOut className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Action Center */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Button
                        size="lg"
                        className="h-auto py-4 text-base shadow-sm hover:shadow-md transition-all"
                        variant={step === "upload" ? "default" : "secondary"}
                        onClick={() => setStep("upload")}
                    >
                        <div className="flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            <span>{t.app.uploadNew}</span>
                        </div>
                    </Button>

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
                                <span>{language === 'zh' ? '标签管理' : 'Tags'}</span>
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
                                <span>{language === 'zh' ? '统计中心' : 'Stats'}</span>
                            </div>
                        </Button>
                    </Link>

                </div>

                {step === "upload" && (
                    <UploadZone onImageSelect={onImageSelect} isAnalyzing={analyzing} />
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
