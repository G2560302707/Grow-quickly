"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, XCircle, RefreshCw, Trash2, Edit, Save, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { TagInput } from "@/components/tag-input";

interface ErrorItemDetail {
    id: string;
    questionText: string;
    answerText: string;
    analysis: string;
    knowledgePoints: string;
    masteryLevel: number;
    originalImageUrl: string;
    userNotes: string | null;
    subjectId?: string | null;
}

export default function ErrorDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { t, language } = useLanguage();
    const [item, setItem] = useState<ErrorItemDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notesInput, setNotesInput] = useState("");
    const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
    const [isEditingTags, setIsEditingTags] = useState(false);
    const [tagsInput, setTagsInput] = useState<string[]>([]);

    useEffect(() => {
        if (params.id) {
            fetchItem(params.id as string);
        }
    }, [params.id]);

    const fetchItem = async (id: string) => {
        try {
            const res = await fetch(`/api/error-items/${id}`);
            if (res.ok) {
                const data = await res.json();
                setItem(data);
            } else {
                alert(language === 'zh' ? '加载失败' : 'Failed to load item');
                router.push("/notebooks");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const toggleMastery = async () => {
        if (!item) return;

        const newLevel = item.masteryLevel > 0 ? 0 : 1;

        try {
            const res = await fetch(`/api/error-items/${item.id}/mastery`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ masteryLevel: newLevel }),
            });

            if (res.ok) {
                setItem({ ...item, masteryLevel: newLevel });
                alert(newLevel > 0 ? (language === 'zh' ? '已标记为已掌握' : 'Marked as mastered') : (language === 'zh' ? '已取消掌握标记' : 'Unmarked'));
            } else {
                alert(language === 'zh' ? '更新失败' : 'Update failed');
            }
        } catch (error) {
            console.error(error);
            alert(language === 'zh' ? '更新出错' : 'Error updating');
        }
    };

    const deleteItem = async () => {
        if (!item) return;

        const confirmMessage = language === 'zh' ? '确定要删除这道错题吗？' : 'Are you sure you want to delete this error item?';
        if (!confirm(confirmMessage)) return;

        try {
            const res = await fetch(`/api/error-items/${item.id}/delete`, {
                method: 'DELETE',
            });

            if (res.ok) {
                alert(language === 'zh' ? '删除成功' : 'Deleted successfully');
                if (item.subjectId) {
                    router.push(`/notebooks/${item.subjectId}`);
                } else {
                    router.push('/notebooks');
                }
            } else {
                alert(language === 'zh' ? '删除失败' : 'Delete failed');
            }
        } catch (error) {
            console.error(error);
            alert(language === 'zh' ? '删除出错' : 'Error deleting');
        }
    };

    const startEditingNotes = () => {
        setNotesInput(item?.userNotes || "");
        setIsEditingNotes(true);
    };

    const cancelEditingNotes = () => {
        setIsEditingNotes(false);
        setNotesInput("");
    };

    const startEditingTags = () => {
        if (item) {
            try {
                const tags = JSON.parse(item.knowledgePoints);
                setTagsInput(tags);
            } catch (e) {
                setTagsInput([]);
            }
            setIsEditingTags(true);
        }
    };

    const saveTagsHandler = async () => {
        try {
            const res = await fetch(`/api/error-items/${item?.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    knowledgePoints: JSON.stringify(tagsInput),
                }),
            });

            if (res.ok) {
                setIsEditingTags(false);
                fetchItem(params.id as string);
                alert(language === 'zh' ? '标签更新成功！' : 'Tags updated successfully!');
            } else {
                alert(language === 'zh' ? '更新失败' : 'Update failed');
            }
        } catch (error) {
            console.error(error);
            alert(language === 'zh' ? '更新时出错' : 'Error updating');
        }
    };

    const cancelEditingTags = () => {
        setIsEditingTags(false);
        setTagsInput([]);
    };

    const saveNotes = async () => {
        if (!item) return;

        try {
            const res = await fetch(`/api/error-items/${item.id}/notes`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userNotes: notesInput }),
            });

            if (res.ok) {
                setItem({ ...item, userNotes: notesInput });
                setIsEditingNotes(false);
                alert(language === 'zh' ? '笔记保存成功' : 'Notes saved successfully');
            } else {
                alert(language === 'zh' ? '保存失败' : 'Save failed');
            }
        } catch (error) {
            console.error(error);
            alert(language === 'zh' ? '保存出错' : 'Error saving');
        }
    };

    if (loading) return <div className="p-8 text-center">{t.common.loading}</div>;
    if (!item) return <div className="p-8 text-center">{t.detail.notFound || "Item not found"}</div>;

    let tags: string[] = [];
    try {
        tags = JSON.parse(item.knowledgePoints);
    } catch (e) {
        tags = [];
    }

    return (
        <main className="min-h-screen p-8 bg-background">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <Link href={item.subjectId ? `/notebooks/${item.subjectId}` : "/notebooks"}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">{t.detail.title}</h1>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Left Column: Question & Image */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t.detail.question}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {item.originalImageUrl && (
                                    <div
                                        className="cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => setIsImageViewerOpen(true)}
                                        title={language === 'zh' ? '点击查看大图' : 'Click to view full image'}
                                    >
                                        <p className="text-sm font-medium mb-2 text-muted-foreground">
                                            {t.detail.originalProblem || "原始问题"}
                                        </p>
                                        <img
                                            src={item.originalImageUrl}
                                            alt={t.detail.originalProblem || "Original Problem"}
                                            className="w-full rounded-lg border hover:border-primary/50 transition-colors"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1 text-center">
                                            💡 {language === 'zh' ? '点击图片查看大图' : 'Click to enlarge'}
                                        </p>
                                    </div>
                                )}
                                <MarkdownRenderer content={item.questionText} />

                                {/* 知识点标签 */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-semibold">知识点标签</h4>
                                        {!isEditingTags && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={startEditingTags}
                                            >
                                                <Edit className="h-4 w-4 mr-1" />
                                                编辑
                                            </Button>
                                        )}
                                    </div>

                                    {isEditingTags ? (
                                        <div className="space-y-3">
                                            <TagInput
                                                value={tagsInput}
                                                onChange={setTagsInput}
                                                placeholder="输入或选择知识点标签..."
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                💡 可以从标准标签库或自定义标签中选择
                                            </p>
                                            <div className="flex gap-2">
                                                <Button size="sm" onClick={saveTagsHandler}>
                                                    <Save className="h-4 w-4 mr-1" />
                                                    保存
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={cancelEditingTags}>
                                                    <X className="h-4 w-4 mr-1" />
                                                    取消
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {tags.map((tag) => (
                                                <Badge key={tag} variant="secondary">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>{t.detail.yourNotes}</CardTitle>
                                    {!isEditingNotes && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={startEditingNotes}
                                        >
                                            <Edit className="h-4 w-4 mr-1" />
                                            {t.detail.editNotes || "编辑"}
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isEditingNotes ? (
                                    <div className="space-y-3">
                                        <Textarea
                                            value={notesInput}
                                            onChange={(e) => setNotesInput(e.target.value)}
                                            placeholder={t.detail.notesPlaceholder || "输入你的笔记..."}
                                            rows={5}
                                            className="w-full"
                                        />
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                onClick={saveNotes}
                                            >
                                                <Save className="h-4 w-4 mr-1" />
                                                {t.common.save || "保存"}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={cancelEditingNotes}
                                            >
                                                <X className="h-4 w-4 mr-1" />
                                                {t.common.cancel || "取消"}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="whitespace-pre-wrap">
                                        {item.userNotes ? (
                                            <p className="text-foreground">{item.userNotes}</p>
                                        ) : (
                                            <p className="text-muted-foreground italic">
                                                {t.detail.noNotes}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Analysis & Answer */}
                    <div className="space-y-6">
                        <Card className="border-primary/20">
                            <CardHeader>
                                <CardTitle className="text-primary">{t.detail.correctAnswer}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <MarkdownRenderer content={item.answerText} className="font-semibold" />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t.detail.analysis}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {item.originalImageUrl && (
                                    <div>
                                        <p className="text-sm font-medium mb-2 text-muted-foreground">
                                            {t.detail.referenceDiagram || "参考图形"}
                                        </p>
                                        <img
                                            src={item.originalImageUrl}
                                            alt={t.detail.originalProblem || "Original Problem"}
                                            className="w-full max-w-md rounded-lg border"
                                        />
                                    </div>
                                )}
                                <MarkdownRenderer content={item.analysis} />
                            </CardContent>
                        </Card>
                        {/* 操作按钮 */}
                        <div className="flex flex-col sm:flex-row gap-3 mt-6">
                            {/* 主要操作 - 左侧 */}
                            <div className="flex gap-3 flex-1">
                                <Link href={`/practice?id=${item.id}`} className="flex-1">
                                    <Button variant="secondary" size="lg" className="w-full">
                                        <RefreshCw className="mr-2 h-5 w-5" />
                                        {t.detail.practice}
                                    </Button>
                                </Link>
                                <Button
                                    size="lg"
                                    variant={item.masteryLevel > 0 ? "outline" : "default"}
                                    className={`flex-1 ${item.masteryLevel > 0 ? "text-green-600 border-green-600 hover:bg-green-50" : ""}`}
                                    onClick={toggleMastery}
                                >
                                    {item.masteryLevel > 0 ? (
                                        <>
                                            <CheckCircle className="mr-2 h-5 w-5" />
                                            {t.detail.mastered}
                                        </>
                                    ) : (
                                        <>
                                            <XCircle className="mr-2 h-5 w-5" />
                                            {t.detail.markMastered}
                                        </>
                                    )}
                                </Button>
                            </div>

                            {/* 删除按钮 - 右侧，使用 ghost 样式降低视觉重量 */}
                            <Button
                                variant="ghost"
                                size="lg"
                                onClick={deleteItem}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t.detail.delete || "删除"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Image Viewer Modal */}
            {isImageViewerOpen && item?.originalImageUrl && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setIsImageViewerOpen(false)}
                >
                    <div className="relative max-w-7xl max-h-full">
                        <button
                            className="absolute -top-12 right-0 text-white hover:text-gray-300 text-lg font-semibold bg-black/50 px-4 py-2 rounded"
                            onClick={() => setIsImageViewerOpen(false)}
                        >
                            {language === 'zh' ? '✕ 关闭' : '✕ Close'}
                        </button>
                        <img
                            src={item.originalImageUrl}
                            alt="Full size"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <p className="text-center text-white/70 text-sm mt-4">
                            {language === 'zh' ? '点击图片外部区域关闭' : 'Click outside to close'}
                        </p>
                    </div>
                </div>
            )}
        </main>
    );
}
