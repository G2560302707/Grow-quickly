"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getAllCustomTagsFlat } from "@/lib/custom-tags";

interface TagInputProps {
    value: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
    className?: string;
}

export function TagInput({ value = [], onChange, placeholder = "输入标签...", className = "" }: TagInputProps) {
    const [input, setInput] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // 获取标签建议
    useEffect(() => {
        if (input.trim()) {
            fetchSuggestions(input);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, [input]);

    const fetchSuggestions = async (query: string) => {
        try {
            // 获取服务器端的标签建议（标准标签 + 已使用标签）
            const res = await fetch(`/api/tags/suggestions?q=${encodeURIComponent(query)}`);
            if (res.ok) {
                const data = await res.json();
                const serverSuggestions = data.suggestions || [];

                // 获取客户端的自定义标签
                const customTags = getAllCustomTagsFlat();

                // 合并所有标签并去重
                const allTags = Array.from(new Set([...serverSuggestions, ...customTags]));

                // 过滤匹配查询的标签
                const filtered = allTags.filter(
                    (tag) =>
                        tag.toLowerCase().includes(query.toLowerCase()) &&
                        !value.includes(tag) // 排除已选中的标签
                );

                setSuggestions(filtered.slice(0, 20)); // 限制20个
                setShowSuggestions(filtered.length > 0);
                setSelectedIndex(0);
            }
        } catch (error) {
            console.error("Failed to fetch suggestions:", error);
        }
    };

    const addTag = (tag: string) => {
        if (tag.trim() && !value.includes(tag.trim())) {
            onChange([...value, tag.trim()]);
            setInput("");
            setSuggestions([]);
            setShowSuggestions(false);
            setSelectedIndex(0);
        }
    };

    const removeTag = (tagToRemove: string) => {
        onChange(value.filter((tag) => tag !== tagToRemove));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                addTag(suggestions[selectedIndex]);
            } else if (input.trim()) {
                addTag(input);
            }
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === "Escape") {
            setShowSuggestions(false);
            setSelectedIndex(0);
        } else if (e.key === "Backspace" && !input && value.length > 0) {
            removeTag(value[value.length - 1]);
        }
    };

    // 点击外部关闭建议列表
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(event.target as Node) &&
                !inputRef.current?.contains(event.target as Node)
            ) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className={`relative ${className}`}>
            {/* 标签显示区域 */}
            <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-background min-h-[42px]">
                {value.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1 px-2 py-1">
                        {tag}
                        <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="hover:text-destructive ml-1"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                ))}

                {/* 输入框 */}
                <Input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (suggestions.length > 0) {
                            setShowSuggestions(true);
                        }
                    }}
                    placeholder={value.length === 0 ? placeholder : ""}
                    className="flex-1 min-w-[120px] border-none focus-visible:ring-0 focus-visible:ring-offset-0 h-8 px-0"
                />
            </div>

            {/* 建议列表 */}
            {showSuggestions && suggestions.length > 0 && (
                <div
                    ref={suggestionsRef}
                    className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto"
                >
                    {suggestions.map((suggestion, index) => (
                        <div
                            key={suggestion}
                            className={`px-3 py-2 cursor-pointer hover:bg-accent ${index === selectedIndex ? "bg-accent" : ""
                                }`}
                            onClick={() => addTag(suggestion)}
                            onMouseEnter={() => setSelectedIndex(index)}
                        >
                            {suggestion}
                        </div>
                    ))}
                </div>
            )}

            {/* 提示文本 */}
            {input && !showSuggestions && (
                <div className="text-xs text-muted-foreground mt-1">
                    按 Enter 创建新标签 "{input}"
                </div>
            )}
        </div>
    );
}
