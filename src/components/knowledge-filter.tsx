"use client";

import { useState, useEffect } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { MATH_CURRICULUM, GRADE_TO_KEYS_MAP, inferSubjectFromName } from "@/lib/knowledge-tags";
import { apiClient } from "@/lib/api-client";

interface KnowledgeFilterProps {
    gradeSemester?: string;
    tag?: string | null;
    subjectName?: string;
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
    subjectName,
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

    const [availableGradeKeys, setAvailableGradeKeys] = useState<string[]>(Object.keys(MATH_CURRICULUM));

    useEffect(() => {
        apiClient.get<{ educationStage?: string }>('/api/user')
            .then(user => {
                console.log("[KnowledgeFilter] User info loaded:", user);
                const stage = user.educationStage;
                let grades: number[] = [];
                // 初中生和高中生都可能需要使用初高中完整体系（预习/复习）
                if (stage === 'juniorHigh' || stage === 'junior_high') grades = [7, 8, 9, 10, 11, 12];
                else if (stage === 'seniorHigh' || stage === 'senior_high') grades = [7, 8, 9, 10, 11, 12];

                console.log("[KnowledgeFilter] Calculated grades:", grades);

                if (grades.length > 0) {
                    const keys = grades.flatMap(g => GRADE_TO_KEYS_MAP[g] || []);
                    console.log("[KnowledgeFilter] Mapped keys:", keys);
                    const validKeys = keys.filter(k => k in MATH_CURRICULUM);
                    if (validKeys.length > 0) setAvailableGradeKeys(validKeys);
                }
            })
            .catch(err => console.error("Failed to load user info for filter:", err));
    }, []);

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

    const isMath = !subjectName || inferSubjectFromName(subjectName) === 'math';

    return (
        <div className={`flex gap-2 ${className}`}>
            <Select value={gradeSemester} onValueChange={handleGradeChange}>
                <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="年级/学期" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">全部年级</SelectItem>
                    {availableGradeKeys.map(gs => (
                        <SelectItem key={gs} value={gs}>{gs}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={chapter} onValueChange={handleChapterChange} disabled={!gradeSemester || gradeSemester === "all" || !isMath}>
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
