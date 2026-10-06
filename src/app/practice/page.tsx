"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, CheckCircle, Eye, Send, XCircle, ArrowLeft, House } from "lucide-react";
import { ParsedQuestion } from "@grow/shared/ai/types";
import { parseChoiceOptions, parseCorrectOption } from "@/lib/practice-choice";
import { useLanguage } from "@/contexts/LanguageContext";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { apiClient } from "@grow/shared/api-client";
import { AppConfig } from "@grow/shared/types/api";
import { frontendLogger } from "@/lib/frontend-logger";

export const dynamic = 'force-dynamic';

/** 生成/题库题目：生成接口返回带 questionId（生成即入库） */
type PracticeQuestion = ParsedQuestion & { questionId?: string | null };

/** 题库单题（"去做/取题"时拉全量内容） */
interface PoolQuestion {
    id: string;
    channel: string;
    difficulty: string;
    subject?: string | null;
    questionText: string;
    answerText?: string | null;
    analysis?: string | null;
}

function PracticeContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const errorItemId = searchParams.get("id");
    const { t, language } = useLanguage();

    const [question, setQuestion] = useState<PracticeQuestion | null>(null);
    const [loading, setLoading] = useState(false);
    const [showAnswer, setShowAnswer] = useState(false);
    const [userAnswer, setUserAnswer] = useState("");
    const [notes, setNotes] = useState("");
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [savedErrorItemId, setSavedErrorItemId] = useState<string | null>(null);
    const [config, setConfig] = useState<AppConfig | null>(null);

    // 选择题：解析选项与正确项（解析失败回退自由输入）
    const choice = question ? parseChoiceOptions(question.questionText) : null;
    const correctLabel = question ? parseCorrectOption(question.answerText) : null;

    useEffect(() => {
        apiClient.get<AppConfig>("/api/settings")
            .then(data => {
                setConfig(data);
                if (data.timeouts?.analyze) {
                    frontendLogger.info('[Config]', 'Loaded timeout settings', {
                        analyze: data.timeouts.analyze
                    });
                }
            })
            .catch(err => console.error(err));
    }, []);

    // 从待做题库「去做」直达答题：加载指定的题库题
    const pooledQuestionId = searchParams.get("questionId");
    useEffect(() => {
        if (!pooledQuestionId) return;
        setLoading(true);
        apiClient.get<PoolQuestion>(`/api/practice/questions/${pooledQuestionId}`)
            .then(full => {
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
                });
                setDifficulty((full.difficulty as "easy" | "medium" | "hard" | "harder") || null);
                setFromPool(true);
            })
            .catch(err => {
                console.error(err);
                setError("题目加载失败，请回到待做题库重试");
            })
            .finally(() => setLoading(false));
    }, [pooledQuestionId]);

    // 难度必须显式选择，没有默认值（不自动出题）
    const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "harder" | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [fromPool, setFromPool] = useState(false);

    /**
     * 出题：优先从待做题库取同难度存题（零生成成本），池空或 forceNew 时才调 AI。
     * difficulty 未选择时不动作（按钮已禁用，这里兜底）。
     */
    const generateQuestion = async (forceNew = false) => {
        if (!errorItemId || !difficulty) return;

        setLoading(true);
        setError(null);
        setUserAnswer("");
        setNotes("");
        setIsSubmitted(false);
        setIsCorrect(null);
        setShowAnswer(false);
        setSelectedOption(null);
        setSavedErrorItemId(null);

        try {
            if (!forceNew) {
                const pool = await apiClient.get<{ questions: Array<{ id: string }> }>(
                    `/api/practice/questions?status=pending&channel=similar&errorItemId=${encodeURIComponent(errorItemId)}&difficulty=${difficulty}&pageSize=1`
                ).catch(() => null);
                const hit = pool?.questions?.[0];
                if (hit) {
                    const full = await apiClient.get<PoolQuestion>(`/api/practice/questions/${hit.id}`);
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
                    });
                    setFromPool(true);
                    setLoading(false);
                    return;
                }
            }

            setFromPool(false);
            const timeout = config?.timeouts?.analyze || 180000;
            frontendLogger.info('[Practice]', 'Generating question', {
                timeout
            });
            const data = await apiClient.post<PracticeQuestion>("/api/practice/generate", {
                errorItemId,
                language,
                difficulty
            }, { timeout });
            setQuestion(data);
        } catch (error: any) {
            console.error(error);
            const msg = error.data?.message || "";

            let errorMessage = t.practice.errors?.default || "Failed to generate";

            if (msg.includes('AI_CONNECTION_FAILED')) {
                errorMessage = t.errors?.aiConnectionFailed || errorMessage;
            } else if (msg.includes('AI_RESPONSE_ERROR')) {
                errorMessage = t.errors?.aiResponseError || errorMessage;
            } else if (msg.includes('AI_AUTH_ERROR')) {
                errorMessage = t.errors?.aiAuth || errorMessage;
            } else if (msg.includes('AI_UNKNOWN_ERROR')) {
                errorMessage = t.errors?.AI_UNKNOWN_ERROR || errorMessage;
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const submitAnswer = async () => {
        if (!question) return;
        if (choice) {
            if (selectedOption === null) return;
            setUserAnswer(choice.options[selectedOption].label);
        } else if (!userAnswer.trim()) {
            return;
        }

        setIsSubmitted(true);

        const normalize = (str: string) => str.trim().toLowerCase().replace(/[.,;!]/g, '');
        const user = normalize(userAnswer);
        const correct = normalize(question.answerText);

        // Enhanced comparison logic
        let isMatch = user === correct;

        // Handle multiple choice (e.g. user enters "A" but answer is "A. some text")
        if (!isMatch && /^[a-d]$/.test(user)) {
            isMatch = correct.startsWith(user);
        }

        // Handle case where answer contains the user input (e.g. answer is "The answer is 5" and user enters "5")
        if (!isMatch && correct.includes(user) && user.length > 1) {
            isMatch = true;
        }

        // 选择题能解析出正确项时以选项相等为准，避免答案文本不规整导致误判
        if (choice && correctLabel && selectedOption !== null) {
            isMatch = choice.options[selectedOption].label === correctLabel;
        }

        setIsCorrect(isMatch);
        setShowAnswer(true);

        // Save practice record（题库题带 questionId 联动状态，答错时后端自动收录错题本）
        try {
            const res = await apiClient.post<{ savedErrorItemId?: string | null }>("/api/practice/record", {
                subject: question.subject || "Unknown",
                difficulty: difficulty || "medium",
                isCorrect: isMatch,
                errorItemId: errorItemId || undefined,
                questionId: question.questionId || undefined,
                questionText: question.questionText,
                answerText: question.answerText,
                analysis: question.analysis,
                knowledgePoints: question.knowledgePoints,
            });
            setSavedErrorItemId(res?.savedErrorItemId || null);
        } catch (err) {
            console.error("Failed to save practice record:", err);
        }
    };

    if (!errorItemId) {
        return <div className="p-8 text-center">{t.practice.invalidRequest || "Invalid Request"}</div>;
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex justify-between items-center mb-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t.common?.back || "返回"}
                </Button>
                <Link href="/">
                    <Button variant="ghost" size="icon">
                        <House className="h-5 w-5" />
                    </Button>
                </Link>
            </div>
            <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold">{t.practice.title}</h1>
                <p className="text-muted-foreground">
                    {t.practice.subtitle}
                </p>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                        <strong className="font-bold">{t.common?.error || "Error"}: </strong>
                        <span className="block whitespace-pre-wrap"> {error}</span>
                    </div>
                )}

                {!question && (
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg">
                            <span className="text-sm font-medium text-muted-foreground">{t.practice.difficulty?.label || "Difficulty"}:</span>
                            <div className="flex gap-1">
                                {[
                                    { value: "easy", label: t.practice.difficulty?.easy || "Easy", color: "bg-green-100 text-green-700 hover:bg-green-200" },
                                    { value: "medium", label: t.practice.difficulty?.medium || "Medium", color: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
                                    { value: "hard", label: t.practice.difficulty?.hard || "Hard", color: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
                                    { value: "harder", label: t.practice.difficulty?.harder || "Challenge", color: "bg-red-100 text-red-700 hover:bg-red-200" }
                                ].map((level) => (
                                    <button
                                        key={level.value}
                                        onClick={() => setDifficulty(level.value as "easy" | "medium" | "hard" | "harder")}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${difficulty === level.value
                                            ? level.color.replace("bg-", "bg-opacity-100 bg-").replace("text-", "ring-2 ring-offset-1 ring-")
                                            : "bg-transparent hover:bg-muted text-muted-foreground"
                                            } ${difficulty === level.value ? level.color : ''}`}
                                    >
                                        {level.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {!difficulty && (
                            <p className="text-xs text-muted-foreground">先选一个难度，再开始练习（不会自动出题）</p>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                                size="lg"
                                onClick={() => generateQuestion(false)}
                                disabled={loading || !difficulty}
                                title={difficulty ? "优先取用待做题库的存题，池空才生成新题" : "请先选择难度"}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t.practice.generating}
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        {t.practice.generate}
                                    </>
                                )}
                            </Button>
                            {difficulty && (
                                <Button size="lg" variant="outline" onClick={() => generateQuestion(true)} disabled={loading}>
                                    跳过存题，生成新题
                                </Button>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground text-center max-w-md">
                            生成的题会自动存入待做题库，做不做都不丢；有存题时优先做存题，不花生成费
                        </p>
                    </div>
                )}
            </div>

            {question && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="border-primary/50 shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                                <span>{t.app.practiceProblem}</span>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={difficulty || ""}
                                        onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard" | "harder")}
                                        className="h-8 text-xs border rounded px-2 bg-background"
                                        disabled={loading}
                                    >
                                        {!difficulty && <option value="">选择难度</option>}
                                        <option value="easy">{t.practice.difficulty?.easy || "Easy"}</option>
                                        <option value="medium">{t.practice.difficulty?.medium || "Medium"}</option>
                                        <option value="hard">{t.practice.difficulty?.hard || "Hard"}</option>
                                        <option value="harder">{t.practice.difficulty?.harder || "Challenge"}</option>
                                    </select>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => generateQuestion(true)}
                                        disabled={loading || !difficulty}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                {t.practice.generating}
                                            </>
                                        ) : (
                                            <>
                                                <RefreshCw className="mr-2 h-4 w-4" />
                                                {t.practice.regenerate}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {fromPool && (
                                <p className="text-xs text-muted-foreground mb-2">本题取自待做题库（未花费生成）</p>
                            )}
                            <MarkdownRenderer content={question.questionText} className="font-medium" />
                        </CardContent>
                    </Card>


                    {/* Answer Input Section */}
                    <Card className="border-blue-200">
                        <CardHeader>
                            <CardTitle className="text-blue-600">
                                {choice ? "选择答案" : t.app.yourAnswer || "你的答案"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {choice ? (
                                <div className="space-y-2" role="radiogroup" aria-label="选项">
                                    {choice.options.map((opt, idx) => {
                                        const isCorrectOption = isSubmitted && correctLabel === opt.label;
                                        const isWrongPicked = isSubmitted && correctLabel !== null && selectedOption === idx && correctLabel !== opt.label;
                                        return (
                                            <button
                                                key={opt.label}
                                                type="button"
                                                role="radio"
                                                aria-checked={selectedOption === idx}
                                                disabled={isSubmitted}
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
                                <Input
                                    placeholder={t.app.answerPlaceholder || "输入你的答案..."}
                                    value={userAnswer}
                                    onChange={(e) => setUserAnswer(e.target.value)}
                                    disabled={isSubmitted}
                                    className="text-lg"
                                />
                            )}
                            <Textarea
                                placeholder={t.app.notesPlaceholder || "记录解题思路（可选）..."}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                disabled={isSubmitted}
                                rows={3}
                            />
                        </CardContent>
                    </Card>

                    {/* Submit/Result Section */}
                    {!isSubmitted ? (
                        <div className="flex justify-center">
                            <Button
                                size="lg"
                                onClick={submitAnswer}
                                disabled={choice ? selectedOption === null : !userAnswer.trim()}
                                className="w-full md:w-auto"
                            >
                                <Send className="mr-2 h-4 w-4" />
                                {t.app.submitAnswer || "提交答案"}
                            </Button>
                        </div>
                    ) : (
                        <Card className={isCorrect ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3 mb-4">
                                    {isCorrect ? (
                                        <>
                                            <CheckCircle className="h-8 w-8 text-green-600" />
                                            <div>
                                                <h3 className="text-xl font-bold text-green-600">
                                                    {t.practice.correct || "回答正确！"}
                                                </h3>
                                                <p className="text-green-700">
                                                    {t.practice.correctMessage || "太棒了，继续保持！"}
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <XCircle className="h-8 w-8 text-red-600" />
                                            <div>
                                                <h3 className="text-xl font-bold text-red-600">
                                                    {t.practice.incorrect || "答案有误"}
                                                </h3>
                                                <p className="text-red-700">
                                                    {t.practice.incorrectMessage || "再看看解析，加油！"}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {!isCorrect && savedErrorItemId && (
                                    <p className="text-sm text-muted-foreground">
                                        本题已自动收录到错题本（来源：举一反三），可在错题本中复习
                                    </p>
                                )}
                                {notes && (
                                    <div className="mt-4 p-3 bg-white rounded-lg border">
                                        <p className="text-sm font-medium text-gray-600 mb-1">
                                            {t.practice.yourNotes || "你的笔记："}
                                        </p>
                                        <p className="text-gray-700 whitespace-pre-wrap">{notes}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {isSubmitted && (
                        <div className="flex gap-3 justify-center">
                            <Button variant="outline" onClick={() => generateQuestion(false)} disabled={loading || !difficulty}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                再来一题（优先做存题）
                            </Button>
                            <Button variant="ghost" onClick={() => router.back()}>
                                {t.common?.back || "返回"}
                            </Button>
                        </div>
                    )}

                    {showAnswer && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                            <Card className="bg-muted/50">
                                <CardHeader>
                                    <CardTitle className="text-green-600">{t.practice.correctAnswer}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <MarkdownRenderer content={question.answerText} className="font-bold" />
                                </CardContent>
                            </Card>


                            <Card>
                                <CardHeader>
                                    <CardTitle>{t.practice.detailedAnalysis}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <MarkdownRenderer content={question.analysis} />
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function PracticePage() {
    return (
        <main className="min-h-screen p-8 bg-background">
            <Suspense fallback={
                <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            }>
                <PracticeContent />
            </Suspense>
        </main>
    );
}
