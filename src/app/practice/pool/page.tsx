"use client";

/**
 * 待做题库页：AI 生成的练习题生成即入库，这里集中管理。
 * 待做（去做/不做这道）/ 已做 / 已弃（可恢复）三种状态，按渠道筛选。
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, House, PlayCircle, RotateCcw, XCircle } from "lucide-react";
import { apiClient } from "@grow/shared/api-client";

interface PoolQuestionItem {
    id: string;
    channel: string;
    difficulty: string;
    subject?: string | null;
    tagId?: string | null;
    errorItemId?: string | null;
    bankQuestionId?: string | null;
    questionText: string;
    status: string;
    isCorrect?: boolean | null;
    answeredAt?: string | null;
    createdAt: string;
    tag?: { name: string } | null;
    errorItem?: { id: string; questionText: string | null } | null;
}

const CHANNEL_LABELS: Record<string, string> = {
    free: "自由练习",
    similar: "举一反三",
    smart: "薄弱点专项",
};

const DIFFICULTY_LABELS: Record<string, string> = {
    easy: "简单",
    medium: "中等",
    hard: "困难",
    harder: "挑战",
};

const STATUS_TABS = [
    { value: "pending", label: "待做" },
    { value: "answered", label: "已做" },
    { value: "discarded", label: "已弃" },
];

const CHANNEL_TABS = [
    { value: "", label: "全部" },
    { value: "free", label: "自由练习" },
    { value: "similar", label: "举一反三" },
    { value: "smart", label: "薄弱点专项" },
];

function formatDate(iso?: string | null): string {
    if (!iso) return "";
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return "";
    return `${dt.getMonth() + 1}-${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

function doHref(q: PoolQuestionItem): string | null {
    if (q.status !== "pending") return null;
    if (q.channel === "smart" && q.tagId) {
        const params = new URLSearchParams({ tagId: q.tagId, questionId: q.id });
        if (q.tag?.name) params.set("tagName", q.tag.name);
        return `/practice/smart?${params.toString()}`;
    }
    if (q.channel === "similar" && q.errorItemId) {
        const params = new URLSearchParams({ id: q.errorItemId, questionId: q.id });
        return `/practice?${params.toString()}`;
    }
    return null;
}

export default function PoolPage() {
    const [status, setStatus] = useState("pending");
    const [channel, setChannel] = useState("");
    const [questions, setQuestions] = useState<PoolQuestionItem[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async (reset = false) => {
        const targetPage = reset ? 1 : page;
        if (reset) setLoading(true);
        try {
            const params = new URLSearchParams({
                status,
                page: String(targetPage),
                pageSize: "20",
            });
            if (channel) params.set("channel", channel);
            const data = await apiClient.get<{ total: number; questions: PoolQuestionItem[]; pendingCount: number }>(
                `/api/practice/questions?${params.toString()}`
            );
            setPendingCount(data.pendingCount);
            setTotal(data.total);
            setQuestions(prev => (reset ? data.questions : [...prev, ...data.questions]));
            setPage(targetPage);
            setError("");
        } catch (e: any) {
            setError(e?.message || "加载题库失败");
        } finally {
            setLoading(false);
        }
    }, [status, channel, page]);

    useEffect(() => {
        load(true);
    }, [status, channel]); // eslint-disable-line react-hooks/exhaustive-deps

    const patchQuestion = async (q: PoolQuestionItem, action: "discard" | "restore") => {
        try {
            const updated = await apiClient.patch<PoolQuestionItem>(`/api/practice/questions/${q.id}`, { action });
            setQuestions(prev => prev.map(item => (item.id === q.id ? { ...item, status: updated.status } : item)));
            setPendingCount(prev => Math.max(0, prev + (action === "discard" ? -1 : 1)));
        } catch (e: any) {
            setError(e?.message || "操作失败");
        }
    };

    const emptyText: Record<string, { title: string; sub: string }> = {
        pending: { title: "没有待做的题", sub: "生成的练习题都会留在这里，随时回来做" },
        answered: { title: "还没有做过的题", sub: "做完的题会归档到这里" },
        discarded: { title: "没有弃题", sub: "「不做这道」的题会暂存在这里，可随时恢复" },
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => history.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">待做题库</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        生成的题都保留在这里，不做也不丢 · 待做 {pendingCount} 题
                    </p>
                </div>
                <div className="ml-auto flex items-center">
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <House className="h-5 w-5" />
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-2">
                {STATUS_TABS.map(t => (
                    <button
                        key={t.value}
                        onClick={() => setStatus(t.value)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                            status === t.value
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
                <span className="ml-auto text-sm text-muted-foreground">共 {total} 题</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-6">
                {CHANNEL_TABS.map(t => (
                    <button
                        key={t.value}
                        onClick={() => setChannel(t.value)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                            channel === t.value
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
            )}

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <Card key={i}>
                            <CardContent className="py-5 space-y-2">
                                <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
                                <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : questions.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="font-medium">{emptyText[status]?.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{emptyText[status]?.sub}</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {questions.map(q => {
                        const href = doHref(q);
                        return (
                            <Card key={q.id} className={href ? "cursor-pointer hover:border-primary/50" : ""}>
                                <CardContent className="py-4 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="secondary" className="text-xs">
                                            {CHANNEL_LABELS[q.channel] || q.channel}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs">
                                            {DIFFICULTY_LABELS[q.difficulty] || q.difficulty}
                                        </Badge>
                                        {q.bankQuestionId && (
                                            <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                                                题库
                                            </Badge>
                                        )}
                                        {q.status === "answered" && (
                                            <Badge className={`text-xs ${q.isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                                {q.isCorrect ? "答对" : "答错"}
                                            </Badge>
                                        )}
                                        <span className="ml-auto text-xs text-muted-foreground">{formatDate(q.createdAt)}</span>
                                    </div>
                                    <p className="text-sm leading-relaxed line-clamp-3 whitespace-pre-wrap">
                                        {q.questionText || "（无题目内容）"}
                                    </p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {q.tag?.name && <span className="text-xs text-muted-foreground">考点：{q.tag.name}</span>}
                                        {q.errorItem && <span className="text-xs text-muted-foreground">锚定原错题</span>}
                                        {q.status === "answered" && (
                                            <span className="text-xs text-muted-foreground">完成于 {formatDate(q.answeredAt)}</span>
                                        )}
                                        <div className="ml-auto flex items-center gap-2">
                                            {q.status === "pending" && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-muted-foreground"
                                                    onClick={() => patchQuestion(q, "discard")}
                                                >
                                                    <XCircle className="mr-1 h-4 w-4" />
                                                    不做这道
                                                </Button>
                                            )}
                                            {q.status === "discarded" && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-muted-foreground"
                                                    onClick={() => patchQuestion(q, "restore")}
                                                >
                                                    <RotateCcw className="mr-1 h-4 w-4" />
                                                    恢复待做
                                                </Button>
                                            )}
                                            {href && (
                                                <Link href={href}>
                                                    <Button size="sm">
                                                        <PlayCircle className="mr-1 h-4 w-4" />
                                                        去做
                                                    </Button>
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                    {questions.length < total && (
                        <div className="text-center pt-2">
                            <Button variant="outline" onClick={() => load(false)}>
                                加载更多
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
