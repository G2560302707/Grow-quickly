"use client";

import { SessionProvider } from "next-auth/react";
import { DialogHost } from "@/components/ui/app-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
    // basePath 挂在 /admin 下，next-auth 客户端（signIn 等）需要显式告知，否则会请求 /api/auth/* 打到学习端
    return (
        <SessionProvider basePath="/admin/api/auth">
            {children}
            <DialogHost />
        </SessionProvider>
    );
}
