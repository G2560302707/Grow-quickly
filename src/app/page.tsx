"use client";

import { useState } from "react";
import { UploadZone } from "@/components/upload-zone";
import { CorrectionEditor } from "@/components/correction-editor";
import { ParsedQuestion } from "@/lib/gemini";
import { Dashboard } from "@/components/dashboard";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { processImageFile } from "@/lib/image-utils";

export default function Home() {
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [analyzing, setAnalyzing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedQuestion | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const { t, language } = useLanguage();

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
          language: language
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("API 错误:", res.status, errorText);
        alert(language === 'zh' ? '分析失败，请重试' : 'Analysis failed, please try again');
        throw new Error(`Analysis failed: ${res.status} ${errorText}`); // Keep throwing for catch block
      }

      const data = await res.json();
      setParsedData(data);
      setStep("review");
    } catch (error) {
      console.error('分析错误:', error);
      alert(language === 'zh' ? '发生错误，请重试' : 'An error occurred, please try again');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async (finalData: ParsedQuestion) => {
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
      } else {
        alert(language === 'zh' ? '保存失败' : 'Failed to save');
      }
    } catch (error) {
      console.error(error);
      alert(language === 'zh' ? '保存时出错' : 'Error saving');
    }
  };

  return (
    <main className="min-h-screen p-8 bg-background relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-primary">
            {t.app.title}
          </h1>
          <p className="text-muted-foreground">
            {t.app.subtitle}
          </p>
        </div>

        {/* Dashboard Section */}
        <Dashboard />

        <div className="flex justify-center gap-4">
          <Button
            variant={step === "upload" ? "default" : "outline"}
            onClick={() => setStep("upload")}
          >
            {t.app.uploadNew}
          </Button>
          <Link href="/notebook">
            <Button variant="outline">{t.app.viewNotebook}</Button>
          </Link>
        </div>

        {step === "upload" && (
          <UploadZone onImageSelect={handleAnalyze} isAnalyzing={analyzing} />
        )}

        {step === "review" && parsedData && (
          <CorrectionEditor
            initialData={parsedData}
            onSave={handleSave}
            onCancel={() => setStep("upload")}
            imagePreview={currentImage}
          />
        )}
      </div>
    </main>
  );
}
