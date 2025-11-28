"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LoginPage() {
    const router = useRouter();
    const { t, language } = useLanguage();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const result = await signIn("credentials", {
                redirect: false,
                email,
                password,
            });

            if (result?.error) {
                setError(language === 'zh' ? '登录失败，请检查邮箱和密码' : 'Login failed, please check your credentials');
            } else {
                router.push("/");
                router.refresh();
            }
        } catch (error) {
            setError(language === 'zh' ? '发生错误，请重试' : 'An error occurred, please try again');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl text-center">
                        {language === 'zh' ? '登录到错题本' : 'Login to Wrong Notebook'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                {language === 'zh' ? '邮箱' : 'Email'}
                            </label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                {language === 'zh' ? '密码' : 'Password'}
                            </label>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        {error && (
                            <div className="text-red-500 text-sm text-center">{error}</div>
                        )}
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading
                                ? (language === 'zh' ? '登录中...' : 'Logging in...')
                                : (language === 'zh' ? '登录' : 'Login')}
                        </Button>
                        <div className="text-center text-sm text-muted-foreground">
                            {language === 'zh' ? '还没有账号？' : "Don't have an account? "}
                            <Link href="/register" className="text-primary hover:underline">
                                {language === 'zh' ? '立即注册' : 'Register now'}
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
