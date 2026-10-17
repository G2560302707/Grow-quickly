/**
 * 外观主题系统：主题元数据、存取与导航栏/tabBar 跟随。
 * 变量本体定义在 App.vue（page 选择器默认值 + .page.t-xxx 覆盖组），
 * 页面根 view 通过 useThemeClass() 拿到主题 class 即可整页换肤。
 */

export interface ThemeMeta {
  key: string;
  name: string;
  desc: string;
  /** 主题页三个预览圆点色 */
  dots: [string, string, string];
  /** tabBar 选中色（tabBar 跟主题走，全端同步） */
  tabSelected: string;
  /** 主题主色（用于动态生成 tab 选中图标） */
  primary: string;
  /** 深色导航栏页（首页）的导航栏底色 */
  navBg: string;
}

export const THEMES: ThemeMeta[] = [
  {
    key: "studio-ink",
    name: "书房墨蓝",
    desc: "默认 · 暖灰纸感 + 墨蓝与铜金",
    dots: ["#1a2340", "#3d52d5", "#b9862f"],
    tabSelected: "#3d52d5",
    primary: "#3d52d5",
    navBg: "#101a3c",
  },
  {
    key: "cool-steel",
    name: "冷灰精密",
    desc: "近白画布 · 钢青点睛",
    dots: ["#f2f4f5", "#1f6e8c", "#c9822f"],
    tabSelected: "#1f6e8c",
    primary: "#1f6e8c",
    navBg: "#16181d",
  },
];

const STORAGE_KEY = "app-theme";

export function getThemeKey(): string {
  const k = uni.getStorageSync(STORAGE_KEY);
  return THEMES.some((t) => t.key === k) ? k : THEMES[0].key;
}

export function getThemeMeta(key?: string): ThemeMeta {
  const k = key ?? getThemeKey();
  return THEMES.find((t) => t.key === k) ?? THEMES[0];
}

/** 主题 class（页面根 view 用），如 "t-cool-steel"；默认主题返回空串 */
export function themeClassOf(key?: string): string {
  const meta = getThemeMeta(key);
  return meta.key === THEMES[0].key ? "" : `t-${meta.key}`;
}

/**
 * H5 端页面切换过渡期会报 "not TabBar page" 导致调用被丢弃，
 * 失败后短间隔重试（有上限）；其余端一次即成功。
 */
function retryingSet(fn: (opts: Record<string, unknown>) => void, opts: Record<string, unknown>, attempt = 0) {
  fn({
    ...opts,
    fail: () => {
      if (attempt < 5) setTimeout(() => retryingSet(fn, opts, attempt + 1), 300);
    },
  });
}

/**
 * tabBar 跟随主题：选中色 + 每主题一套选中态图标。
 * 页面 onShow 时幂等重放：覆盖切主题、H5 刷新恢复两种场景。
 */
export function applyTabBar(key?: string) {
  const meta = getThemeMeta(key);
  retryingSet((o) => uni.setTabBarStyle(o as unknown as UniApp.SetTabBarStyleOptions), {
    color: "#9aa3b8",
    selectedColor: meta.tabSelected,
    backgroundColor: "#ffffff",
    borderStyle: "black",
  });
  // 选中态图标按主题色预制：static/tab/<key>/<name>-active.png
  // H5 端需根绝对路径（相对路径会被拼到路由下）；小程序端要求相对路径
  let prefix = "static/";
  // #ifdef H5
  prefix = "/static/";
  // #endif
  const icons: Array<[number, string]> = [
    [0, "book"],
    [1, "scan"],
    [2, "timer"],
    [3, "user"],
  ];
  for (const [index, name] of icons) {
    retryingSet((o) => uni.setTabBarItem(o as unknown as UniApp.SetTabBarItemOptions), {
      index,
      iconPath: `${prefix}tab/${name}.png`,
      selectedIconPath: `${prefix}tab/${meta.key}/${name}-active.png`,
    });
  }
}

/**
 * 深色导航栏页（首页）的导航栏跟随主题：切换主题后调用，
 * 避免导航栏停留在写死的墨蓝色而与页面主题冲突。幂等。
 */
export function applyNav(key?: string) {
  const meta = getThemeMeta(key);
  uni.setNavigationBarColor({
    frontColor: "#ffffff",
    backgroundColor: meta.navBg,
    fail: () => {},
  });
}

/** 切换主题：持久化 + 同步 tabBar 配色与图标 */
export function setTheme(key: string): ThemeMeta {
  const meta = getThemeMeta(key);
  uni.setStorageSync(STORAGE_KEY, meta.key);
  applyTabBar(meta.key);
  uni.vibrateShort?.();
  return meta;
}

import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";

/**
 * 页面级主题 class（响应式）：进入页面与从主题页返回时刷新，
 * 并同步 tabBar 跟随主题（幂等）。
 * 用法：<view :class="['page', themeCls]"> + const themeCls = useThemeClass();
 */
export function useThemeClass() {
  const cls = ref(themeClassOf());
  onShow(() => {
    cls.value = themeClassOf();
    applyTabBar();
  });
  return cls;
}
