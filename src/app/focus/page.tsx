"use client";

/**
 * 专注刷卷（番茄钟 / 模考掐表）——考公向计时训练。
 * - 番茄专注：25/45/60 分钟单模块定向刷题
 * - 模考掐表：按国考行测建议用时分配分段（常识10/言语35/判断35/数量15/资料25），超段提醒
 * - 自定义：任意 5~180 分钟
 * 完成上报 FocusSession，页面内展示今日专注/连续打卡/距考试天数。
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Play, Pause, Flag, RotateCcw, Timer, CalendarDays } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { PracticeRecords } from "@/components/practice-records";

type Mode = "pomodoro" | "mock" | "custom";

const POMODORO_OPTIONS = [25, 45, 60];
const MOCK_OPTIONS = [90, 120, 150, 180];
const BIND_NAMES = ["言语理解", "判断推理", "数量关系", "资料分析", "常识判断"];
const SEG_COLORS = ["#E8993C", "#5568E8", "#8B5CF6", "#0E9F8A", "#18A058"];
const MOCK_SEGMENTS_BASE = [
    { name: "常识判断", minutes: 10 },
    { name: "言语理解", minutes: 35 },
    { name: "判断推理", minutes: 35 },
    { name: "数量关系", minutes: 15 },
    { name: "资料分析", minutes: 25 },
];
const QUOTES = [
    "你背不下来的书，总有人能背下来。",
    "对手此刻正在刷题。",
    "现在的每一分钟，都是考场上的底气。",
    "行测拼的不是天赋，是重复。",
    "上岸的人不是不累，是一直没停。",
    "今天偷的懒，都会变成考场上划掉的选项。",
    "岗位只招第一名，并列都不要。",
    "先做完，再做好——考场上没有完美，只有完成。",
];
const EXAM_DATE_KEY = "exam_target_date";
const RUNNING_KEY = "focus_running_v1";

interface FocusStats {
    todaySeconds: number;
    weekSeconds: number;
    streakDays: number;
    totalSessions: number;
    totalSeconds: number;
    last7Days: { date: string; seconds: number }[];
}

export default function FocusPage() {
    const router = useRouter();
    const [mode, setMode] = useState<Mode>("pomodoro");
    const [targetMinutes, setTargetMinutes] = useState(25);
    const [moduleName, setModuleName] = useState("");
    const [phase, setPhase] = useState<"idle" | "running" | "paused" | "done">("idle");
    const [elapsed, setElapsed] = useState(0);
    const [quoteIndex, setQuoteIndex] = useState(0);
    const [stats, setStats] = useState<FocusStats | null>(null);
    const [examTarget, setExamTarget] = useState("");
    const [lastResult, setLastResult] = useState<{ completed: boolean; elapsed: number } | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const quoteRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const stateRef = useRef({ phase, elapsed });
    stateRef.current = { phase, elapsed };

    const targetSeconds = targetMinutes * 60;
    const remaining = Math.max(0, targetSeconds - elapsed);
    const fmt = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        const pad = (n: number) => String(n).padStart(2, "0");
        return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
    };

    const mockSegments = MOCK_SEGMENTS_BASE.map(seg => ({
        ...seg,
        minutes: Math.max(1, Math.round((seg.minutes / 120) * targetMinutes)),
    }));
    const segmentOffsets = mockSegments.reduce<number[]>((acc, seg) => {
        acc.push((acc[acc.length - 1] ?? 0) + seg.minutes * 60);
        return acc;
    }, []);
    const segIdx = Math.min(
        segmentOffsets.findIndex(off => elapsed < off) === -1 ? segmentOffsets.length - 1 : segmentOffsets.findIndex(off => elapsed < off),
        segmentOffsets.length - 1
    );
    const segmentOvertime = Math.max(0, elapsed - (segIdx > 0 ? segmentOffsets[segIdx - 1] : 0) - mockSegments[segIdx].minutes * 60);

    const loadStats = useCallback(() => {
        apiClient.get<FocusStats>("/api/focus/stats").then(setStats).catch(() => {});
    }, []);

    // 恢复：上次未完成的专注 + 考试日期
    useEffect(() => {
        setExamTarget(localStorage.getItem(EXAM_DATE_KEY) || "");
        const saved = localStorage.getItem(RUNNING_KEY);
        if (saved) {
            try {
                const s = JSON.parse(saved);
                if (s.targetMinutes && s.elapsed < s.targetMinutes * 60) {
                    setMode(s.mode);
                    setModuleName(s.moduleName || "");
                    setTargetMinutes(s.targetMinutes);
                    setElapsed(s.elapsed || 0);
                    setPhase("paused");
                } else {
                    localStorage.removeItem(RUNNING_KEY);
                }
            } catch {
                localStorage.removeItem(RUNNING_KEY);
            }
        }
        loadStats();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (quoteRef.current) clearInterval(quoteRef.current);
        };
    }, [loadStats]);

    const startTimers = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (quoteRef.current) clearInterval(quoteRef.current);
        timerRef.current = setInterval(() => {
            setElapsed(prev => {
                const next = prev + 1;
                if (next % 5 === 0) {
                    const { phase: p, elapsed: e } = stateRef.current;
                    localStorage.setItem(
                        RUNNING_KEY,
                        JSON.stringify({ mode, moduleName, targetMinutes, elapsed: e, phase: p })
                    );
                }
                if (next >= targetSeconds) {
                    // 自然完成
                    setTimeout(() => finish(true), 0);
                }
                return Math.min(next, targetSeconds);
            });
        }, 1000);
        quoteRef.current = setInterval(() => setQuoteIndex(i => (i + 1) % QUOTES.length), 25_000);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, moduleName, targetMinutes, targetSeconds]);

    const submit = useCallback(
        async (completed: boolean, duration: number) => {
            try {
                await apiClient.post("/api/focus/sessions", {
                    mode,
                    moduleName: moduleName || undefined,
                    targetSeconds,
                    durationSeconds: Math.max(60, duration),
                    completed,
                });
            } catch (e) {
                console.error("Failed to save focus session", e);
            }
            loadStats();
        },
        [mode, moduleName, targetSeconds, loadStats]
    );

    const finish = useCallback(
        (completed: boolean) => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (quoteRef.current) clearInterval(quoteRef.current);
            const duration = stateRef.current.elapsed;
            setLastResult({ completed, elapsed: duration });
            localStorage.removeItem(RUNNING_KEY);
            setPhase("done");
            submit(completed, duration);
        },
        [submit]
    );

    const start = () => {
        setElapsed(0);
        setPhase("running");
        setQuoteIndex(Math.floor(Math.random() * QUOTES.length));
        startTimers();
    };

    const pause = () => {
        setPhase("paused");
        if (timerRef.current) clearInterval(timerRef.current);
        if (quoteRef.current) clearInterval(quoteRef.current);
    };

    const resume = () => {
        setPhase("running");
        startTimers();
    };

    const giveUp = () => {
        if (!confirm("放弃本次专注？会记为一次未完成，但别让它成为习惯。")) return;
        finish(false);
    };

    const saveExamDate = () => {
        const v = prompt("目标考试日（格式 2026-11-30，国考/省考笔试日）", examTarget);
        if (v && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
            setExamTarget(v.trim());
            localStorage.setItem(EXAM_DATE_KEY, v.trim());
        } else if (v) {
            alert("日期格式应为 2026-11-30");
        }
    };

    const examDaysLeft = examTarget
        ? Math.ceil((new Date(examTarget).getTime() - Date.now()) / 86_400_000)
        : null;
    const progressDeg = Math.min(360, (elapsed / targetSeconds) * 360);
    const modeLabel = mode === "pomodoro" ? "番茄专注" : mode === "mock" ? "模考掐表" : "自定义";

    return (
        <div className="container mx-auto px-4 py-8 max-w-xl">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <Timer className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">专注刷卷</h1>
                    <p className="text-sm text-muted-foreground mt-1">番茄钟 / 整卷模考掐表，按行测节奏练</p>
                </div>
            </div>

            {phase === "idle" && (
                <Card>
                    <CardContent className="space-y-5 pt-6">
                        <div className="flex gap-2">
                            {(["pomodoro", "mock", "custom"] as Mode[]).map(m => (
                                <Button
                                    key={m}
                                    variant={mode === m ? "default" : "outline"}
                                    className="flex-1"
                                    onClick={() => setMode(m)}
                                >
                                    {m === "pomodoro" ? "番茄专注" : m === "mock" ? "模考掐表" : "自定义"}
                                </Button>
                            ))}
                        </div>

                        {mode === "pomodoro" && (
                            <>
                                <div className="flex gap-2">
                                    {POMODORO_OPTIONS.map(opt => (
                                        <Button
                                            key={opt}
                                            variant={targetMinutes === opt ? "secondary" : "outline"}
                                            className="flex-1"
                                            onClick={() => setTargetMinutes(opt)}
                                        >
                                            {opt} 分钟
                                        </Button>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground">标准番茄钟 25+5，适合单模块定向刷题</p>
                            </>
                        )}

                        {mode === "mock" && (
                            <>
                                <div className="flex gap-2">
                                    {MOCK_OPTIONS.map(opt => (
                                        <Button
                                            key={opt}
                                            variant={targetMinutes === opt ? "secondary" : "outline"}
                                            className="flex-1"
                                            onClick={() => setTargetMinutes(opt)}
                                        >
                                            {opt} 分钟
                                        </Button>
                                    ))}
                                </div>
                                <div className="flex rounded-lg overflow-hidden">
                                    {mockSegments.map((seg, i) => (
                                        <div
                                            key={seg.name}
                                            className="flex flex-col items-center py-2 text-white"
                                            style={{ width: `${(seg.minutes / targetMinutes) * 100}%`, background: SEG_COLORS[i % SEG_COLORS.length] }}
                                        >
                                            <span className="text-xs font-semibold">{seg.name.slice(0, 2)}</span>
                                            <span className="text-[10px] opacity-85">{seg.minutes}′</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground">按国考行测建议用时分配，超段会提醒你切换模块</p>
                            </>
                        )}

                        {mode === "custom" && (
                            <div className="flex items-center justify-center gap-4">
                                <Button variant="outline" size="icon" onClick={() => setTargetMinutes(m => Math.max(5, m - 5))}>
                                    −
                                </Button>
                                <span className="text-4xl font-bold text-primary">{targetMinutes}</span>
                                <span className="text-sm text-muted-foreground">分钟</span>
                                <Button variant="outline" size="icon" onClick={() => setTargetMinutes(m => Math.min(180, m + 5))}>
                                    +
                                </Button>
                            </div>
                        )}

                        <div>
                            <p className="text-sm font-medium mb-2">绑定模块（可选）</p>
                            <div className="flex flex-wrap gap-2">
                                {BIND_NAMES.map(name => (
                                    <Button
                                        key={name}
                                        size="sm"
                                        variant={moduleName === name ? "secondary" : "outline"}
                                        onClick={() => setModuleName(moduleName === name ? "" : name)}
                                    >
                                        {name}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <Button className="w-full" size="lg" onClick={start}>
                            <Play className="mr-2 h-4 w-4" />开始专注
                        </Button>
                    </CardContent>
                </Card>
            )}

            {(phase === "running" || phase === "paused") && (
                <Card>
                    <CardContent className="flex flex-col items-center gap-4 pt-6">
                        <p className="text-sm text-muted-foreground">
                            {modeLabel}
                            {moduleName ? ` · ${moduleName}` : ""}
                        </p>
                        <div
                            className="w-56 h-56 rounded-full flex items-center justify-center transition-all duration-500"
                            style={{ background: `conic-gradient(var(--brand-600, #3d52d5) ${progressDeg}deg, rgba(61,82,213,0.1) ${progressDeg}deg)` }}
                        >
                            <div className="w-48 h-48 rounded-full bg-background flex flex-col items-center justify-center gap-1">
                                <span className="text-4xl font-bold tabular-nums">{fmt(remaining)}</span>
                                <span className="text-xs text-muted-foreground">已专注 {Math.round(elapsed / 60)} 分钟</span>
                            </div>
                        </div>
                        {mode === "mock" && (
                            <div className="text-center text-sm space-y-1">
                                <p>
                                    当前建议模块：
                                    <span className="font-bold text-primary">{mockSegments[segIdx].name}</span>
                                </p>
                                {segmentOvertime > 0 && (
                                    <p className="text-destructive text-xs font-medium">
                                        已超时 {Math.round(segmentOvertime / 60)} 分钟，建议进入「
                                        {mockSegments[segIdx + 1]?.name || "检查涂卡"}」
                                    </p>
                                )}
                            </div>
                        )}
                        <p className="text-sm text-muted-foreground text-center px-6">“{QUOTES[quoteIndex]}”</p>
                        {phase === "running" ? (
                            <div className="flex gap-3 w-full">
                                <Button variant="outline" className="flex-1" onClick={pause}>
                                    <Pause className="mr-2 h-4 w-4" />暂停
                                </Button>
                                <Button className="flex-1" onClick={() => finish(false)}>
                                    <Flag className="mr-2 h-4 w-4" />提前收卷
                                </Button>
                            </div>
                        ) : (
                            <div className="flex gap-3 w-full">
                                <Button className="flex-1" onClick={resume}>
                                    <Play className="mr-2 h-4 w-4" />继续
                                </Button>
                                <Button variant="outline" className="flex-1" onClick={giveUp}>
                                    放弃
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {phase === "done" && lastResult && (
                <Card className={lastResult.completed ? "border-green-500 bg-green-50 dark:bg-green-950/20" : ""}>
                    <CardContent className="flex flex-col items-center gap-3 pt-6">
                        <div className="text-center">
                            <p className="text-4xl font-bold text-primary">{Math.max(1, Math.round(lastResult.elapsed / 60))}</p>
                            <p className="text-xs text-muted-foreground mt-1">分钟专注</p>
                        </div>
                        <p className="font-semibold">
                            {lastResult.completed
                                ? mode === "mock"
                                    ? "收卷！这套卷子你扛下来了"
                                    : "这组专注拿下了"
                                : "已记录本次专注"}
                        </p>
                        {lastResult.completed && mode === "pomodoro" && (
                            <p className="text-sm text-muted-foreground">休息 5 分钟，看看窗外——下一组更稳</p>
                        )}
                        <div className="flex gap-3 w-full">
                            <Button variant="outline" className="flex-1" onClick={() => setPhase("idle")}>
                                <RotateCcw className="mr-2 h-4 w-4" />再来一组
                            </Button>
                            <Button className="flex-1" onClick={() => router.push("/stats")}>
                                完成
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 练习记录 */}
            <div className="mt-4">
                <PracticeRecords />
            </div>

            {/* 统计条 */}
            <Card className="mt-4">
                <CardContent className="grid grid-cols-3 divide-x pt-6 pb-6 text-center">
                    <div>
                        <p className="text-2xl font-bold">{stats ? Math.round(stats.todaySeconds / 60) : "—"}</p>
                        <p className="text-xs text-muted-foreground mt-1">今日专注(分)</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{stats?.streakDays ?? "—"}</p>
                        <p className="text-xs text-muted-foreground mt-1">连续打卡(天)</p>
                    </div>
                    <button className="hover:opacity-80 transition-opacity" onClick={saveExamDate} title="设置目标考试日">
                        <p className="text-2xl font-bold">{examDaysLeft === null ? "—" : examDaysLeft}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {examDaysLeft === null ? "设置考试日" : "距考试(天)"}
                        </p>
                    </button>
                </CardContent>
            </Card>
        </div>
    );
}
