"use client";

/**
 * 专项练习页：针对薄弱点考点连续出题（默认 5 题一组）。
 * 走 POST /api/practice/smart（后端按该考点错题+错因接地生成，Elo 自适应难度），
 * 每题作答后带 tagId/errorItemId 归因记录，结束后展示小结。
 */
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, ArrowLeft, Target, RefreshCw } from "lucide-react";
import { ParsedQuestion } from "@/lib/ai/types";
import { parseChoiceOptions, parseCorrectOption } from "@/lib/practice-choice";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { apiClient } from "@/lib/api-client";
import { Progress } from "@/components/ui/progress";
import {
    alertDialog,
    confirmDialog,
} from "@/components/ui/app-dialog";

const SESSION_TOTAL = 5;

interface SmartQuestion extends ParsedQuestion {
    meta?: {
        tagId: string;
        tagName: string;
        primaryErrorItemId: string | null;
        difficulty: string;
        elo?: { rating: number; attempts: number };
        source: string;
        duplicate?: boolean;
    };
}

function normalize(str: string) {
    return str.trim().toLowerCase().replace(/[.,;!]/g, "");
}

function SmartPracticeContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const tagId = searchParams.get("tagId") || "";
    const tagName = searchParams.get("tagName")
        ? decodeURIComponent(searchParams.get("tagName") as string)
        : "薄弱点专项";

    const [question, setQuestion] = useState<SmartQuestion | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userAnswer, setUserAnswer] = useState("");
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [savedToNotebook, setSavedToNotebook] = useState(false);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [sessionIndex, setSessionIndex] = useState(1);
    const [results, setResults] = useState<boolean[]>([]);
    const [ratings, setRatings] = useState<number[]>([]);
    const [done, setDone] = useState(false);

    const generate = useCallback(async () => {
        setLoading(true);
        setError(null);
        setUserAnswer("");
        setSelectedOption(null);
        setSubmitted(false);
        setIsCorrect(null);
        setSavedToNotebook(false);
        try {
            const data = await apiClient.post<SmartQuestion>("/api/practice/smart", { tagId }, { timeout: 180000 });
            setQuestion(data);
            if (typeof data.meta?.elo?.rating === "number") {
                setRatings(prev => [...prev, data.meta!.elo!.rating]);
            }
        } catch (e: any) {
            setError(e?.data?.message || e?.message || "生成练习题失败，请稍后重试");
        } finally {
            setLoading(false);
        }
    }, [tagId]);

    // 首题加载
    useEffect(() => {
        if (tagId) generate();
    }, [tagId, generate]);

    // 选择题：从题干解析选项、从参考答案解析正确项（解析失败则回退自由作答）
    const choice = question ? parseChoiceOptions(question.questionText) : null;
    const correctLabel = question ? parseCorrectOption(question.answerText) : null;

    const recordResult = async (match: boolean) => {
        setIsCorrect(match);
        setResults(prev => [...prev, match]);
        try {
            const res = await apiClient.post<{ savedErrorItemId?: string | null }>("/api/practice/record", {
                subject: question?.subject || "Unknown",
                difficulty: question?.meta?.difficulty || "medium",
                isCorrect: match,
                tagId: question?.meta?.tagId || tagId,
                errorItemId: question?.meta?.primaryErrorItemId || undefined,
                questionText: question?.questionText || undefined,
                answerText: question?.answerText || undefined,
                analysis: question?.analysis || undefined,
                knowledgePoints: question?.knowledgePoints || undefined,
            });
            setSavedToNotebook(Boolean(res?.savedErrorItemId));
        } catch (e) {
            console.error("Failed to save practice record:", e);
        }
    };

    const judgeAndRecord = (answerText: string) => {
        const user = normalize(answerText);
        const correct = normalize(question?.answerText || "");
        let match = user === correct;
        if (!match && /^[a-d]$/.test(user)) match = correct.startsWith(user);
        if (!match && correct.includes(user) && user.length > 1) match = true;
        return recordResult(match);
    };

    const submitAnswer = async () => {
        if (!question) return;
        if (choice && selectedOption !== null) {
            // 选择题：以选项字母作答；能确定正确选项则自动判分
            const picked = choice.options[selectedOption];
            setUserAnswer(picked.label);
            setSubmitted(true);
            if (correctLabel) {
                await recordResult(picked.label === correctLabel);
            } else {
                // 参考答案没有明确选项字母，退回文本比对（单字母前缀规则仍适用）
                await judgeAndRecord(picked.label);
            }
            return;
        }
        if (!userAnswer.trim()) return;
        setSubmitted(true);
        await judgeAndRecord(userAnswer);
    };

    const nextQuestion = async () => {
        if (results.length >= SESSION_TOTAL) {
            setDone(true);
            setQuestion(null);
            return;
        }
        setSessionIndex(i => i + 1);
        await generate();
    };

    const restart = async () => {
        const ok = await confirmDialog({ description: "开始新的一组练习？当前小结将被清空。" });
        if (!ok) return;
        setResults([]);
        setRatings([]);
        setSessionIndex(1);
        setDone(false);
        await generate();
    };

    const handleBack = async () => {
        if (results.length > 0 && results.length < SESSION_TOTAL) {
            const ok = await confirmDialog({ description: "练习尚未完成，确定离开吗？" });
            if (!ok) return;
        }
        router.push("/stats");
    };

    const firstRating = ratings[0] ?? 1200;
    const lastRating = ratings[ratings.length - 1] ?? 1200;
    const correctCount = results.filter(Boolean).length;

    const renderBody = () => {
        if (!tagId) {
            return (
                <div className="p-8 text-center text-muted-foreground">缺少考点参数，请从统计中心进入专项练习。</div>
            );
        }
        if (done) {
            const allCorrect = correctCount === SESSION_TOTAL;
            return (
                <Card className="max-w-2xl mx-auto">
                    <CardHeader className="items-center text-center">
                        <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold ${allCorrect ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-primary/10 text-primary"}`}>
                            {correctCount}/{SESSION_TOTAL}
                        </div>
                        <CardTitle className="text-center mt-2">
                            {allCorrect ? "全对！这个考点已经拿下" : correctCount >= 3 ? "进步明显，继续保持" : "这个考点还需要多练"}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            「{tagName}」专项 {SESSION_TOTAL} 题完成，难度已按你的作答自动调整
                        </p>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button variant="outline" className="flex-1" onClick={restart}>
                            <RefreshCw className="mr-2 h-4 w-4" />再来一组
                        </Button>
                        <Button className="flex-1" onClick={() => router.push("/stats")}>
                            返回统计中心
                        </Button>
                    </CardContent>
                </Card>
            );
        }
        if (loading) {
            return (
                <Card className="max-w-2xl mx-auto">
                    <CardContent className="flex flex-col items-center gap-4 py-12">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <div className="text-center">
                            <p className="font-semibold">AI 正在针对薄弱点出题</p>
                            <p className="text-sm text-muted-foreground mt-1">结合你的错题与错因，定向生成</p>
                        </div>
                    </CardContent>
                </Card>
            );
        }
        if (error) {
            return (
                <Card className="max-w-2xl mx-auto">
                    <CardContent className="flex flex-col items-center gap-4 py-12">
                        <p className="text-destructive text-center">{error}</p>
                        <Button variant="outline" onClick={generate}>
                            <RefreshCw className="mr-2 h-4 w-4" />重新生成
                        </Button>
                    </CardContent>
                </Card>
            );
        }
        if (question) {
            return (
                <div className="space-y-4 max-w-2xl mx-auto">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center justify-between">
                                <span>第 {sessionIndex} / {SESSION_TOTAL} 题</span>
                                <span className="text-xs font-normal text-muted-foreground">
                                    {question.meta?.source === "review_due" ? "到期复习题" : "薄弱点专项"}
                                    {question.meta?.elo ? ` · 能力值 ${question.meta.elo.rating}` : ""}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="whitespace-pre-wrap leading-relaxed">{choice ? choice.stem : question.questionText || "—"}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">{choice ? "选择答案" : "我的作答"}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {choice ? (
                                <div className="space-y-2" role="radiogroup" aria-label="选项">
                                    {choice.options.map((opt, idx) => {
                                        const isCorrectOption = submitted && correctLabel === opt.label;
                                        const isWrongPicked = submitted && correctLabel !== null && selectedOption === idx && correctLabel !== opt.label;
                                        return (
                                            <button
                                                key={opt.label}
                                                type="button"
                                                role="radio"
                                                aria-checked={selectedOption === idx}
                                                disabled={submitted}
                                                onClick={() => setSelectedOption(idx)}
                                                className={`w-full text-left flex items-start gap-3 rounded-lg border p-3 transition-colors disabled:cursor-default ${
                                                    isCorrectOption
                                                        ? "border-green-600 bg-green-50 dark:bg-green-950/40"
                                                        : isWrongPicked
                                                            ? "border-red-600 bg-red-50 dark:bg-red-950/40"
                                                            : selectedOption === idx
                                                                ? "border-primary bg-primary/5"
                                                                : "bg-muted/30 hover:bg-muted"
                                                }`}
                                            >
                                                <span className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-sm font-bold ${
                                                    isCorrectOption
                                                        ? "border-green-600 bg-green-600 text-white"
                                                        : isWrongPicked
                                                            ? "border-red-600 bg-red-600 text-white"
                                                            : selectedOption === idx
                                                                ? "border-primary bg-primary text-primary-foreground"
                                                                : "text-muted-foreground"
                                                }`}>
                                                    {opt.label}
                                                </span>
                                                <span className="text-sm leading-relaxed">{opt.text}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <Textarea
                                    value={userAnswer}
                                    onChange={(e) => setUserAnswer(e.target.value)}
                                    placeholder="写下你的答案和解题过程..."
                                    rows={3}
                                    disabled={submitted}
                                />
                            )}
                            {!submitted ? (
                                <Button className="w-full" disabled={choice ? selectedOption === null : !userAnswer.trim()} onClick={submitAnswer}>
                                    提交并查看答案
                                </Button>
                            ) : (
                                <div className="space-y-3">
                                    <div className={`flex items-center gap-2 text-sm font-medium ${isCorrect ? "text-green-600" : "text-red-600"}`}>
                                        {isCorrect ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                        {isCorrect ? "回答正确" : "回答有误，看看解析"}
                                    </div>
                                    {!isCorrect && savedToNotebook && (
                                        <p className="text-xs text-muted-foreground">本题已自动收录到错题本（来源：薄弱点专项），可在错题本中复习</p>
                                    )}
                                    <div className="rounded-lg border bg-muted/30 p-3">
                                        <p className="text-xs text-muted-foreground mb-1">参考答案</p>
                                        <p className="text-sm font-medium">{question.answerText || "—"}</p>
                                    </div>
                                    {question.analysis && (
                                        <div className="rounded-lg border p-3">
                                            <p className="text-xs text-muted-foreground mb-2">解析</p>
                                            <MarkdownRenderer content={question.analysis} />
                                        </div>
                                    )}
                                    <Button className="w-full" onClick={nextQuestion}>
                                        {results.length >= SESSION_TOTAL ? "查看小结" : "下一题"}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={handleBack}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Target className="h-6 w-6 text-primary" />
                        专项练习 · {tagName}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        针对薄弱点定向出题，难度随你的作答自动调整
                    </p>
                </div>
            </div>
            {results.length > 0 && !done && (
                <div className="mb-4 max-w-2xl mx-auto">
                    <Progress value={(results.length / SESSION_TOTAL) * 100} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1 text-right">
                        已完成 {results.length} / {SESSION_TOTAL} · 答对 {correctCount}
                    </p>
                </div>
            )}
            {renderBody()}
        </div>
    );
}

export default function SmartPracticePage() {
    return (
        <>
            <SmartPracticeContent />
        </>
    );
}
