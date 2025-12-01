"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Trash2, Ban, CheckCircle, Loader2 } from "lucide-react";

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

export function UserManagement() {
    const { data: session } = useSession();
    const { t } = useLanguage();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
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
        return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t.admin.nameEmail}</TableHead>
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
                                        {t.admin.errors}: {user._count.errorItems}
                                    </div>
                                    <div className="text-sm">
                                        {t.admin.practiceCount}: {user._count.practiceRecords}
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
            </div>
        </div>
    );
}
