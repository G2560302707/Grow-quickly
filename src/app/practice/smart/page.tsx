"use client";

/**
 * 专项练习页：针对薄弱点考点连续出题（默认 5 题一组）。
 * 出题面板先选难度（固定四档或 ELO 自适应），点「开始会话」才出题，不自动生成；
 * 固定难度时优先从待做题库取题（零生成成本），池空才调 AI 生成；
 * 每题生成即入库，作答后带 tagId/errorItemId/questionId 归因记录，结束后展示小结。
 */
import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, ArrowLeft, Target, RefreshCw } from "lucide-react";
import { ParsedQuestion } from "@grow/shared/ai/types";
import { parseChoiceOptions, parseCorrectOption } from "@/lib/practice-choice";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { apiClient } from "@grow/shared/api-client";
import { Progress } from "@/components/ui/progress";
import {
    confirmDialog,
} from "@/components/ui/app-dialog";

const SESSION_TOTAL = 5;

interface SmartQuestion extends ParsedQuestion {
    questionId?: string | null;
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

/** 题库单题（取题时拉全量内容） */
interface PoolQuestion {
    id: string;
    channel: string;
    difficulty: string;
    subject?: string | null;
    tagId?: string | null;
    errorItemId?: string | null;
    eloRating?: number | null;
    questionText: string;
    answerText?: string | null;
    analysis?: string | null;
}

type SetupDifficulty = "easy" | "medium" | "hard" | "harder" | "adaptive";

const DIFFICULTY_OPTIONS: { value: SetupDifficulty; label: string }[] = [
    { value: "easy", label: "简单" },
    { value: "medium", label: "中等" },
    { value: "hard", label: "困难" },
    { value: "harder", label: "挑战" },
    { value: "adaptive", label: "自适应" },
];

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

    // 出题面板 → 会话进行中；不自动出题，选难度后点「开始会话」才生成
    const [phase, setPhase] = useState<"setup" | "running">("setup");
    const [setupDifficulty, setSetupDifficulty] = useState<SetupDifficulty | null>(null);
    const [question, setQuestion] = useState<SmartQuestion | null>(null);
    const [loading, setLoading] = useState(false);
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

    const fixedDifficulty = setupDifficulty && setupDifficulty !== "adaptive" ? setupDifficulty : null;

    /** 固定难度时优先从待做题库取题（同考点+同难度），池空返回 null */
    const takeFromPool = useCallback(async (): Promise<SmartQuestion | null> => {
        if (!fixedDifficulty || !tagId) return null;
        const pool = await apiClient
            .get<{ questions: Array<{ id: string }> }>(
                `/api/practice/questions?status=pending&channel=smart&tagId=${encodeURIComponent(tagId)}&difficulty=${fixedDifficulty}&pageSize=1`
            )
            .catch(() => null);
        const hit = pool?.questions?.[0];
        if (!hit) return null;
        const full = await apiClient.get<PoolQuestion>(`/api/practice/questions/${hit.id}`);
        return {
            questionText: full.questionText,
            answerText: full.answerText || "",
            analysis: full.analysis || "",
            subject: (full.subject || undefined) as ParsedQuestion["subject"],
            knowledgePoints: [],
            wrongAnswerText: "",
            mistakeAnalysis: "",
            mistakeStatus: "unknown",
            requiresImage: false,
            questionId: full.id,
            meta: {
                tagId,
                tagName,
                primaryErrorItemId: full.errorItemId || null,
                difficulty: full.difficulty,
                elo: typeof full.eloRating === "number" ? { rating: full.eloRating, attempts: 0 } : undefined,
                source: "weakness",
            },
        };
    }, [fixedDifficulty, tagId, tagName]);

    const generate = useCallback(async () => {
        setLoading(true);
        setError(null);
        setUserAnswer("");
        setSelectedOption(null);
        setSubmitted(false);
        setIsCorrect(null);
        setSavedToNotebook(false);
        try {
            // 池里有匹配的存题直接取用（零生成成本）
            const pooled = await takeFromPool().catch(() => null);
            if (pooled) {
                setQuestion(pooled);
                if (typeof pooled.meta?.elo?.rating === "number") {
                    setRatings(prev => [...prev, pooled.meta!.elo!.rating]);
                }
                setLoading(false);
                return;
            }

            const data = await apiClient.post<SmartQuestion>(
                "/api/practice/smart",
                { tagId, difficulty: fixedDifficulty || undefined },
                { timeout: 180000 }
            );
            setQuestion(data);
            if (typeof data.meta?.elo?.rating === "number") {
                setRatings(prev => [...prev, data.meta!.elo!.rating]);
            }
        } catch (e: any) {
            setError(e?.data?.message || e?.message || "生成练习题失败，请稍后重试");
        } finally {
            setLoading(false);
        }
    }, [tagId, fixedDifficulty, takeFromPool]);

