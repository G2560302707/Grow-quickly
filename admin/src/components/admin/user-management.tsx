"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Trash2, Ban, CheckCircle, Loader2 } from "lucide-react";
import { apiClient } from "@grow/shared/api-client";
import { AdminUser, AppConfig } from "@grow/shared/types/api";

import { alertDialog, confirmDialog } from "@/components/ui/app-dialog";

export function UserManagement() {
    const { data: session } = useSession();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [allowRegistration, setAllowRegistration] = useState(true);
    const [savingRegistration, setSavingRegistration] = useState(false);

    useEffect(() => {
        fetchUsers();
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const data = await apiClient.get<AppConfig>("/api/settings");
            setAllowRegistration(data.allowRegistration !== false);
        } catch (error) {
            console.error("Failed to fetch config", error);
        }
    };

    const handleToggleRegistration = async (checked: boolean) => {
        setSavingRegistration(true);
        try {
            await apiClient.post("/api/settings", { allowRegistration: checked });
            setAllowRegistration(checked);
        } catch (error) {
            console.error("Failed to update registration setting", error);
            await alertDialog({ description: "发生错误，请重试" });
        } finally {
            setSavingRegistration(false);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await apiClient.get<AdminUser[]>("/api/admin/users");
            setUsers(data);
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (user: AdminUser) => {
        const confirmMsg = user.isActive
            ? "确定要禁用此用户吗？"
            : "确定要启用此用户吗？";

        if (!(await confirmDialog({ description: confirmMsg }))) return;

        try {
            await apiClient.patch(`/api/admin/users/${user.id}`, { isActive: !user.isActive });
            fetchUsers();
        } catch (error) {
            console.error("Failed to update user status", error);
            await alertDialog({ description: "发生错误，请重试" });
        }
    };

    const handleDelete = async (user: AdminUser) => {
        if (!(await confirmDialog({ description: "确定要删除此用户吗？所有数据将被永久删除。" }))) return;

        try {
            await apiClient.delete(`/api/admin/users/${user.id}`);
            fetchUsers();
        } catch (error: any) {
            console.error("Failed to delete user", error);
            const text = error.data?.message || "发生错误，请重试";
            await alertDialog({ description: text });
        }
    };

    if (loading) {
        return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="space-y-4">
            {/* 注册开关 */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div className="space-y-0.5">
                    <Label className="text-base">
                        {"允许新用户注册"}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                        {"关闭后，新用户将无法注册账号"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {savingRegistration && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Switch
                        checked={allowRegistration}
                        onCheckedChange={handleToggleRegistration}
                        disabled={savingRegistration}
                    />
                </div>
            </div>

            {/* 移动端卡片视图 */}
            <div className="sm:hidden space-y-3">
                {users.map((user) => (
                    <div key={user.id} className="border rounded-lg p-4 bg-card space-y-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="font-medium">{user.name || "N/A"}</div>
                                <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                            <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                                {user.role === "admin" ? "管理员" : "普通用户"}
                            </Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                            <div className="text-muted-foreground">
                                {"错题"}: {user._count.errorItems} | {"练习"}: {user._count.practiceRecords}
                            </div>
                            <Badge variant={user.isActive ? "default" : "destructive"} className="text-xs">
                                {user.isActive ? "正常" : "已禁用"}
                            </Badge>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                            <div className="text-xs text-muted-foreground">
                                {new Date(user.createdAt).toLocaleDateString()}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleStatus(user)}
                                    disabled={user.id === (session?.user as any)?.id}
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
                                    disabled={user.id === (session?.user as any)?.id}
                                >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 桌面端表格视图 */}
            <div className="hidden sm:block border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{"姓名/邮箱"}</TableHead>
                            <TableHead>{"角色"}</TableHead>
                            <TableHead>{"统计"}</TableHead>
                            <TableHead>{"注册时间"}</TableHead>
                            <TableHead>{"状态"}</TableHead>
                            <TableHead className="text-right">{"操作"}</TableHead>
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
                                        {user.role === "admin" ? "管理员" : "普通用户"}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="text-sm">
                                        {"错题"}: {user._count.errorItems}
                                    </div>
                                    <div className="text-sm">
                                        {"练习"}: {user._count.practiceRecords}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={user.isActive ? "default" : "destructive"}>
                                        {user.isActive ? "正常" : "已禁用"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleToggleStatus(user)}
                                        disabled={user.id === (session?.user as any)?.id}
                                        title={user.isActive ? "禁用" : "启用"}
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
                                        disabled={user.id === (session?.user as any)?.id}
                                        title={"删除用户"}
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
