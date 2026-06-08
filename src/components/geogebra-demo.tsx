"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Maximize2, Minimize2, RotateCcw, RefreshCw } from "lucide-react";

interface GeogebraDemoProps {
    commands: string;
    height?: number;
    showToolBar?: boolean;
    showAlgebraInput?: boolean;
    showMenuBar?: boolean;
    className?: string;
    /** Called when user clicks "重新生成" — parent should re-call AI and update commands */
    onRegenerate?: () => Promise<void>;
}

// ── Singleton script loader ─────────────────────────────────────────────
let ggbScriptPromise: Promise<void> | null = null;

function loadGeoGebraScript(): Promise<void> {
    if (ggbScriptPromise) return ggbScriptPromise;
    ggbScriptPromise = new Promise<void>((resolve, reject) => {
        if (typeof window !== "undefined" && (window as any).GGBApplet) {
            resolve();
            return;
        }
        const s = document.createElement("script");
        s.src = "https://www.geogebra.org/apps/deployggb.js";
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => {
            ggbScriptPromise = null;
            reject(new Error("Failed to load GeoGebra"));
        };
        document.head.appendChild(s);
    });
    return ggbScriptPromise;
}

// ── Command helpers ─────────────────────────────────────────────────────
function parseCommands(raw: string): string[] {
    if (!raw?.trim()) return [];
    const t = raw.trim();
    if (t.startsWith("[")) {
        try {
            const a = JSON.parse(t);
            if (Array.isArray(a))
                return a.filter((c): c is string => typeof c === "string" && c.trim());
        } catch { /* fall through */ }
    }
    return t.split("\n").map((c) => c.trim()).filter((c) => c && !c.startsWith("//"));
}

const API_PREFIXES = [
    "setcoordsystem", "setaxesvisible", "setgridvisible", "setcolor",
    "setlinethickness", "setlinestyle", "setpointsize", "setpointstyle",
    "setlabelvisible", "setcaption", "setvisible", "setfilling",
    "setvalue", "setfixed", "setbackgroundcolor",
];

function isApiCall(cmd: string): boolean {
    const l = cmd.toLowerCase().trim();
    return API_PREFIXES.some((p) => l.startsWith(p + "("));
}

function parseApiArgs(cmd: string): { m: string; a: unknown[] } | null {
    const m = cmd.match(/^(\w+)\(([\s\S]+)\)$/);
    if (!m) return null;
    try {
        // Safe parsing: only allow numbers, booleans, strings, and arrays
        const argsStr = m[2].trim();
        // Simple JSON-like array: [1, 2, 3] or ["a", "b"]
        if (argsStr.startsWith('[') && argsStr.endsWith(']')) {
            return { m: m[1], a: JSON.parse(argsStr) };
        }
        // Single value: number, boolean, or quoted string
        if (/^-?\d+(\.\d+)?$/.test(argsStr)) {
            return { m: m[1], a: [Number(argsStr)] };
        }
        if (argsStr === 'true' || argsStr === 'false') {
            return { m: m[1], a: [argsStr === 'true'] };
        }
        if ((argsStr.startsWith('"') && argsStr.endsWith('"')) ||
            (argsStr.startsWith("'") && argsStr.endsWith("'"))) {
            return { m: m[1], a: [argsStr.slice(1, -1)] };
        }
        // Multiple comma-separated values
        const parts = argsStr.split(',').map(s => s.trim());
        const parsed: unknown[] = parts.map(p => {
            if (/^-?\d+(\.\d+)?$/.test(p)) return Number(p);
            if (p === 'true' || p === 'false') return p === 'true';
            if ((p.startsWith('"') && p.endsWith('"')) ||
                (p.startsWith("'") && p.endsWith("'"))) return p.slice(1, -1);
            return p; // Keep as string for object names etc.
        });
        return { m: m[1], a: parsed };
    }
    catch { return null; }
}

