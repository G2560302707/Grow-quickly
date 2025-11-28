"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { NotebookCard } from "@/components/notebook-card";
import { CreateNotebookDialog } from "@/components/create-notebook-dialog";

interface Notebook {
    id: string;
    name: string;
    _count: {
        errorItems: number;
    };
}

export default function NotebooksPage() {
    const router = useRouter();
    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);

    useEffect(() => {
        fetchNotebooks();
    }, []);

    const fetchNotebooks = async () => {
        try {
            const res = await fetch("/api/notebooks");
            if (res.ok) {
                const data = await res.json();
                setNotebooks(data);
            }
        } catch (error) {
            console.error("Failed to fetch notebooks:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (name: string) => {
        try {
            const res = await fetch("/api/notebooks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });

            if (res.ok) {
                await fetchNotebooks();
            } else {
                const data = await res.json();
                alert(data.message || "创建失败");
            }
        } catch (error) {
            console.error(error);
            alert("创建出错");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("确定要删除这个错题本吗？")) return;

        try {
            const res = await fetch(`/api/notebooks/${id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                await fetchNotebooks();
            } else {
                const data = await res.json();
                alert(data.message || "删除失败");
            }
        } catch (error) {
            console.error(error);
            alert("删除出错");
        }
    };

    const handleNotebookClick = (id: string) => {
        router.push(`/notebooks/${id}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-muted-foreground">加载中...</p>
            </div>
        );
    }

    return (
        <main className="min-h-screen p-8 bg-background">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div className="flex-1 flex justify-between items-center">
                        <div className="space-y-1">
                            <h1 className="text-3xl font-bold tracking-tight">我的错题本</h1>
                            <p className="text-muted-foreground">
                                按科目分类管理你的错题
                            </p>
                        </div>
                        <Button onClick={() => setDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            新建错题本
                        </Button>
                    </div>
                </div>

                {notebooks.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground mb-4">
                            还没有错题本，点击上方按钮创建第一个吧！
                        </p>
                        <Button onClick={() => setDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            创建错题本
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {notebooks.map((notebook) => (
                            <NotebookCard
                                key={notebook.id}
                                id={notebook.id}
                                name={notebook.name}
                                errorCount={notebook._count.errorItems}
                                onClick={() => handleNotebookClick(notebook.id)}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}

                <CreateNotebookDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    onCreate={handleCreate}
                />
            </div>
        </main>
    );
}
