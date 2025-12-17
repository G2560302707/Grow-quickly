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
                setError(t.auth?.login?.failed || 'Login failed');
            } else {
                router.push("/");
                router.refresh();
            }
        } catch (error) {
            setError(t.auth?.login?.error || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl text-center">
                        {t.auth?.login?.title || 'Login'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium">
                                {t.auth?.email || 'Email'}
                            </label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium">
                                {t.auth?.password || 'Password'}
                            </label>
                            <Input
                                id="password"
                                name="password"
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
                                ? (t.auth?.login?.loggingIn || 'Logging in...')
                                : (t.auth?.login?.action || 'Login')}
                        </Button>
                        <div className="text-center text-sm text-muted-foreground">
                            {t.auth?.login?.noAccount || "Don't have an account? "}
                            <Link href="/register" className="text-primary hover:underline">
                                {t.auth?.login?.registerNow || 'Register now'}
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
