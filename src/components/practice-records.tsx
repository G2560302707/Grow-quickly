"use client";

/**
 * 练习记录窗口：最近练过的题、对错与来源渠道（薄弱点专项 / 举一反三 / 自由练习）。
 * 数据来自 GET /api/practice/records，答错的题后端已自动收录进错题本。
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";

interface PracticeRecordItem {
    id: string;
    subject?: string;
    difficulty?: string;
    isCorrect?: boolean;
    questionText?: string;
    answerText?: string;
    analysis?: string;
    errorItemId?: string;
    tagId?: string;
    tag?: { name: string };
    createdAt: string;
}

function sourceLabel(r: PracticeRecordItem) {
    if (r.tagId) return r.tag?.name ? `薄弱点专项 · ${r.tag.name}` : "薄弱点专项";
    if (r.errorItemId) return "举一反三";
    return "自由练习";
}

export function PracticeRecords() {
    const [records, setRecords] = useState<PracticeRecordItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        apiClient
            .get<{ total: number; records: PracticeRecordItem[] }>("/api/practice/records?page=1&pageSize=10")
            .then(data => {
                setRecords(data.records || []);
                setTotal(data.total || 0);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base">练习记录{total > 0 ? ` · 共 ${total} 次` : ""}</CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <p className="text-sm text-muted-foreground">加载中…</p>
                ) : records.length === 0 ? (
                    <p className="text-sm text-muted-foreground">还没有练习记录，去「薄弱点专项」练几题吧。</p>
                ) : (
                    <ul className="space-y-3">
                        {records.map(r => {
                            const expanded = expandedId === r.id;
                            return (
                                <li
                                    key={r.id}
                                    className="rounded-lg border p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                                    onClick={() => setExpandedId(expanded ? null : r.id)}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge variant={r.isCorrect ? "secondary" : "destructive"} className="text-xs">
                                            {r.isCorrect ? "答对" : "答错"}
                                        </Badge>
                                        <span className="text-xs text-primary font-medium truncate">{sourceLabel(r)}</span>
                                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                                            {new Date(r.createdAt).toLocaleString("zh-CN", {
                                                month: "numeric",
                                                day: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    </div>
                                    <p className={expanded ? "text-sm whitespace-pre-wrap" : "text-sm line-clamp-2 whitespace-pre-wrap"}>
                                        {r.questionText || "（无题目快照）"}
                                    </p>
                                    {expanded && (
                                        <div className="mt-3 space-y-2 border-t pt-2" onClick={e => e.stopPropagation()}>
                                            {r.answerText ? (
                                                <div className="rounded-lg bg-muted/30 p-2">
                                                    <p className="text-xs text-muted-foreground mb-1">参考答案</p>
                                                    <p className="text-sm font-medium whitespace-pre-wrap">{r.answerText}</p>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">该记录保存时未存答案与解析快照</p>
                                            )}
                                            {r.analysis && (
                                                <div className="rounded-lg border p-2">
                                                    <p className="text-xs text-muted-foreground mb-1">解析</p>
                                                    <p className="text-sm whitespace-pre-wrap">{r.analysis}</p>
                                                </div>
                                            )}
                                            {r.errorItemId && (
                                                <Link href={`/error-items/${r.errorItemId}`} className="text-xs text-primary font-medium" onClick={e => e.stopPropagation()}>
                                                    查看原错题 →
                                                </Link>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
