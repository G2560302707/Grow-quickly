"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STANDARD_TAGS } from "@/lib/knowledge-tags";
import { getCustomTags, addCustomTag, removeCustomTag, type CustomTagsData } from "@/lib/custom-tags";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TagStats {
    tag: string;
    count: number;
}

export default function TagsPage() {
    const { t, language } = useLanguage();
    const [stats, setStats] = useState<TagStats[]>([]);
    const [loading, setLoading] = useState(true);

    // 自定义标签状态
    const [customTags, setCustomTags] = useState<CustomTagsData>({ math: [], physics: [], chemistry: [], english: [], other: [] });
    const [newTagSubject, setNewTagSubject] = useState<keyof CustomTagsData>("math");
    const [newTagName, setNewTagName] = useState("");
    const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetchStats();
        loadCustomTags();
    }, []);

    const loadCustomTags = () => {
        setCustomTags(getCustomTags());
    };

    const fetchStats = async () => {
        try {
            const res = await fetch("/api/tags/stats");
            if (res.ok) {
                const data = await res.json();
                setStats(data.stats);
            }
        } catch (error) {
            console.error("Failed to fetch tag stats:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddCustomTag = () => {
        if (!newTagName.trim()) {
            alert(t.tags?.custom?.enterName || "Please enter tag name");
            return;
        }

        const success = addCustomTag(newTagSubject, newTagName.trim());
        if (success) {
            setNewTagName("");
            loadCustomTags();
            alert(t.tags?.custom?.success || "Tag added successfully!");
        } else {
            alert(t.tags?.custom?.exists || "Tag already exists");
        }
    };

    const handleRemoveCustomTag = (subject: keyof CustomTagsData, tag: string) => {
        if (confirm((t.tags?.custom?.deleteConfirm || "Are you sure you want to delete tag \"{tag}\"?").replace("{tag}", tag))) {
            removeCustomTag(subject, tag);
            loadCustomTags();
        }
    };

    // 渲染标准标签库（代码未改变，省略...)
    // 渲染标准标签库
    const renderStandardTags = () => {
        const subjects = Object.entries(STANDARD_TAGS);

        const toggleSubject = (subjectKey: string) => {
            setExpandedSubjects(prev => ({
                ...prev,
                [subjectKey]: !prev[subjectKey]
            }));
        };

        return subjects.map(([subjectKey, subjectData]) => {
            // @ts-ignore
            const subjectName = t.tags?.subjects?.[subjectKey] || subjectKey;
            const categories = Object.entries(subjectData);
            const isExpanded = expandedSubjects[subjectKey];

            return (
                <Card key={subjectKey} className="mb-4">
                    <CardHeader
                        className="cursor-pointer hover:bg-muted/50 transition-colors flex flex-row items-center justify-between py-4"
                        onClick={() => toggleSubject(subjectKey)}
                    >
                        <CardTitle className="text-lg flex items-center gap-2">
                            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                            {subjectName}
                        </CardTitle>
                        <span className="text-sm text-muted-foreground">
                            {isExpanded ? (language === 'zh' ? '收起' : 'Collapse') : (language === 'zh' ? '展开' : 'Expand')}
                        </span>
                    </CardHeader>
                    {isExpanded && (
                        <CardContent className="space-y-4 pt-0">
                            {categories.map(([categoryKey, categoryData]) => {
                                const tags: string[] = [];
                                const extractTags = (data: any) => {
                                    if (Array.isArray(data)) tags.push(...data);
                                    else if (typeof data === 'object') Object.values(data).forEach(extractTags);
                                };
                                extractTags(categoryData);
                                if (tags.length === 0) return null;
                                // @ts-ignore
                                const categoryName = t.tags?.categories?.[categoryKey] || categoryKey;
                                return (
                                    <div key={categoryKey}>
                                        <h4 className="text-sm font-semibold mb-2 text-muted-foreground">{categoryName} ({tags.length})</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {tags.map((tag) => {
                                                const stat = stats.find((s) => s.tag === tag);
                                                return (
                                                    <Badge key={tag} variant="outline" className="cursor-default hover:bg-accent">
                                                        {tag}
                                                        {stat && <span className="ml-1 text-xs text-muted-foreground">({stat.count})</span>}
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    )}
                </Card>
            );
        });
    };

    // 渲染自定义标签
    const renderCustomTags = () => {
        const subjects = [
            { key: 'math' as const, name: t.tags?.subjects?.math || 'Math' },
            { key: 'english' as const, name: t.tags?.subjects?.english || 'English' },
            { key: 'physics' as const, name: t.tags?.subjects?.physics || 'Physics' },
            { key: 'chemistry' as const, name: t.tags?.subjects?.chemistry || 'Chemistry' },
            { key: 'other' as const, name: t.tags?.subjects?.other || 'Other' },
        ];

        const totalCount = customTags.math.length + customTags.physics.length + customTags.chemistry.length + customTags.english.length + customTags.other.length;

        return (
            <div className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>{t.tags?.custom?.addTitle || "Add Custom Tag"}</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex gap-3">
                            <Select value={newTagSubject} onValueChange={(v) => setNewTagSubject(v as keyof CustomTagsData)}>
                                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="math">{t.tags?.subjects?.math || "Math"}</SelectItem>
                                    <SelectItem value="english">{t.tags?.subjects?.english || "English"}</SelectItem>
                                    <SelectItem value="physics">{t.tags?.subjects?.physics || "Physics"}</SelectItem>
                                    <SelectItem value="chemistry">{t.tags?.subjects?.chemistry || "Chemistry"}</SelectItem>
                                    <SelectItem value="other">{t.tags?.subjects?.other || "Other"}</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input
                                placeholder={t.tags?.custom?.placeholder || "Enter tag name..."}
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTag()}
                                className="flex-1"
                            />
                            <Button onClick={handleAddCustomTag}>
                                <Plus className="h-4 w-4 mr-1" />
                                {t.tags?.custom?.add || "Add"}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            {t.tags?.custom?.hint || "💡 Custom tags will automatically appear in tag suggestions"}
                        </p>
                    </CardContent>
                </Card>

                {totalCount === 0 ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">
                        {t.tags?.custom?.empty || "No custom tags yet, click above to add!"}
                    </CardContent></Card>
                ) : (
                    subjects.map(({ key, name }) => {
                        if (customTags[key].length === 0) return null;
                        return (
                            <Card key={key}>
                                <CardHeader><CardTitle className="text-lg">{name} ({customTags[key].length})</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-2">
                                        {customTags[key].map((tag) => (
                                            <Badge key={tag} variant="secondary" className="px-3 py-1.5 text-sm">
                                                {tag}
                                                <button onClick={() => handleRemoveCustomTag(key, tag)} className="ml-2 hover:text-destructive transition-colors" title={t.common?.delete || "Delete"}>
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        );
    };

    const renderStats = () => {
        if (loading) return <div className="text-center py-8">{t.tags?.stats?.loading || "Loading..."}</div>;
        if (stats.length === 0) return <div className="text-center py-8 text-muted-foreground">{t.tags?.stats?.empty || "No tag usage records yet"}</div>;
        const maxCount = stats[0]?.count || 1;
        return (
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />{t.tags?.stats?.frequency || "Tag Usage Frequency (Top 20)"}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    {stats.slice(0, 20).map((stat) => {
                        const percentage = (stat.count / maxCount) * 100;
                        return (
                            <div key={stat.tag} className="space-y-1">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-medium">{stat.tag}</span>
                                    <span className="text-muted-foreground">{stat.count} {t.tags?.stats?.count || "times"}</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary transition-all" style={{ width: `${percentage}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">{t.tags?.title || "Tag Management"}</h1>
                    <p className="text-muted-foreground mt-1">
                        {t.tags?.subtitle || "View and manage knowledge point tags"}
                    </p>
                </div>
            </div>

            <Tabs defaultValue="standard" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="standard">{t.tags?.tabs?.standard || "Standard Tags"}</TabsTrigger>
                    <TabsTrigger value="custom">{t.tags?.tabs?.custom || "Custom Tags"}</TabsTrigger>
                    <TabsTrigger value="stats">{t.tags?.tabs?.stats || "Usage Statistics"}</TabsTrigger>
                </TabsList>

                <TabsContent value="standard" className="space-y-4">{renderStandardTags()}</TabsContent>
                <TabsContent value="custom">{renderCustomTags()}</TabsContent>
                <TabsContent value="stats">{renderStats()}</TabsContent>
            </Tabs>
        </div>
    );
}
