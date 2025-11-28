"use client";

import { useState } from "react";
import { ParsedQuestion } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { TagInput } from "@/components/tag-input";
import { NotebookSelector } from "@/components/notebook-selector";

interface ParsedQuestionWithSubject extends ParsedQuestion {
    subjectId?: string;
}

interface CorrectionEditorProps {
    initialData: ParsedQuestion;
    onSave: (data: ParsedQuestionWithSubject) => void;
    onCancel: () => void;
    imagePreview?: string | null;
    initialSubjectId?: string;
}

export function CorrectionEditor({ initialData, onSave, onCancel, imagePreview, initialSubjectId }: CorrectionEditorProps) {
    const [data, setData] = useState<ParsedQuestionWithSubject>({
        ...initialData,
        subjectId: initialSubjectId
    });
    const { t } = useLanguage();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">{t.editor.title}</h2>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={onCancel}>
                        {t.editor.cancel}
                    </Button>
                    <Button onClick={() => onSave(data)}>
                        <Save className="mr-2 h-4 w-4" />
                        {t.editor.save}
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
                        <Label>选择错题本</Label>
                        <NotebookSelector
                            value={data.subjectId}
                            onChange={(id) => setData({ ...data, subjectId: id })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t.editor.question}</Label>
                        <Textarea
                            value={data.questionText}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setData({ ...data, questionText: e.target.value })}
                            className="min-h-[150px] font-mono text-sm"
                            placeholder="支持 Markdown 和 LaTeX..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t.editor.answer}</Label>
                        <Textarea
                            value={data.answerText}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setData({ ...data, answerText: e.target.value })}
                            className="min-h-[100px] font-mono text-sm"
                            placeholder="支持 Markdown 和 LaTeX..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t.editor.analysis}</Label>
                        <Textarea
                            value={data.analysis}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setData({ ...data, analysis: e.target.value })}
                            className="min-h-[200px] font-mono text-sm"
                            placeholder="支持 Markdown 和 LaTeX..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t.editor.tags}</Label>
                        <TagInput
                            value={data.knowledgePoints}
                            onChange={(tags) => setData({ ...data, knowledgePoints: tags })}
                            placeholder="输入知识点标签，可从建议中选择..."
                        />
                        <p className="text-xs text-muted-foreground">
                            💡 输入时会显示标签建议，支持从标准标签库选择
                        </p>
                    </div>
                </div>

                {/* 右侧：预览区 */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>题目预览</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <MarkdownRenderer content={data.questionText} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>答案预览</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <MarkdownRenderer content={data.answerText} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>解析预览</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <MarkdownRenderer content={data.analysis} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
