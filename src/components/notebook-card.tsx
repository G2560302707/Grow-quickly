"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotebookCardProps {
    id: string;
    name: string;
    errorCount: number;
    onClick: () => void;
    onDelete?: (id: string) => void;
}

export function NotebookCard({ id, name, errorCount, onClick, onDelete }: NotebookCardProps) {
    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(id);
        }
    };

    return (
        <Card
            className="cursor-pointer hover:border-primary/50 transition-colors relative group"
            onClick={onClick}
        >
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{name}</CardTitle>
                    </div>
                    {onDelete && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (errorCount > 0) {
                                    alert("请先清空错题本中的所有题目，才能删除该错题本。");
                                    return;
                                }
                                if (confirm(`确定要删除"${name}"错题本吗？`)) {
                                    onDelete(id);
                                }
                            }}
                        >
                            <Trash2 className={`h-4 w-4 ${errorCount > 0 ? "text-muted-foreground" : "text-destructive"}`} />
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                        {errorCount} 道题目
                    </Badge>
                </div>
            </CardContent>
        </Card>
    );
}
