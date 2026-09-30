"use client";

/**
 * 主题上下文：light / dark / system
 * - 持久化到 localStorage('app-theme')
 * - 通过切换 <html> 的 .dark class 生效（globals.css 的 dark variant 已就绪）
 * - system 模式跟随系统偏好并实时响应系统切换
 * - 首屏 class 由 layout.tsx 的防闪烁脚本提前设置，本组件负责后续切换
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: ThemeMode;
    setTheme: (theme: ThemeMode) => void;
    /** 实际生效的主题（system 解析后），供需要明确颜色的场景使用 */
    resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'app-theme';

function readStoredTheme(): ThemeMode {
    if (typeof window === 'undefined') return 'system';
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
}

function systemPrefersDark(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<ThemeMode>(readStoredTheme);
    const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

    // system 模式下跟随系统偏好切换（订阅回调为异步事件，可安全 setState）
    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => setSystemDark(media.matches);
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    const resolvedTheme: 'light' | 'dark' =
        theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

    // theme / 系统偏好变化时同步 <html> class（仅 DOM 操作）
    useEffect(() => {
        const classList = document.documentElement.classList;
        if (resolvedTheme === 'dark') classList.add('dark');
        else classList.remove('dark');
    }, [resolvedTheme]);

    const setTheme = useCallback((mode: ThemeMode) => {
        setThemeState(mode);
        localStorage.setItem(STORAGE_KEY, mode);
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
