"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { originLabel } from "@/lib/error-origin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Filter, CheckCircle, Clock, ChevronDown, Printer, ListChecks, Trash2, X } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRouter } from "next/navigation";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KnowledgeFilter } from "@/components/knowledge-filter";
import { ErrorItem, PaginatedResponse } from "@grow/shared/types/api";
import { apiClient, ApiError } from "@grow/shared/api-client";
import { cleanMarkdown } from "@/lib/markdown-utils";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Pagination } from "@/components/ui/pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants/pagination";
import { getMistakeStatusLabel } from "@grow/shared/mistake-status";

import { confirmDialog, alertDialog } from "@/components/ui/app-dialog";

interface ErrorListProps {
    subjectId?: string;
    subjectName?: string;
}

type KnowledgeFilterChange = {
    tag?: string | null;
    tagId?: string;
};

export function ErrorList({ subjectId, subjectName }: ErrorListProps = {}) {
    const [items, setItems] = useState<ErrorItem[]>([]);
    const [, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    // 搜索防抖：输入停止 300ms 后才触发请求
    const [debouncedSearch, setDebouncedSearch] = useState("");
    // 当前列表请求的中断控制器
    const abortRef = useRef<AbortController | null>(null);
    const [masteryFilter, setMasteryFilter] = useState<"all" | "mastered" | "unmastered">("all");
    // 来源大类筛选：manual(拍照/手动录入的真错题) / practice(练习答错自动收录)
    const [sourceTypeFilter, setSourceTypeFilter] = useState<"all" | "manual" | "practice">("all");
    const [timeFilter, setTimeFilter] = useState<"all" | "week" | "month">("all");
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
    const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
    // 分页状态
    const [page, setPage] = useState(1);
    const [pageSize] = useState(DEFAULT_PAGE_SIZE);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    // 多选模式状态
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const { t, language } = useLanguage();
    const router = useRouter();

    const handleExportPrint = () => {
        const params = new URLSearchParams();
        if (subjectId) params.append("subjectId", subjectId);
        if (search) params.append("query", search);
        if (masteryFilter !== "all") {
            params.append("mastery", masteryFilter === "mastered" ? "1" : "0");
        }
        if (sourceTypeFilter !== "all") {
            params.append("sourceType", sourceTypeFilter);
        }
        if (timeFilter !== "all") {
            params.append("timeRange", timeFilter);
        }
        if (selectedTagId) {
            params.append("tagId", selectedTagId);
        } else if (selectedTag) {
            params.append("tag", selectedTag);
        }

        router.push(`/print-preview?${params.toString()}`);
    };

    const handleTagClick = (tag: string) => {
        setSelectedTag(selectedTag === tag ? null : tag);
        setSelectedTagId(null);
    };

    const handleFilterChange = ({ tag, tagId }: KnowledgeFilterChange) => {
        setSelectedTagId(tagId || null);
        setSelectedTag(tag || null);
        setPage(1);
    };

    // 使用服务端 items 直接渲染，章节过滤已在 KnowledgeFilter 中通过 tag 实现
    const filteredItems = items;

    const toggleTagsExpanded = (itemId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setExpandedTags(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    // 多选模式相关函数
    const toggleSelectMode = () => {
        setIsSelectMode(!isSelectMode);
        setSelectedIds(new Set());
    };

    const toggleSelectItem = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;

        const confirmMsg = (t.notebook?.confirmBatchDelete || "Delete {count} items?")
            .replace("{count}", selectedIds.size.toString());
        if (!(await confirmDialog({ description: confirmMsg }))) return;

        setIsDeleting(true);
        try {
            await apiClient.post("/api/error-items/batch-delete", {
                ids: Array.from(selectedIds),
            });
            await alertDialog({ description: t.notebook?.batchDeleteSuccess || "Deleted successfully" });
            setIsSelectMode(false);
            setSelectedIds(new Set());
            fetchItems();
        } catch (error) {
            console.error(error);
            await alertDialog({ description: t.common?.messages?.deleteFailed || "Delete failed" });
        } finally {
            setIsDeleting(false);
        }
    };

    // 搜索输入防抖
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(timer);
    }, [search]);

    // 追踪筛选条件是否变化（用于判断是否需要重置页码）
    const prevFiltersRef = useRef({ search: debouncedSearch, masteryFilter, sourceTypeFilter, timeFilter, selectedTag, selectedTagId, subjectId });

    useEffect(() => {
        const prevFilters = prevFiltersRef.current;
        const filtersChanged =
            prevFilters.search !== debouncedSearch ||
            prevFilters.masteryFilter !== masteryFilter ||
            prevFilters.sourceTypeFilter !== sourceTypeFilter ||
            prevFilters.timeFilter !== timeFilter ||
            prevFilters.selectedTag !== selectedTag ||
            prevFilters.selectedTagId !== selectedTagId ||
            prevFilters.subjectId !== subjectId;

        prevFiltersRef.current = { search: debouncedSearch, masteryFilter, sourceTypeFilter, timeFilter, selectedTag, selectedTagId, subjectId };

        if (filtersChanged && page !== 1) {
            setPage(1);
            return;
        }

        fetchItems();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, debouncedSearch, masteryFilter, sourceTypeFilter, timeFilter, selectedTag, selectedTagId, subjectId]);

    const fetchItems = async () => {
        // 中断上一次未完成的请求，避免过期响应覆盖新数据
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (subjectId) params.append("subjectId", subjectId);
            if (debouncedSearch) params.append("query", debouncedSearch);
            if (masteryFilter !== "all") {
                params.append("mastery", masteryFilter === "mastered" ? "1" : "0");
            }
            if (sourceTypeFilter !== "all") {
                params.append("sourceType", sourceTypeFilter);
            }
            if (timeFilter !== "all") {
                params.append("timeRange", timeFilter);
            }
            if (selectedTagId) {
                params.append("tagId", selectedTagId);
            } else if (selectedTag) {
                params.append("tag", selectedTag);
            }
            // 分页参数
            params.append("page", page.toString());
            params.append("pageSize", pageSize.toString());

            const response = await apiClient.get<PaginatedResponse<ErrorItem>>(`/api/error-items/list?${params.toString()}`, { signal: controller.signal });
            if (controller.signal.aborted) return;
            setItems(response.items);
            setTotal(response.total);
            setTotalPages(response.totalPages);
        } catch (error) {
            // 请求被新请求取代或组件卸载时忽略
            if (
                (error instanceof Error && error.name === 'AbortError') ||
                (error instanceof ApiError && error.status === 408)
            ) return;
            console.error(error);
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative w-full sm:flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={t.notebook.search}
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                            <Filter className="mr-2 h-4 w-4" />
                            {t.notebook.filter}
                            <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>{t.filter.masteryStatus || "Mastery Status"}</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setMasteryFilter("all")}>
                            {masteryFilter === "all" && "✓ "}{t.filter.all || "All"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setMasteryFilter("unmastered")}>
                            {masteryFilter === "unmastered" && "✓ "}{t.filter.review || "To Review"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setMasteryFilter("mastered")}>
                            {masteryFilter === "mastered" && "✓ "}{t.filter.mastered || "Mastered"}
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuLabel>来源</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setSourceTypeFilter("all")}>
                            {sourceTypeFilter === "all" && "✓ "}全部来源
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSourceTypeFilter("manual")}>
                            {sourceTypeFilter === "manual" && "✓ "}手动录入
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSourceTypeFilter("practice")}>
                            {sourceTypeFilter === "practice" && "✓ "}练习收录
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuLabel>{t.filter.timeRange || "Time Range"}</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setTimeFilter("all")}>
                            {timeFilter === "all" && "✓ "}{t.filter.allTime || "All Time"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTimeFilter("week")}>
                            {timeFilter === "week" && "✓ "}{t.filter.lastWeek || "Last Week"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTimeFilter("month")}>
                            {timeFilter === "month" && "✓ "}{t.filter.lastMonth || "Last Month"}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" onClick={handleExportPrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    {t.notebook?.exportPrint || "导出打印"}
                </Button>
                <Button
                    variant={isSelectMode ? "secondary" : "outline"}
                    onClick={toggleSelectMode}
                >
                    <ListChecks className="mr-2 h-4 w-4" />
                    {isSelectMode ? (t.notebook?.cancelSelect || "取消") : (t.notebook?.selectMode || "多选")}
                </Button>
            </div>

            <div className="w-full sm:w-auto">
                <KnowledgeFilter
                    tagId={selectedTagId}
                    onFilterChange={handleFilterChange}
                    subjectName={subjectName}
                />
            </div>

            {selectedTag && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">
                        {t.filter.filteringByTag || "Filtering by tag"}:
                    </span>
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedTag(null)}>
                        {selectedTag}
                        <span className="ml-1 text-xs">×</span>
                    </Badge>
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredItems.map((item) => {
                    // 优先使用 tags 关联，回退到 knowledgePoints
                    let tags: string[] = [];
                    if (item.tags && item.tags.length > 0) {
                        tags = item.tags.map((tag) => tag.name);
                    } else {
                        try {
                            tags = JSON.parse(item.knowledgePoints || "[]");
                        } catch {
                            tags = [];
                        }
                    }
                    return (
                        <div key={item.id} className="relative">
                            {/* 选择模式下的复选框 */}
                            {isSelectMode && (
                                <div
                                    className="absolute top-2 left-2 z-10"
                                    onClick={(e) => toggleSelectItem(item.id, e)}
                                >
                                    <Checkbox
                                        checked={selectedIds.has(item.id)}
                                        className="h-5 w-5 border-2 bg-background shadow-sm"
                                    />
                                </div>
                            )}
                            <Link href={isSelectMode ? "#" : `/error-items/${item.id}`} onClick={(e) => isSelectMode && e.preventDefault()}>
                                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer gap-2 pt-4">
                                    <CardHeader className="pb-0">
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-1.5 items-center">
                                            {item.origin ? (
                                                <Badge variant="outline" className="text-xs text-primary border-primary/40">
                                                    {originLabel(item.origin)}
                                                </Badge>
                                            ) : null}
                                            <Badge
                                                variant={item.masteryLevel > 0 ? "default" : "secondary"}
                                                className={item.masteryLevel > 0 ? "bg-green-600 hover:bg-green-700" : ""}
                                            >
                                                {item.masteryLevel > 0 ? (
                                                    <span className="flex items-center gap-1">
                                                        <CheckCircle className="h-3 w-3" /> {t.notebook.mastered}
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {t.notebook.review}
                                                    </span>
                                                )}
                                            </Badge>
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(item.createdAt), "MM/dd")}
                                            </span>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-sm line-clamp-3">
                                            {(() => {
                                                // 提取文本：取第一段；含 LaTeX 公式时直接用渲染器展示公式，
                                                // 否则清理成纯文本摘要（cleanMarkdown 会剥除 $ 定界符）
                                                const rawText = (item.questionText || "").split('\n\n')[0];
                                                if (rawText.includes("$")) {
                                                    return <MarkdownRenderer content={rawText} className="text-sm" />;
                                                }
                                                const cleanText = cleanMarkdown(rawText);

                                                return cleanText.length > 80
                                                    ? cleanText.substring(0, 80) + "..."
                                                    : cleanText;
                                            })()}
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            <Badge variant={item.mistakeStatus === "wrong_attempt" ? "default" : "secondary"} className="text-xs">
                                                {getMistakeStatusLabel(item.mistakeStatus, language)}
                                            </Badge>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {(expandedTags.has(item.id) ? tags : tags.slice(0, 3)).map((tag: string) => (
                                                <Badge
                                                    key={tag}
                                                    variant={selectedTag === tag ? "default" : "outline"}
                                                    className="text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        handleTagClick(tag);
                                                    }}
                                                >
                                                    {tag}
                                                </Badge>
                                            ))}
                                            {tags.length > 3 && (
                                                <Badge
                                                    variant="secondary"
                                                    className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
                                                    title={expandedTags.has(item.id)
                                                        ? (t.notebooks?.collapseTagsTooltip || "Click to collapse")
                                                        : (t.notebooks?.expandTagsTooltip || "Click to expand {count} tags").replace("{count}", (tags.length - 3).toString())}
                                                    onClick={(e) => toggleTagsExpanded(item.id, e)}
                                                >
                                                    {expandedTags.has(item.id) ? (
                                                        <>{t.notebooks?.collapseTags || "Collapse"}</>
                                                    ) : (
                                                        <>{(t.notebooks?.expandTags || "+{count} more").replace("{count}", (tags.length - 3).toString())}</>
                                                    )}
                                                </Badge>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        </div>
                    );
                })}
            </div>

            {/* 分页器 */}
            <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={pageSize}
                onPageChange={setPage}
            />

            {/* 多选模式底部操作栏 */}
            {isSelectMode && (
                <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4 z-50">
                    <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                        <span className="text-sm text-muted-foreground">
                            {(t.notebook?.selectedCount || "{count} selected").replace("{count}", selectedIds.size.toString())}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={toggleSelectMode}
                            >
                                <X className="mr-2 h-4 w-4" />
                                {t.notebook?.cancelSelect || "取消"}
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleBatchDelete}
                                disabled={selectedIds.size === 0 || isDeleting}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t.notebook?.deleteSelected || "删除选中"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
