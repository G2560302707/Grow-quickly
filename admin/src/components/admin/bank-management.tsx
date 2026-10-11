"use client";

/**
 * 题库管理（管理员）：题册文本批量导入 → AI 离线解析（分批推进可续跑）→ 审核发布 → 覆盖度统计。
 * 数据走 /api/bank/*（import / import/parse / questions / questions/batch / stats / tags）。
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select, SelectGroup, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { alertDialog } from "@/components/ui/app-dialog";
import { apiClient } from "@grow/shared/api-client";
import {
    Loader2, Upload, Play, Pause, CheckCheck, Ban, Trash2, Pencil, RefreshCw,
    AlertTriangle, Copy, Library, BarChart3, Inbox,
} from "lucide-react";

const SUBJECTS = ["言语理解", "判断推理", "数量关系", "资料分析", "常识判断", "其他"];
const DIFFICULTIES = [
    { value: "easy", label: "简单" },
    { value: "medium", label: "中等" },
    { value: "hard", label: "困难" },
    { value: "harder", label: "挑战" },
];
const STATUS_LABELS: Record<string, string> = {
    raw: "待解析",
    parse_lock: "解析中",
    pending: "待审核",
    published: "已发布",
    disabled: "已下架",
};
const CONFIDENCE_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };

interface BankQuestionItem {
    id: string;
    subject: string;
    difficulty: string;
    questionType: string;
    questionText: string;
    answerText: string | null;
    analysis: string | null;
    requiresImage: boolean;
    source: string | null;
    status: string;
    duplicateOf: string | null;
    confidence: string | null;
    rawText: string | null;
    attemptCount: number;
    correctCount: number;
    createdAt: string;
    primaryTag: { id: string; name: string; parentId: string | null } | null;
    importBatch: { id: string; name: string } | null;
}

interface TagModule {
    id: string;
    name: string;
    points: { id: string; name: string; leaves: { id: string; name: string }[] }[];
}

interface BatchItem {
    id: string;
    name: string;
    source: string | null;
    totalCount: number;
    autoPublish: boolean;
    status: string;
    createdAt: string;
    progress: Record<string, number>;
}

export function BankManagement() {
    const [tab, setTab] = useState("review");
    const [tagModules, setTagModules] = useState<TagModule[]>([]);

    useEffect(() => {
        apiClient.get<{ modules: TagModule[] }>("/api/bank/tags")
            .then(res => setTagModules(res?.modules ?? []))
            .catch(() => setTagModules([]));
    }, []);

    return (
        <Tabs value={tab} onValueChange={setTab} className="space-y-4 py-4">
            <TabsList>
                <TabsTrigger value="review" className="gap-1.5"><Inbox className="h-4 w-4" />审核工作台</TabsTrigger>
                <TabsTrigger value="import" className="gap-1.5"><Upload className="h-4 w-4" />批量导入</TabsTrigger>
                <TabsTrigger value="stats" className="gap-1.5"><BarChart3 className="h-4 w-4" />覆盖度统计</TabsTrigger>
            </TabsList>
            <TabsContent value="review"><ReviewTab tagModules={tagModules} /></TabsContent>
            <TabsContent value="import"><ImportTab tagModules={tagModules} /></TabsContent>
            <TabsContent value="stats"><StatsTab /></TabsContent>
        </Tabs>
    );
}

/* ============================== 导入 Tab ============================== */

