"use client";

import { useEffect, useState } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { BookOpen } from "lucide-react";

interface Notebook {
    id: string;
    name: string;
}

interface NotebookSelectorProps {
    value?: string;
    onChange: (value: string) => void;
    className?: string;
}

export function NotebookSelector({ value, onChange, className }: NotebookSelectorProps) {
    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
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

        fetchNotebooks();
    }, []);

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={className}>
                <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="选择错题本" />
                </div>
            </SelectTrigger>
            <SelectContent>
                {notebooks.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                        暂无错题本
                    </div>
                ) : (
                    notebooks.map((notebook) => (
                        <SelectItem key={notebook.id} value={notebook.id}>
                            {notebook.name}
                        </SelectItem>
                    ))
                )}
            </SelectContent>
        </Select>
    );
}
