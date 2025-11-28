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

import { useLanguage } from "@/contexts/LanguageContext";

// ... imports

export default function NotebooksPage() {
    const router = useRouter();
    const { t } = useLanguage(); // Use hook
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
                alert(data.message || t.notebooks?.createError || "Failed to create");
            }
        } catch (error) {
            console.error(error);
            alert(t.notebooks?.createError || "Error creating");
        }
    };

    const handleDelete = async (id: string, errorCount: number, name: string) => {
        if (errorCount > 0) {
            alert(t.notebooks?.deleteNotEmpty || "Please clear all items in this notebook first.");
            return;
        }
        if (!confirm((t.notebooks?.deleteConfirm || "Are you sure?").replace("{name}", name))) return;

        try {
            const res = await fetch(`/api/notebooks/${id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                await fetchNotebooks();
            } else {
                const data = await res.json();
                alert(data.message || t.notebooks?.deleteError || "Failed to delete");
            }
        } catch (error) {
            console.error(error);
            alert(t.notebooks?.deleteError || "Error deleting");
        }
    };

    const handleNotebookClick = (id: string) => {
        router.push(`/notebooks/${id}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-muted-foreground">{t.common.loading}</p>
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
                            <h1 className="text-3xl font-bold tracking-tight">{t.notebooks?.title || "My Notebooks"}</h1>
                            <p className="text-muted-foreground">
                                {t.notebooks?.subtitle || "Manage your mistakes by subject"}
                            </p>
                        </div>
                        <Button onClick={() => setDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            {t.notebooks?.create || "New Notebook"}
                        </Button>
                    </div>
                </div>

                {notebooks.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground mb-4">
                            {t.notebooks?.empty || "No notebooks yet."}
                        </p>
                        <Button onClick={() => setDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            {t.notebooks?.createFirst || "Create Notebook"}
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
                                onDelete={() => handleDelete(notebook.id, notebook._count.errorItems, notebook.name)}
                                itemLabel={t.notebooks?.items || "items"}
                            />
                        ))}
                    </div>
                )}

                <CreateNotebookDialog
                    key={t.common.loading} // Force re-render when language changes
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    onCreate={handleCreate}
                />
            </div >
        </main >
    );
}