function ImportTab({ tagModules }: { tagModules: TagModule[] }) {
    const [name, setName] = useState("");
    const [source, setSource] = useState("");
    const [rawText, setRawText] = useState("");
    const [autoPublish, setAutoPublish] = useState(true);
    const [creating, setCreating] = useState(false);
    const [batches, setBatches] = useState<BatchItem[]>([]);
    const [parsingBatch, setParsingBatch] = useState<string | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const stopRef = useRef(false);

    const loadBatches = useCallback(async () => {
        try {
            const res = await apiClient.get<{ items: BatchItem[] }>("/api/bank/import");
            setBatches(res?.items ?? []);
        } catch {
            setBatches([]);
        }
    }, []);

    useEffect(() => {
        loadBatches();
    }, [loadBatches]);

    const runParseLoop = async (batchId: string) => {
        setParsingBatch(batchId);
        setParseError(null);
        stopRef.current = false;
        try {
            for (let i = 0; i < 10000; i++) {
                if (stopRef.current) break;
                const res = await apiClient.post<{ done: boolean; progress: Record<string, number> }>(
                    "/api/bank/import/parse", { batchId },
                );
                setBatches(prev => prev.map(b => b.id === batchId ? { ...b, progress: res.progress ?? b.progress } : b));
                if (res.done) break;
            }
        } catch (error: any) {
            setParseError(error?.data?.message || "解析失败，可点击继续重试（已解析的进度会保留）");
        } finally {
            setParsingBatch(null);
            loadBatches();
        }
    };

    const createImport = async () => {
        if (rawText.trim().length < 30) {
            await alertDialog({ description: "请先粘贴题目文本（至少 30 字符）" });
            return;
        }
        setCreating(true);
        try {
            const res = await apiClient.post<{ batchId: string; totalCount: number }>("/api/bank/import", {
                name: name.trim() || undefined,
                source: source.trim() || undefined,
                rawText,
                autoPublish,
            });
            setRawText("");
            setName("");
            setSource("");
            await loadBatches();
            await runParseLoop(res.batchId);
        } catch (error: any) {
            await alertDialog({ description: error?.data?.message || "导入失败" });
        } finally {
            setCreating(false);
        }
    };

    const doneOf = (b: BatchItem) => b.totalCount - (b.progress.raw || 0) - (b.progress.parse_lock || 0);

    return (
        <div className="space-y-4">
            <div className="border rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="bank-import-name">批次名称</Label>
                        <Input id="bank-import-name" placeholder="如：2026 国考行测题册" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="bank-import-source">来源（留痕，建议必填）</Label>
                        <Input id="bank-import-source" placeholder="如：某教材第三章 / 自整理" value={source} onChange={e => setSource(e.target.value)} />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="bank-import-text">题目文本（支持整卷/题册粘贴，按题号 1. 2、12． 自动切分）</Label>
                    <Textarea
                        id="bank-import-text"
                        placeholder={"1. 下列选项中……\nA. ……  B. ……  C. ……  D. ……\n答案：B\n解析：……\n\n2. ……"}
                        className="min-h-[180px] font-mono text-xs"
                        value={rawText}
                        onChange={e => setRawText(e.target.value)}
                    />
                </div>
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                        <Checkbox checked={autoPublish} onCheckedChange={(v) => setAutoPublish(v === true)} />
                        解析后直接发布（低置信度、疑似重复、无考点的题仍会进待审核）
                    </label>
                    <Button onClick={createImport} disabled={creating || parsingBatch !== null}>
                        {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                        切分并开始解析
                    </Button>
                </div>
            </div>

            {parseError && (
                <div className="border border-destructive/40 bg-destructive/10 text-destructive text-sm rounded-lg p-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />{parseError}
                </div>
            )}

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium flex items-center gap-1.5"><Library className="h-4 w-4 text-muted-foreground" />导入批次</h3>
                    <Button variant="ghost" size="sm" onClick={loadBatches}><RefreshCw className="h-3.5 w-3.5" /></Button>
                </div>
                {batches.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">还没有导入记录。</p>
                ) : batches.map(batch => {
                    const done = doneOf(batch);
                    const running = parsingBatch === batch.id;
                    return (
                        <div key={batch.id} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{batch.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(batch.createdAt).toLocaleString()}
                                        {batch.source ? ` · 来源：${batch.source}` : ""}
                                        {` · ${batch.autoPublish ? "自动发布" : "全部人工审核"}`}
                                    </p>
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                    {running ? (
                                        <Button variant="outline" size="sm" onClick={() => { stopRef.current = true; }}>
                                            <Pause className="mr-1 h-3.5 w-3.5" />暂停
                                        </Button>
                                    ) : done < batch.totalCount ? (
                                        <Button variant="outline" size="sm" onClick={() => runParseLoop(batch.id)}>
                                            <Play className="mr-1 h-3.5 w-3.5" />继续解析
                                        </Button>
                                    ) : (
                                        <Badge variant="outline" className="text-muted-foreground">解析完成</Badge>
                                    )}
                                </div>
                            </div>
                            <Progress value={batch.totalCount ? (done / batch.totalCount) * 100 : 0} />
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                <span>共 {batch.totalCount} 题</span>
                                <span>· 已处理 {done}</span>
                                {batch.progress.published > 0 && <span>· 已发布 {batch.progress.published}</span>}
                                {batch.progress.pending > 0 && <Badge variant="secondary" className="text-xs">待审核 {batch.progress.pending}</Badge>}
                                {batch.progress.raw > 0 && <span>· 待解析 {batch.progress.raw}</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ============================== 审核 Tab ============================== */

function ReviewTab({ tagModules }: { tagModules: TagModule[] }) {
    const [status, setStatus] = useState("pending");
    const [subject, setSubject] = useState("all");
    const [duplicateOnly, setDuplicateOnly] = useState(false);
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const [data, setData] = useState<{ total: number; counts: Record<string, number>; items: BankQuestionItem[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [editing, setEditing] = useState<BankQuestionItem | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ status, page: String(page), pageSize: "20" });
            if (subject !== "all") params.set("subject", subject);
            if (duplicateOnly) params.set("duplicate", "true");
            if (q.trim()) params.set("q", q.trim());
            const res = await apiClient.get<{ total: number; counts: Record<string, number>; items: BankQuestionItem[] }>(
                `/api/bank/questions?${params.toString()}`,
            );
            setData({ total: res?.total ?? 0, counts: res?.counts ?? {}, items: res?.items ?? [] });
            setSelected(new Set());
        } catch {
            setData({ total: 0, counts: {}, items: [] });
        } finally {
            setLoading(false);
        }
    }, [status, subject, duplicateOnly, q, page]);

    useEffect(() => { load(); }, [load]);

    const updateStatus = async (item: BankQuestionItem, nextStatus: string) => {
        setBusy(item.id);
        try {
            await apiClient.patch("/api/bank/questions", { id: item.id, status: nextStatus });
            await load();
        } catch (error: any) {
            await alertDialog({ description: error?.data?.message || "操作失败" });
        } finally {
            setBusy(null);
        }
    };

    const removeQuestion = async (item: BankQuestionItem) => {
        setBusy(item.id);
        try {
            await apiClient.delete(`/api/bank/questions?id=${item.id}`);
            await load();
        } catch (error: any) {
            await alertDialog({ description: error?.data?.message || "删除失败" });
        } finally {
            setBusy(null);
        }
    };

    const batchAction = async (action: string) => {
        if (selected.size === 0) return;
        setBusy("batch");
        try {
            const res = await apiClient.post<{ affected: number; skipped?: number }>("/api/bank/questions/batch", {
                ids: Array.from(selected), action,
            });
            await load();
            if (res.skipped) await alertDialog({ description: `完成 ${res.affected} 题，${res.skipped} 题因已有作答记录被跳过` });
        } catch (error: any) {
            await alertDialog({ description: error?.data?.message || "批量操作失败" });
        } finally {
            setBusy(null);
        }
    };

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const counts = data?.counts ?? {};
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1">
                    {["pending", "published", "disabled", "raw", "all"].map(s => (
                        <button
                            key={s}
                            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                                status === s ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
                            }`}
                            onClick={() => { setStatus(s); setPage(1); }}
                        >
                            {STATUS_LABELS[s] || s}{counts[s] ? ` (${counts[s]})` : ""}
                        </button>
                    ))}
                </div>
                <Select value={subject} onValueChange={(v) => { setSubject(v); setPage(1); }}>
                    <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">全部模块</SelectItem>
                        {SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                </Select>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox checked={duplicateOnly} onCheckedChange={(v) => { setDuplicateOnly(v === true); setPage(1); }} />
                    仅疑似重复
                </label>
                <Input
                    className="h-8 w-[180px] text-xs"
                    placeholder="搜索题干关键词…"
                    value={q}
                    onChange={e => { setQ(e.target.value); setPage(1); }}
                />
            </div>

            {selected.size > 0 && (
                <div className="flex items-center gap-2 border rounded-lg p-2 bg-muted/40">
                    <span className="text-xs text-muted-foreground">已选 {selected.size} 题：</span>
                    <Button size="sm" variant="outline" disabled={busy === "batch"} onClick={() => batchAction("publish")}>
                        <CheckCheck className="mr-1 h-3.5 w-3.5" />批量发布
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === "batch"} onClick={() => batchAction("disable")}>
                        <Ban className="mr-1 h-3.5 w-3.5" />批量下架
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === "batch"} onClick={() => batchAction("pending")}>退回待审</Button>
                    <Button size="sm" variant="destructive" disabled={busy === "batch"} onClick={() => batchAction("delete")}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" />批量删除
                    </Button>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : !data || data.items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">当前筛选条件下没有题目。</p>
            ) : (
                <div className="space-y-2">
                    {data.items.map(item => (
                        <div
                            key={item.id}
                            className={`border rounded-lg p-3 space-y-2 ${item.status === "disabled" ? "opacity-60" : "bg-card"} ${
                                selected.has(item.id) ? "ring-1 ring-primary" : ""
                            }`}
                        >
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                                <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                                <Badge variant="outline" className="text-xs">{item.subject}</Badge>
                                <span className="text-muted-foreground">{DIFFICULTIES.find(d => d.value === item.difficulty)?.label || item.difficulty}</span>
                                {item.primaryTag && <span className="text-primary">{item.primaryTag.name}</span>}
                                {item.confidence && <span className="text-muted-foreground">置信度：{CONFIDENCE_LABELS[item.confidence] || item.confidence}</span>}
                                {item.duplicateOf && (
                                    <Badge variant="destructive" className="gap-1 text-xs"><Copy className="h-3 w-3" />疑似重复</Badge>
                                )}
                                {item.requiresImage && <Badge variant="secondary" className="text-xs">需图形</Badge>}
                                <Badge variant={item.status === "published" ? "default" : item.status === "pending" ? "secondary" : "outline"} className="text-xs">
                                    {STATUS_LABELS[item.status] || item.status}
                                </Badge>
                                {item.attemptCount > 0 && (
                                    <span className="text-muted-foreground">作答 {item.attemptCount} · 正确率 {Math.round((item.correctCount / item.attemptCount) * 100)}%</span>
                                )}
                                <span className="ml-auto flex items-center gap-1">
                                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing(item)}>
                                        <Pencil className="h-3.5 w-3.5" />编辑
                                    </Button>
                                    {item.status !== "published" && (
                                        <Button variant="ghost" size="sm" className="h-7 px-2" disabled={busy === item.id} onClick={() => updateStatus(item, "published")}>
                                            <CheckCheck className="h-3.5 w-3.5" />发布
                                        </Button>
                                    )}
                                    {item.status !== "disabled" && (
                                        <Button variant="ghost" size="sm" className="h-7 px-2" disabled={busy === item.id} onClick={() => updateStatus(item, "disabled")}>
                                            <Ban className="h-3.5 w-3.5" />下架
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" disabled={busy === item.id} onClick={() => removeQuestion(item)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap break-words line-clamp-4">{item.questionText || item.rawText || "（无内容）"}</p>
                            {item.answerText && <p className="text-xs text-muted-foreground">答案：{item.answerText.slice(0, 120)}</p>}
                            {item.importBatch && <p className="text-xs text-muted-foreground/70">批次：{item.importBatch.name}{item.source ? ` · ${item.source}` : ""}</p>}
                        </div>
                    ))}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
                            <span className="text-xs text-muted-foreground">第 {page} / {totalPages} 页 · 共 {data.total} 题</span>
                            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</Button>
                        </div>
                    )}
                </div>
            )}

            {editing && (
                <EditDialog
                    item={editing}
                    tagModules={tagModules}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); load(); }}
                />
            )}
        </div>
    );
}

/* ============================== 编辑弹窗 ============================== */

function EditDialog({ item, tagModules, onClose, onSaved }: {
    item: BankQuestionItem;
    tagModules: TagModule[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const [questionText, setQuestionText] = useState(item.questionText || item.rawText || "");
    const [answerText, setAnswerText] = useState(item.answerText || "");
    const [analysis, setAnalysis] = useState(item.analysis || "");
    const [subject, setSubject] = useState(item.subject || "其他");
    const [difficulty, setDifficulty] = useState(item.difficulty || "medium");
    const [primaryTagId, setPrimaryTagId] = useState(item.primaryTag?.id || "none");
    const [status, setStatus] = useState(item.status);
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            await apiClient.patch("/api/bank/questions", {
                id: item.id,
                questionText,
                answerText,
                analysis,
                subject,
                difficulty,
                primaryTagId: primaryTagId === "none" ? null : primaryTagId,
                status,
            });
            onSaved();
        } catch (error: any) {
            await alertDialog({ description: error?.data?.message || "保存失败" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-card border rounded-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto p-4 space-y-3" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">编辑题库题</h3>
                    <Badge variant="outline" className="text-xs">{STATUS_LABELS[item.status]}</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="space-y-1">
                        <Label className="text-xs">模块</Label>
                        <Select value={subject} onValueChange={setSubject}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">难度</Label>
                        <Select value={difficulty} onValueChange={setDifficulty}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{DIFFICULTIES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">考点标签</Label>
                        <Select value={primaryTagId} onValueChange={setPrimaryTagId}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">（未指定）</SelectItem>
                                {tagModules.map(mod => (
                                    <SelectGroup key={mod.id}>
                                        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{mod.name}</div>
                                        {mod.points.flatMap(point =>
                                            point.leaves.length > 0
                                                ? point.leaves.map(leaf => (
                                                    <SelectItem key={leaf.id} value={leaf.id} className="text-xs">{`${point.name} · ${leaf.name}`}</SelectItem>
                                                ))
                                                : [<SelectItem key={point.id} value={point.id} className="text-xs">{point.name}</SelectItem>]
                                        )}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">状态</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {["pending", "published", "disabled"].map(s => (
                                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">题干（含选项）</Label>
                    <Textarea className="min-h-[140px] text-xs" value={questionText} onChange={e => setQuestionText(e.target.value)} />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">答案</Label>
                    <Textarea className="min-h-[40px] text-xs" value={answerText} onChange={e => setAnswerText(e.target.value)} />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">解析</Label>
                    <Textarea className="min-h-[100px] text-xs" value={analysis} onChange={e => setAnalysis(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
                    <Button size="sm" onClick={save} disabled={saving}>
                        {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}保存
                    </Button>
                </div>
            </div>
        </div>
    );
}

/* ============================== 统计 Tab ============================== */

interface StatsData {
    bySubject: { subject: string; counts: Record<string, number>; difficulty: Record<string, number> }[];
    byPoint: Record<string, number>;
}

function StatsTab() {
    const [data, setData] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get<StatsData>("/api/bank/stats")
            .then(res => setData(res))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }
    if (!data) {
        return <p className="text-sm text-muted-foreground text-center py-8">统计加载失败。</p>;
    }

    const points = Object.entries(data.byPoint).sort((a, b) => b[1] - a[1]);
    const gaps = points.filter(([, n]) => n === 0);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {data.bySubject.map(row => {
                    const total = Object.values(row.counts).reduce((a, b) => a + b, 0);
                    return (
                        <div key={row.subject} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{row.subject}</span>
                                <span className="text-xs text-muted-foreground">共 {total} 题</span>
                            </div>
                            <Progress value={total ? (row.counts.published / total) * 100 : 0} />
                            <div className="flex flex-wrap gap-1.5 text-xs">
                                <Badge variant="default" className="text-xs">已发布 {row.counts.published}</Badge>
                                {row.counts.pending > 0 && <Badge variant="secondary" className="text-xs">待审核 {row.counts.pending}</Badge>}
                                {row.counts.raw > 0 && <Badge variant="outline" className="text-xs">待解析 {row.counts.raw}</Badge>}
                                {row.counts.disabled > 0 && <Badge variant="outline" className="text-xs">已下架 {row.counts.disabled}</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                难度分布（已发布）：简单 {row.difficulty.easy} · 中等 {row.difficulty.medium} · 困难 {row.difficulty.hard} · 挑战 {row.difficulty.harder}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="border rounded-lg p-3 space-y-2">
                <h3 className="text-sm font-medium">各考点已发布题数（按一级考点聚合）</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-1.5 text-xs">
                    {points.map(([point, n]) => (
                        <div key={point} className="flex justify-between border rounded px-2 py-1">
                            <span className="truncate">{point}</span>
                            <span className={n === 0 ? "text-destructive font-medium" : "text-muted-foreground"}>{n}</span>
                        </div>
                    ))}
                </div>
                {gaps.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                        红色为 0 题的考点缺口（{gaps.length} 个），找题时优先补这些考点。
                    </p>
                )}
            </div>
        </div>
    );
}
