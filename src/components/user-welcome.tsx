"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

export function UserWelcome() {
    const { language } = useLanguage();
    const { data: session } = useSession();

    return (
        <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <span className="font-medium">
                    {language === 'zh' ? '欢迎回来，' : 'Welcome back, '}
                    {session?.user?.name || session?.user?.email || 'User'}
                </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
                <LogOut className="h-4 w-4 mr-2" />
                {language === 'zh' ? '退出登录' : 'Logout'}
            </Button>
        </div>
    );
}
