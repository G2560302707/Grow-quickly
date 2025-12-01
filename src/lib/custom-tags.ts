/**
 * 自定义标签管理（基于 LocalStorage）
 */

const CUSTOM_TAGS_KEY = 'wrongnotebook_custom_tags';

export interface CustomTagsData {
    math: string[];
    english: string[];
    physics: string[];
    chemistry: string[];
    other: string[];
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
        return JSON.parse(stored);
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
export function addCustomTag(subject: keyof CustomTagsData, tag: string): boolean {
    if (!tag.trim()) return false;

    const tags = getCustomTags();
    const trimmedTag = tag.trim();

    // 检查是否已存在
    if (tags[subject].includes(trimmedTag)) {
        return false;
    }

    tags[subject].push(trimmedTag);
    saveCustomTags(tags);
    return true;
}

/**
 * 删除自定义标签
 */
export function removeCustomTag(subject: keyof CustomTagsData, tag: string): boolean {
    const tags = getCustomTags();
    const index = tags[subject].indexOf(tag);

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
        ...tags.math,
        ...tags.english,
        ...tags.physics,
        ...tags.chemistry,
        ...tags.other,
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
        const tags = JSON.parse(jsonString);

        // 验证格式
        if (!tags.math || !tags.english || !tags.physics || !tags.chemistry || !tags.other) {
            throw new Error('Invalid format');
        }

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
