"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Trash2, Ban, CheckCircle } from "lucide-react";

interface User {
    id: string;
    name: string | null;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    _count: {
        errorItems: number;
        practiceRecords: number;
    };
}

export default function AdminUsersPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t } = useLanguage();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        } else if (status === "authenticated") {
            if ((session?.user as any).role !== "admin") {
                router.push("/");
            } else {
                fetchUsers();
            }
        }
    }, [status, session, router]);

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/admin/users");
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (user: User) => {
        const confirmMsg = user.isActive
            ? t.admin.confirmDisable
            : t.admin.confirmEnable;

        if (!confirm(confirmMsg)) return;

        try {
            const res = await fetch(`/api/admin/users/${user.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !user.isActive }),
            });

            if (res.ok) {
                fetchUsers();
            } else {
                alert(t.common.error);
            }
        } catch (error) {
            console.error("Failed to update user status", error);
        }
    };

    const handleDelete = async (user: User) => {
        if (!confirm(t.admin.confirmDelete)) return;

        try {
            const res = await fetch(`/api/admin/users/${user.id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                fetchUsers();
            } else {
                const text = await res.text();
                alert(text || t.common.error);
            }
        } catch (error) {
            console.error("Failed to delete user", error);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center min-h-screen">{t.common.loading}</div>;
    }

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => router.push("/")}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        {t.common.back}
                    </Button>
                    <h1 className="text-3xl font-bold">{t.admin.title}</h1>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>{t.admin.users}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name/Email</TableHead>
                                    <TableHead>{t.admin.role}</TableHead>
                                    <TableHead>{t.admin.stats}</TableHead>
                                    <TableHead>{t.admin.createdAt}</TableHead>
                                    <TableHead>{t.admin.status}</TableHead>
                                    <TableHead className="text-right">{t.admin.actions}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="font-medium">{user.name || "N/A"}</div>
                                            <div className="text-sm text-muted-foreground">{user.email}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                                                {user.role === "admin" ? t.admin.admin : t.admin.user}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                Errors: {user._count.errorItems}
                                            </div>
                                            <div className="text-sm">
                                                Practice: {user._count.practiceRecords}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={user.isActive ? "default" : "destructive"}>
                                                {user.isActive ? t.admin.active : t.admin.disabled}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleToggleStatus(user)}
                                                disabled={user.id === (session?.user as any).id}
                                                title={user.isActive ? t.admin.disable : t.admin.enable}
                                            >
                                                {user.isActive ? (
                                                    <Ban className="h-4 w-4 text-orange-500" />
                                                ) : (
                                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(user)}
                                                disabled={user.id === (session?.user as any).id}
                                                title={t.admin.delete}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
