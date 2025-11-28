"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

export default function RegisterPage() {
    const router = useRouter();
    const { t, language } = useLanguage();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password }),
            });

            if (res.ok) {
                alert(language === 'zh' ? '注册成功！请登录' : 'Registration successful! Please login');
                router.push("/login");
            } else {
                const data = await res.json();
                setError(data.message || (language === 'zh' ? '注册失败' : 'Registration failed'));
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
                        {language === 'zh' ? '注册新账号' : 'Create an Account'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                {language === 'zh' ? '姓名' : 'Name'}
                            </label>
                            <Input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
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
                                minLength={6}
                            />
                        </div>
                        {error && (
                            <div className="text-red-500 text-sm text-center">{error}</div>
                        )}
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading
                                ? (language === 'zh' ? '注册中...' : 'Registering...')
                                : (language === 'zh' ? '注册' : 'Register')}
                        </Button>
                        <div className="text-center text-sm text-muted-foreground">
                            {language === 'zh' ? '已有账号？' : "Already have an account? "}
                            <Link href="/login" className="text-primary hover:underline">
                                {language === 'zh' ? '去登录' : 'Login here'}
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
