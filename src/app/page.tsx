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
      setParsedData(data);
      setStep("review");
    } catch (error) {
      console.error('分析错误:', error);
      // Error already shown to user via alert
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
