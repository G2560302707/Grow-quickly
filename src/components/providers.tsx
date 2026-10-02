"use client";

import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SessionProvider } from "next-auth/react";
import { DialogHost } from "@/components/ui/app-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ThemeProvider>
                <LanguageProvider>
                    {children}
                    <DialogHost />
                </LanguageProvider>
            </ThemeProvider>
        </SessionProvider>
    );
}
