"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

export function UserWelcome() {
    const { t, language } = useLanguage();
    const { data: session } = useSession();

    return (
        <div className="flex items-center gap-2 bg-card p-4 rounded-lg border shadow-sm animate-in fade-in slide-in-from-top-4 duration-700">
            <User className="h-5 w-5 text-primary" />
            <span className="font-medium">
                {t.common.welcome || 'Welcome back, '}
                {session?.user?.name || session?.user?.email || 'User'}
            </span>
        </div>
    );
}
