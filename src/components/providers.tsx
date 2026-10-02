"use client";

import { LanguageProvider } from "@/contexts/LanguageContext";
import { SessionProvider } from "next-auth/react";
import { DialogHost } from "@/components/ui/app-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <LanguageProvider>
                {children}
                <DialogHost />
            </LanguageProvider>
        </SessionProvider>
    );
}