function runCommands(api: any, cmds: string[]) {
    for (const cmd of cmds) {
        try {
            if (isApiCall(cmd)) {
                const p = parseApiArgs(cmd);
                if (p && typeof api[p.m] === 'function') api[p.m](...p.a);
            } else {
                // Basic command validation: only allow safe characters
                const sanitized = cmd.trim();
                if (sanitized && !/[<>'"]/.test(sanitized)) {
                    api.evalCommand(sanitized);
                } else {
                    console.warn(`[GGB] Blocked potentially unsafe command: ${cmd.substring(0, 50)}`);
                }
            }
        } catch (e) {
            console.warn(`[GGB] Failed: ${cmd}`, e);
        }
    }
}

// ── Component ───────────────────────────────────────────────────────────
export function GeogebraDemo({
    commands,
    height = 450,
    showToolBar = false,
    showAlgebraInput = false,
    showMenuBar = false,
    className = "",
    onRegenerate,
}: GeogebraDemoProps) {
    // This ref points to a div that React NEVER puts children into.
    // All GeoGebra DOM is injected via innerHTML in the effect, so
    // React's reconciler never touches the inside of this node.
    const ggbHostRef = useRef<HTMLDivElement>(null);
    const apiRef = useRef<any>(null);
    const idRef = useRef(`ggb-${Math.random().toString(36).slice(2, 9)}`);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [regenerating, setRegenerating] = useState(false);

    const cmds = useMemo(() => parseCommands(commands), [commands]);

    // ── Init effect: load script → inject applet → run commands ─────────
    useEffect(() => {
        if (typeof window === "undefined" || cmds.length === 0) return;

        let dead = false;
        const id = idRef.current;

        loadGeoGebraScript().then(() => {
            if (dead) return;
            const GGBApplet = (window as any).GGBApplet;
            if (!GGBApplet) { setError("GeoGebra 未正确加载"); setLoading(false); return; }

            const el = ggbHostRef.current;
            if (!el) return;

            // Write the inject target directly — React never reconciles this.
            el.innerHTML = `<div id="${id}" style="width:100%;height:${height}px"></div>`;

            try {
                const applet = new GGBApplet({
                    appName: "classic",
                    width: "100%",
                    height,
                    showToolBar,
                    showAlgebraInput,
                    showMenuBar,
                    showResetIcon: true,
                    enableRightClick: true,
                    enableShiftDragZoom: true,
                    language: "zh",
                    appletOnLoad: (api: any) => {
                        if (dead) return;
                        apiRef.current = api;
                        runCommands(api, cmds);
                        setLoading(false);
                    },
                }, true);
                // deployggb.js auto-resolves the codebase — do NOT call setHTML5Codebase
                applet.inject(id);
            } catch (e) {
                console.error("[GGB] Init failed:", e);
                if (!dead) { setError("GeoGebra 初始化失败"); setLoading(false); }
            }
        }).catch((e) => {
            console.error("[GGB] Script load failed:", e);
            if (!dead) { setError("无法加载 GeoGebra 组件"); setLoading(false); }
        });

        return () => {
            dead = true;
            // Cleanup GeoGebra instance to prevent memory leaks
            try {
                const api = apiRef.current;
                if (api && typeof api.remove === 'function') {
                    api.remove();
                }
            } catch (e) {
                console.warn('[GGB] Cleanup failed:', e);
            }
            apiRef.current = null;
            // Clear injected DOM
            if (ggbHostRef.current) {
                ggbHostRef.current.innerHTML = '';
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cmds, showToolBar, showAlgebraInput, showMenuBar]);

    // ── Resize when expanded toggles ────────────────────────────────────
    useEffect(() => {
        const ggbDiv = ggbHostRef.current?.firstElementChild as HTMLElement | null;
        if (!ggbDiv) return;
        const h = expanded ? 700 : height;
        ggbDiv.style.height = `${h}px`;
        const api = apiRef.current;
        if (api?.setSize) api.setSize(ggbDiv.offsetWidth, h);
    }, [expanded, height]);

    // ── Reset ───────────────────────────────────────────────────────────
    const handleReset = useCallback(() => {
        const api = apiRef.current;
        if (!api) return;
        try {
            api.resetConstruction();
            setTimeout(() => { if (apiRef.current) runCommands(apiRef.current, cmds); }, 300);
        } catch (e) { console.warn("[GGB] Reset failed", e); }
    }, [cmds]);

    // ── Regenerate ──────────────────────────────────────────────────────
    const handleRegenerate = useCallback(async () => {
        if (!onRegenerate || regenerating) return;
        setRegenerating(true);
        try {
            await onRegenerate();
        } finally {
            setRegenerating(false);
        }
    }, [onRegenerate, regenerating]);

    if (cmds.length === 0) return null;

    return (
        <div className={`relative rounded-lg border bg-card ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                        GeoGebra 动态演示
                    </span>
                    {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-1">
                    {onRegenerate && (
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
                            onClick={handleRegenerate} title="重新生成" disabled={regenerating || loading}>
                            {regenerating
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <RefreshCw className="h-3.5 w-3.5" />}
                            <span>重新生成</span>
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                        onClick={handleReset} title="重置" disabled={loading}>
                        <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                        onClick={() => setExpanded((v) => !v)}
                        title={expanded ? "缩小" : "放大"}>
                        {expanded
                            ? <Minimize2 className="h-3.5 w-3.5" />
                            : <Maximize2 className="h-3.5 w-3.5" />}
                    </Button>
                </div>
            </div>

            {/*
             * GeoGebra container — NO React children inside.
             * The effect writes innerHTML directly, so React never
             * tries to reconcile DOM nodes inside this div.
             */}
            <div ref={ggbHostRef} />

            {/* Loading overlay — sibling, not child of ggbHost */}
            {loading && (
                <div
                    className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 rounded-b-lg"
                    style={{ top: 37 }}
                >
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">加载 GeoGebra...</span>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div
                    className="flex items-center justify-center text-sm text-destructive"
                    style={{ minHeight: height }}
                >
                    {error}
                </div>
            )}
        </div>
    );
}
