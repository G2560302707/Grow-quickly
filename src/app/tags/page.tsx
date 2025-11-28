"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STANDARD_TAGS } from "@/lib/knowledge-tags";
import { getCustomTags, addCustomTag, removeCustomTag, type CustomTagsData } from "@/lib/custom-tags";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Plus, Trash2 } from "lucide-react";
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
    const [customTags, setCustomTags] = useState<CustomTagsData>({ math: [], physics: [], chemistry: [], other: [] });
    const [newTagSubject, setNewTagSubject] = useState<keyof CustomTagsData>("math");
    const [newTagName, setNewTagName] = useState("");

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
            alert("请输入标签名称");
            return;
        }

        const success = addCustomTag(newTagSubject, newTagName.trim());
        if (success) {
            setNewTagName("");
            loadCustomTags();
            alert("标签添加成功！");
        } else {
            alert("标签已存在");
        }
    };

    const handleRemoveCustomTag = (subject: keyof CustomTagsData, tag: string) => {
        if (confirm(`确定要删除标签 "${tag}" 吗？`)) {
            removeCustomTag(subject, tag);
            loadCustomTags();
        }
    };

    // 渲染标准标签库（代码未改变，省略...)
    const renderStandardTags = () => {
        const subjects = Object.entries(STANDARD_TAGS);
        return subjects.map(([subjectKey, subjectData]) => {
            const subjectName = subjectKey === 'math' ? '数学' : subjectKey === 'physics' ? '物理' : subjectKey === 'chemistry' ? '化学' : subjectKey;
            const categories = Object.entries(subjectData);
            return (
                <Card key={subjectKey} className="mb-4">
                    <CardHeader><CardTitle>{subjectName}</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {categories.map(([categoryKey, categoryData]) => {
                            const tags: string[] = [];
                            const extractTags = (data: any) => {
                                if (Array.isArray(data)) tags.push(...data);
                                else if (typeof data === 'object') Object.values(data).forEach(extractTags);
                            };
                            extractTags(categoryData);
                            if (tags.length === 0) return null;
                            const categoryName = categoryKey === 'algebra' ? '代数' : categoryKey === 'geometry' ? '几何' : categoryKey === 'numbers' ? '数与式' : categoryKey === 'statistics' ? '统计与概率' : categoryKey === 'mechanics' ? '力学' : categoryKey === 'electricity' ? '电学' : categoryKey === 'optics' ? '光学' : categoryKey === 'thermology' ? '热学' : categoryKey === 'acoustics' ? '声学' : categoryKey === 'basic' ? '基础' : categoryKey === 'elements' ? '元素' : categoryKey === 'compounds' ? '化合物' : categoryKey === 'reactions' ? '反应' : categoryKey === 'calculation' ? '计算' : categoryKey;
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
                </Card>
            );
        });
    };

    // 渲染自定义标签
    const renderCustomTags = () => {
        const subjects = [
            { key: 'math' as const, name: '数学' },
            { key: 'physics' as const, name: '物理' },
            { key: 'chemistry' as const, name: '化学' },
            { key: 'other' as const, name: '其他' },
        ];

        const totalCount = customTags.math.length + customTags.physics.length + customTags.chemistry.length + customTags.other.length;

        return (
            <div className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>添加自定义标签</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex gap-3">
                            <Select value={newTagSubject} onValueChange={(v) => setNewTagSubject(v as keyof CustomTagsData)}>
                                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="math">数学</SelectItem>
                                    <SelectItem value="physics">物理</SelectItem>
                                    <SelectItem value="chemistry">化学</SelectItem>
                                    <SelectItem value="other">其他</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input placeholder="输入标签名称..." value={newTagName} onChange={(e) => setNewTagName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTag()} className="flex-1" />
                            <Button onClick={handleAddCustomTag}><Plus className="h-4 w-4 mr-1" />添加</Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">💡 自定义标签会自动出现在标签输入建议中</p>
                    </CardContent>
                </Card>

                {totalCount === 0 ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">还没有自定义标签，点击上方添加吧！</CardContent></Card>
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
                                                <button onClick={() => handleRemoveCustomTag(key, tag)} className="ml-2 hover:text-destructive transition-colors" title="删除">
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
        if (loading) return <div className="text-center py-8">加载中...</div>;
        if (stats.length === 0) return <div className="text-center py-8 text-muted-foreground">还没有任何标签使用记录</div>;
        const maxCount = stats[0]?.count || 1;
        return (
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />标签使用频率（Top 20）</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    {stats.slice(0, 20).map((stat) => {
                        const percentage = (stat.count / maxCount) * 100;
                        return (
                            <div key={stat.tag} className="space-y-1">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-medium">{stat.tag}</span>
                                    <span className="text-muted-foreground">{stat.count} 次</span>
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
                    <h1 className="text-3xl font-bold">标签管理</h1>
                    <p className="text-muted-foreground mt-1">
                        查看和管理知识点标签
                    </p>
                </div>
            </div>

            <Tabs defaultValue="standard" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="standard">标准标签库</TabsTrigger>
                    <TabsTrigger value="custom">自定义标签</TabsTrigger>
                    <TabsTrigger value="stats">使用统计</TabsTrigger>
                </TabsList>

                <TabsContent value="standard" className="space-y-4">{renderStandardTags()}</TabsContent>
                <TabsContent value="custom">{renderCustomTags()}</TabsContent>
                <TabsContent value="stats">{renderStats()}</TabsContent>
            </Tabs>
        </div>
    );
}
