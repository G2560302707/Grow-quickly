"use client";

import { useState, useEffect } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { MATH_CURRICULUM } from "@/lib/knowledge-tags";

interface KnowledgeFilterProps {
    gradeSemester?: string;
    tag?: string | null;
    onFilterChange: (filters: {
        gradeSemester?: string;
        chapter?: string;
        tag?: string;
    }) => void;
    className?: string;
}

export function KnowledgeFilter({
    gradeSemester: initialGrade,
    tag: initialTag,
    onFilterChange,
    className
}: KnowledgeFilterProps) {
    const [gradeSemester, setGradeSemester] = useState<string>(initialGrade || "");
    const [chapter, setChapter] = useState<string>("");
    const [tag, setTag] = useState<string>(initialTag || "");

    // Sync with props
    useEffect(() => {
        if (initialGrade !== undefined) setGradeSemester(initialGrade);
    }, [initialGrade]);

    useEffect(() => {
        if (initialTag !== undefined) setTag(initialTag || "");
    }, [initialTag]);

    const handleGradeChange = (val: string) => {
        setGradeSemester(val);
        setChapter("");
        setTag("");
        onFilterChange({
            gradeSemester: val === "all" ? undefined : val,
            chapter: undefined,
            tag: undefined
        });
    };

    const handleChapterChange = (val: string) => {
        setChapter(val);
        setTag("");
        onFilterChange({
            gradeSemester: gradeSemester === "all" ? undefined : gradeSemester,
            chapter: val === "all" ? undefined : val,
            tag: undefined
        });
    };

    const handleTagChange = (val: string) => {
        setTag(val);
        onFilterChange({
            gradeSemester: gradeSemester === "all" ? undefined : gradeSemester,
            chapter: chapter === "all" ? undefined : chapter,
            tag: val === "all" ? undefined : val
        });
    };

    const chapters = gradeSemester && MATH_CURRICULUM[gradeSemester]
        ? MATH_CURRICULUM[gradeSemester]
        : [];

    const currentChapter = chapters.find(c => c.chapter === chapter);

    // Flatten tags from sections and subsections
    const tags = currentChapter ? currentChapter.sections.flatMap(section => {
        const sectionTags = section.tags || [];
        const subTags = section.subsections?.flatMap(sub => sub.tags) || [];
        return [...sectionTags, ...subTags];
    }) : [];

    return (
        <div className={`flex gap-2 ${className}`}>
            <Select value={gradeSemester} onValueChange={handleGradeChange}>
                <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="年级/学期" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">全部年级</SelectItem>
                    {Object.keys(MATH_CURRICULUM).map(gs => (
                        <SelectItem key={gs} value={gs}>{gs}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={chapter} onValueChange={handleChapterChange} disabled={!gradeSemester || gradeSemester === "all"}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="章节" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">全部章节</SelectItem>
                    {chapters.map(c => (
                        <SelectItem key={c.chapter} value={c.chapter}>{c.chapter.split(' ')[1] || c.chapter}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={tag} onValueChange={handleTagChange} disabled={!chapter || chapter === "all"}>
                <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="知识点" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">全部知识点</SelectItem>
                    {tags.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
