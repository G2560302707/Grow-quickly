"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
    const router = useRouter();
    const { t, language } = useLanguage();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [educationStage, setEducationStage] = useState("junior_high");
    const [enrollmentYear, setEnrollmentYear] = useState("2025");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        // 验证两次密码是否一致
        if (password !== confirmPassword) {
            setError(language === 'zh' ? '两次密码不一致' : 'Passwords do not match');
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    educationStage,
                    enrollmentYear: parseInt(enrollmentYear)
                }),
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
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="pr-10"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                {language === 'zh' ? '确认密码' : 'Confirm Password'}
                            </label>
                            <div className="relative">
                                <Input
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="pr-10"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    tabIndex={-1}
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                {language === 'zh' ? '教育阶段' : 'Education Stage'}
                            </label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={educationStage}
                                onChange={(e) => setEducationStage(e.target.value)}
                                required
                            >
                                <option value="" disabled>{language === 'zh' ? '请选择' : 'Select Stage'}</option>
                                <option value="primary">{language === 'zh' ? '小学' : 'Primary School'}</option>
                                <option value="junior_high">{language === 'zh' ? '初中' : 'Junior High'}</option>
                                <option value="senior_high">{language === 'zh' ? '高中' : 'Senior High'}</option>
                                <option value="university">{language === 'zh' ? '大学' : 'University'}</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                {language === 'zh' ? '入学年份' : 'Enrollment Year'}
                            </label>
                            <Input
                                type="number"
                                value={enrollmentYear}
                                onChange={(e) => setEnrollmentYear(e.target.value)}
                                placeholder="YYYY"
                                required
                                min={1990}
                                max={new Date().getFullYear()}
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
