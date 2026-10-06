"use client";

/**
 * 管理端全局弹窗系统（自学习端移植，中文固定文案）
 *
 *   await alertDialog({ description: "保存成功" });
 *   const ok = await confirmDialog({ description: "确定删除？", danger: true });
 *   const name = await promptDialog({ description: "输入名称", defaultValue: "" });
 *
 * <DialogHost /> 已挂载在 <Providers /> 中，无需手动引入组件。
 */
import { useCallback, useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";

export interface AppDialogOptions {
    /** 弹窗标题，缺省时仅显示描述文案 */
    title?: string;
    /** 正文内容 */
    description?: React.ReactNode;
    /** 确认按钮文案，默认「确认」 */
    confirmText?: string;
    /** 取消按钮文案，默认「取消」 */
    cancelText?: string;
    /** 危险操作：确认按钮显示为红色 */
    danger?: boolean;
    /** prompt 专用：输入框占位符 */
    placeholder?: string;
    /** prompt 专用：输入框默认值 */
    defaultValue?: string;
}

type DialogKind = "alert" | "confirm" | "prompt";

interface DialogRequest extends AppDialogOptions {
    kind: DialogKind;
    resolve: (value: boolean | string | null) => void;
}

let requestListener: ((req: DialogRequest) => void) | null = null;

function dispatch(req: DialogRequest) {
    if (!requestListener) {
        // DialogHost 未挂载时的兜底，保证业务流程不被打断
        console.warn("[app-dialog] DialogHost is not mounted, falling back to native dialog");
        if (req.kind === "confirm") req.resolve(window.confirm(String(req.description ?? "")));
        else if (req.kind === "prompt") req.resolve(window.prompt(String(req.description ?? ""), req.defaultValue ?? ""));
        else req.resolve(true);
        return;
    }
    requestListener(req);
}

/** 应用内弹窗提示（替代 window.alert） */
export function alertDialog(options: AppDialogOptions): Promise<void> {
    return new Promise(resolve => {
        dispatch({ kind: "alert", ...options, resolve: () => resolve() });
    });
}

/** 应用内确认弹窗（替代 window.confirm），返回是否确认 */
export function confirmDialog(options: AppDialogOptions): Promise<boolean> {
    return new Promise(resolve => {
        dispatch({ kind: "confirm", ...options, resolve: (value) => resolve(Boolean(value)) });
    });
}

/** 应用内输入弹窗（替代 window.prompt），返回输入内容，取消时返回 null */
export function promptDialog(options: AppDialogOptions): Promise<string | null> {
    return new Promise(resolve => {
        dispatch({ kind: "prompt", ...options, resolve: (value) => resolve(typeof value === "string" ? value : null) });
    });
}

export function DialogHost() {
    const [req, setReq] = useState<DialogRequest | null>(null);
    const [inputValue, setInputValue] = useState("");

    useEffect(() => {
        requestListener = (incoming) => {
            setReq(incoming);
            setInputValue(incoming.defaultValue ?? "");
        };
        return () => { requestListener = null; };
    }, []);

    const close = useCallback((value: boolean | string | null) => {
        setReq(null);
        req?.resolve(value);
    }, [req]);

    const handleConfirm = useCallback(() => {
        if (!req) return;
        if (req.kind === "prompt") close(inputValue);
        else close(true);
    }, [req, inputValue, close]);

    const handleOpenChange = useCallback((open: boolean) => {
        // 关闭动画结束后再 resolve，避免打断 Radix 退场动画
        if (!open && req) {
            if (req.kind === "prompt") req.resolve(null);
            else if (req.kind === "confirm") req.resolve(false);
            else req.resolve(true);
            setReq(null);
        }
    }, [req]);

    if (!req) return null;

    const isDanger = req.danger;
    const showCancelButton = req.kind !== "alert";

    return (
        <Dialog open onOpenChange={handleOpenChange}>
            <DialogContent
                className="max-w-md"
                onInteractOutside={(e) => e.preventDefault()}
                aria-describedby={undefined}
            >
                <DialogHeader>
                    {req.title ? (
                        <DialogTitle className="flex items-center gap-2">
                            {isDanger && <TriangleAlert className="h-5 w-5 text-destructive" />}
                            {req.title}
                        </DialogTitle>
                    ) : (
                        <DialogTitle className="sr-only">{req.kind === "prompt" ? "输入" : "提示"}</DialogTitle>
                    )}
                    {req.description != null && (
                        <DialogDescription asChild>
                            <div className={req.title ? "" : "flex items-start gap-2 pr-6"}>
                                {isDanger && !req.title && (
                                    <TriangleAlert className="h-5 w-5 shrink-0 text-destructive" />
                                )}
                                <div className="text-sm leading-relaxed">{req.description}</div>
                            </div>
                        </DialogDescription>
                    )}
                </DialogHeader>

                {req.kind === "prompt" && (
                    <input
                        autoFocus
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleConfirm();
                            }
                        }}
                        placeholder={req.placeholder}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                    {showCancelButton && (
                        <Button type="button" variant="outline" onClick={() => close(req.kind === "prompt" ? null : false)}>
                            {req.cancelText || "取消"}
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant={isDanger ? "destructive" : "default"}
                        onClick={handleConfirm}
                    >
                        {req.confirmText || "确认"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