    // 选择题：从题干解析选项、从参考答案解析正确项（解析失败则回退自由作答）
    const choice = question ? parseChoiceOptions(question.questionText) : null;
    const correctLabel = question ? parseCorrectOption(question.answerText) : null;

    // 从待做题库「去做」直达答题：加载指定的题库题
    const pooledQuestionId = searchParams.get("questionId");
    useEffect(() => {
        if (!pooledQuestionId || !tagId) return;
        setLoading(true);
        apiClient.get<PoolQuestion>(`/api/practice/questions/${pooledQuestionId}`)
            .then(full => {
                setSetupDifficulty((full.difficulty as SetupDifficulty) || "medium");
                setQuestion({
                    questionText: full.questionText,
                    answerText: full.answerText || "",
                    analysis: full.analysis || "",
                    subject: (full.subject || undefined) as ParsedQuestion["subject"],
                    knowledgePoints: [],
                    wrongAnswerText: "",
                    mistakeAnalysis: "",
                    mistakeStatus: "unknown",
                    requiresImage: false,
                    questionId: full.id,
                    meta: {
                        tagId,
                        tagName,
                        primaryErrorItemId: full.errorItemId || null,
                        difficulty: full.difficulty,
                        elo: typeof full.eloRating === "number" ? { rating: full.eloRating, attempts: 0 } : undefined,
                        source: "weakness",
                    },
                });
                setPhase("running");
                if (typeof full.eloRating === "number") {
                    setRatings(prev => [...prev, full.eloRating as number]);
                }
            })
            .catch(e => {
                setError(e?.message || "题目加载失败，请回到待做题库重试");
            })
            .finally(() => setLoading(false));
    }, [pooledQuestionId, tagId, tagName]);

    const recordResult = async (match: boolean) => {
        setIsCorrect(match);
        setResults(prev => [...prev, match]);
        try {
            const res = await apiClient.post<{ savedErrorItemId?: string | null }>("/api/practice/record", {
                subject: question?.subject || "Unknown",
                difficulty: question?.meta?.difficulty || fixedDifficulty || "medium",
                isCorrect: match,
                tagId: question?.meta?.tagId || tagId,
                errorItemId: question?.meta?.primaryErrorItemId || undefined,
                questionId: question?.questionId || undefined,
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

    const startSession = () => {
        if (!setupDifficulty) return;
        setPhase("running");
        generate();
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
            const ok = await confirmDialog({ description: "练习尚未完成。已生成的题目会保留在待做题库，确定离开吗？" });
            if (!ok) return;
        }
        router.push("/stats");
    };

    const firstRating = ratings[0] ?? 1200;
    const lastRating = ratings[ratings.length - 1] ?? 1200;
    const correctCount = results.filter(Boolean).length;

    const renderSetup = () => (
        <Card className="max-w-2xl mx-auto">
            <CardHeader className="items-center text-center">
                <CardTitle>开始专项练习 · {tagName}</CardTitle>
                <p className="text-sm text-muted-foreground">
                    连续 {SESSION_TOTAL} 题，作答后自动进入下一题；先选好难度
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 justify-center">
                    {DIFFICULTY_OPTIONS.map(d => (
                        <button
                            key={d.value}
                            type="button"
                            onClick={() => setSetupDifficulty(d.value)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                                setupDifficulty === d.value
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground hover:bg-muted"
                            }`}
                        >
                            {d.label}
                        </button>
                    ))}
                </div>
                {!setupDifficulty && (
                    <p className="text-xs text-center text-muted-foreground">
                        先选一个难度（自适应按你的能力值实时调难度），不会自动出题
                    </p>
                )}
                <Button className="w-full" disabled={!setupDifficulty || loading} onClick={startSession}>
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />正在出题…
                        </>
                    ) : (
                        "开始会话"
                    )}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                    生成的题会自动存入待做题库，做不做都不丢；有存题时优先做存题，不花生成费
                </p>
            </CardContent>
        </Card>
    );

    const renderBody = () => {
        if (!tagId) {
            return (
                <div className="p-8 text-center text-muted-foreground">缺少考点参数，请从统计中心进入专项练习。</div>
            );
        }
        if (phase === "setup") {
            return renderSetup();
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
                            <p className="font-semibold">
                                {fixedDifficulty ? "正在取题" : "AI 正在针对薄弱点出题"}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {fixedDifficulty ? "优先取出待做题库里的存题" : "结合你的错题与错因，定向生成"}
                            </p>
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
                            <RefreshCw className="mr-2 h-4 w-4" />重新出题
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
                                    {question.questionId ? " · 题库存题" : ""}
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
                        {fixedDifficulty ? `固定难度出题，优先做待做题库的存题` : "针对薄弱点定向出题，难度随你的作答自动调整"}
                    </p>
                </div>
            </div>
            {phase === "running" && results.length > 0 && !done && (
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
