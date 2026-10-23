/**
 * 游客浏览模式（微信审核合规整改）：
 * - 启动与首页不再强制跳登录页，未登录可自由浏览（读接口返回本地演示数据）
 * - 需要账号的写操作由 guestGuard 统一拦截，页面 catch 展示引导文案
 * - 关键功能入口（AI 识别、编辑资料等）通过 showLoginGuide 主动弹窗引导
 */
import type { Session } from "./auth";

let sessionPromise: Promise<boolean> | null = null;
// 未确认前不预判游客：真正的未登录用户会先经过登录页，进入业务页前都会先同步会话
let guest = false;

let sessionFetcher: () => Promise<Session | null> = async () => null;

/** 由 auth.ts 注入 getSession，避免 guest ↔ auth 循环依赖 */
export function setSessionFetcher(fn: () => Promise<Session | null>): void {
	sessionFetcher = fn;
}

/**
 * 用一次已确认的会话结果同步游客状态。
 * auth.getSession() 每次拿到服务端权威结果后都会调用：
 * 即使启动阶段判定有误，后续任意一次会话校验也能自动纠正。
 */
export function syncGuestFromSession(session: Session | null): void {
	guest = !session?.user;
	sessionPromise = Promise.resolve(guest);
}

/**
 * 解析会话并判定是否游客。
 * 可显式传入会话拉取函数（App 启动时传 auth.getSession，避免 auth 模块尚未加载时
 * 使用默认的 null 结果把已登录用户误判为游客）。
 */
export function resolveGuest(fetcher?: () => Promise<Session | null>): Promise<boolean> {
	const cached = sessionPromise;
	if (cached) return cached.then(() => guest);
	const p = (fetcher || sessionFetcher)()
		.then((s) => {
			guest = !s?.user;
			return guest;
		})
		.catch(() => {
			guest = true;
			return true;
		});
	sessionPromise = p;
	return p.then(() => guest);
}

/** 同步判定（resolveGuest 完成后有效） */
export function isGuest(): boolean {
	return guest;
}

/**
 * 登录/登出后清空缓存，下次 resolveGuest 重新拉会话。
 * 不直接改 guest 值：登录后由 getSession 的同步结果接管，
 * 登出后由 syncGuestFromSession(null) 显式置为游客。
 */
export function resetGuestCache(): void {
	sessionPromise = null;
}

/**
 * 写操作守卫：游客时抛出引导文案错误（不发请求，页面 catch 展示）。
 * 服务端数据仍以后端为准，演示数据不会被"写入"。
 */
export async function guestGuard(action?: string): Promise<void> {
	if (await resolveGuest()) {
		throw new Error(`登录后即可${action || "使用该功能"}（当前为游客浏览模式）`);
	}
}

/** 主动登录引导弹窗：确认后进入登录页（可返回继续浏览） */
export function showLoginGuide(action?: string): void {
	uni.showModal({
		title: "需要登录",
		content: action
			? `${action}为账号功能，登录后即可使用，并同步网页端全部数据。`
			: "登录后即可同步网页端全部数据。",
		confirmText: "去登录",
		cancelText: "先逛逛",
		success: (res) => {
			if (res.confirm) {
				uni.navigateTo({ url: "/pages/login/login" });
			}
		},
	});
}
