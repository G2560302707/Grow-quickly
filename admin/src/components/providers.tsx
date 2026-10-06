"use client";

import { SessionProvider } from "next-auth/react";
import { DialogHost } from "@/components/ui/app-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            {children}
            <DialogHost />
        </SessionProvider>
    );
}
