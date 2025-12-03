/**
 * 自定义标签管理（基于 LocalStorage）
 */

const CUSTOM_TAGS_KEY = 'wrongnotebook_custom_tags';

export interface CustomTag {
    name: string;
    category?: string;
}

export interface CustomTagsData {
    math: CustomTag[];
    english: CustomTag[];
    physics: CustomTag[];
    chemistry: CustomTag[];
    other: CustomTag[];
}

/**
 * 获取所有自定义标签
 */
export function getCustomTags(): CustomTagsData {
    if (typeof window === 'undefined') {
        return { math: [], english: [], physics: [], chemistry: [], other: [] };
    }

    try {
        const stored = localStorage.getItem(CUSTOM_TAGS_KEY);
        if (!stored) {
            return { math: [], english: [], physics: [], chemistry: [], other: [] };
        }
        const data = JSON.parse(stored);

        // Migration: Convert string[] to CustomTag[]
        const subjects = ['math', 'english', 'physics', 'chemistry', 'other'] as const;
        let migrated = false;

        subjects.forEach(subject => {
            if (Array.isArray(data[subject]) && data[subject].length > 0 && typeof data[subject][0] === 'string') {
                data[subject] = data[subject].map((t: string) => ({ name: t, category: 'default' }));
                migrated = true;
            } else if (!Array.isArray(data[subject])) {
                data[subject] = [];
            }
        });

        if (migrated) {
            saveCustomTags(data);
        }

        return data as CustomTagsData;
    } catch (error) {
        console.error('Failed to load custom tags:', error);
        return { math: [], english: [], physics: [], chemistry: [], other: [] };
    }
}

/**
 * 保存自定义标签
 */
function saveCustomTags(tags: CustomTagsData): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(tags));
    } catch (error) {
        console.error('Failed to save custom tags:', error);
    }
}

/**
 * 添加自定义标签
 */
export function addCustomTag(subject: keyof CustomTagsData, tag: string, category: string = 'default'): boolean {
    if (!tag.trim()) return false;

    const tags = getCustomTags();
    const trimmedTag = tag.trim();

    // 检查是否已存在 (在同一学科下)
    if (tags[subject].some(t => t.name === trimmedTag)) {
        return false;
    }

    tags[subject].push({ name: trimmedTag, category });
    saveCustomTags(tags);
    return true;
}

/**
 * 删除自定义标签
 */
export function removeCustomTag(subject: keyof CustomTagsData, tagName: string): boolean {
    const tags = getCustomTags();
    const index = tags[subject].findIndex(t => t.name === tagName);

    if (index === -1) return false;

    tags[subject].splice(index, 1);
    saveCustomTags(tags);
    return true;
}

/**
 * 获取所有自定义标签（扁平化）
 */
export function getAllCustomTagsFlat(): string[] {
    const tags = getCustomTags();
    return [
        ...tags.math.map(t => t.name),
        ...tags.english.map(t => t.name),
        ...tags.physics.map(t => t.name),
        ...tags.chemistry.map(t => t.name),
        ...tags.other.map(t => t.name),
    ];
}

/**
 * 检查标签是否为自定义标签
 */
export function isCustomTag(tag: string): boolean {
    const customTags = getAllCustomTagsFlat();
    return customTags.includes(tag);
}

/**
 * 导出自定义标签为 JSON
 */
export function exportCustomTags(): string {
    const tags = getCustomTags();
    return JSON.stringify(tags, null, 2);
}

/**
 * 从 JSON 导入自定义标签
 */
export function importCustomTags(jsonString: string): boolean {
    try {
        const parsed = JSON.parse(jsonString);
        const tags = getCustomTags(); // Get current structure to ensure we match it

        // 验证格式并合并/覆盖
        const subjects = ['math', 'english', 'physics', 'chemistry', 'other'] as const;

        subjects.forEach(subject => {
            if (parsed[subject] && Array.isArray(parsed[subject])) {
                // Handle both string[] and CustomTag[] input
                const newTags = parsed[subject].map((t: any) => {
                    if (typeof t === 'string') return { name: t, category: 'default' };
                    return t;
                });
                tags[subject] = newTags;
            }
        });

        saveCustomTags(tags);
        return true;
    } catch (error) {
        console.error('Failed to import custom tags:', error);
        return false;
    }
}

/**
 * 清空所有自定义标签
 */
export function clearCustomTags(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CUSTOM_TAGS_KEY);
}

/**
 * 获取自定义标签统计
 */
export function getCustomTagsStats(): Record<string, number> {
    const tags = getCustomTags();
    return {
        math: tags.math.length,
        english: tags.english.length,
        physics: tags.physics.length,
        chemistry: tags.chemistry.length,
        other: tags.other.length,
        total: tags.math.length + tags.english.length + tags.physics.length + tags.chemistry.length + tags.other.length,
    };
}
