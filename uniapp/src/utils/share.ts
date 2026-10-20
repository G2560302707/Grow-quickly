/**
 * 分享能力工具（微信小程序）
 *
 * 统一维护三件事，避免各页面各写一套：
 *  1. 分享文案（品牌标题 / 朋友圈标题）
 *  2. 分享落地路径（详情 → 公开分享页；无令牌 → 首页）
 *  3. 分享图（微信 imageUrl 不支持 data URL，需先落成小程序本地文件）
 */

export const SHARE_BRAND_TITLE = "智能错题本｜AI 拍照整理错题";
export const SHARE_TIMELINE_TITLE = "AI 拍照整理错题，考前只看自己不会的";
export const SHARE_HOME_PATH = "/pages/index/index";
export const SHARE_PAGE_PATH = "/pages/share/share";
/** 5:4 默认分享封面（static/share/share-cover.png） */
export const SHARE_COVER = "/static/share/share-cover.png";

/** 朋友圈单页模式场景值（此时无登录态、禁止路由跳转） */
const SCENE_TIMELINE_SINGLE_PAGE = 1154;

/** 是否处于朋友圈单页模式（scene 1154） */
export function isSinglePageMode(): boolean {
	try {
		// getEnterOptionsSync 仅小程序端存在，H5 下取不到时按普通模式处理
		const api = (uni as unknown as { getEnterOptionsSync?: () => { scene?: number } })
			.getEnterOptionsSync;
		const scene = typeof api === "function" ? api()?.scene : undefined;
		return scene === SCENE_TIMELINE_SINGLE_PAGE;
	} catch {
		return false;
	}
}

/**
 * 打开右上角菜单的「发送给朋友 / 分享到朋友圈」入口。
 * App onLaunch 调一次作为默认，页面 onShow 再调一次可避免切页后菜单被重置；
 * 单页模式（scene 1154）下该接口被微信禁用，直接跳过。
 */
export function enableShareMenu(): void {
	if (isSinglePageMode()) return;
	// #ifdef MP-WEIXIN
	try {
		uni.showShareMenu({
			withShareTicket: false,
			menus: ["shareAppMessage", "shareTimeline"],
		});
	} catch {
		/* 低版本基础库/特殊场景不支持时忽略，不阻断页面 */
	}
	// #endif
}

/** 分享卡标题：题干摘要（去掉 markdown/LaTeX 噪音，超长截断） */
export function shareTitleFrom(text?: string | null, fallback = SHARE_BRAND_TITLE): string {
	const plain = (text || "")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
		.replace(/\$\$?([^$]*)\$\$?/g, "$1")
		.replace(/[#>*_`\\]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (!plain) return fallback;
	return plain.length > 24 ? `${plain.slice(0, 24)}…` : plain;
}

/** 「发送给朋友」的落地路径：有令牌走公开分享页，否则回首页（游客态/未取到令牌） */
export function buildSharePath(itemId?: string, token?: string | null): string {
	if (!itemId || !token) return SHARE_HOME_PATH;
	return `${SHARE_PAGE_PATH}?id=${encodeURIComponent(itemId)}&t=${encodeURIComponent(token)}&from=appmsg`;
}

/** 「分享到朋友圈」的 query（朋友圈不支持自定义 path，只能给当前页拼 query） */
export function buildTimelineQuery(itemId?: string, token?: string | null): string {
	if (!itemId || !token) return "from=timeline";
	return `id=${encodeURIComponent(itemId)}&t=${encodeURIComponent(token)}&from=timeline`;
}

/**
 * 准备分享图：
 * 错题原图以 data URL 存库，微信分享卡 imageUrl 不接受 data URL，
 * 这里先写入小程序本地文件再返回路径；任一步失败回落默认封面。
 */
export function prepareShareImage(dataUrl?: string | null): Promise<string> {
	// #ifdef MP-WEIXIN
	if (dataUrl && dataUrl.startsWith("data:image/")) {
		try {
			const comma = dataUrl.indexOf(",");
			const header = dataUrl.slice(0, comma);
			const base64 = dataUrl.slice(comma + 1);
			const mime = header.match(/^data:image\/([a-zA-Z0-9+.-]+);base64$/);
			const extMap: Record<string, string> = {
				"image/png": "png",
				"image/jpeg": "jpg",
				"image/jpg": "jpg",
				"image/webp": "webp",
			};
			const ext = mime ? extMap[`image/${mime[1]}`] : undefined;
			if (ext && base64) {
				const filePath = `${wx.env.USER_DATA_PATH}/share-cover.${ext}`;
				return new Promise<string>((resolve) => {
					wx.getFileSystemManager().writeFile({
						filePath,
						data: base64,
						encoding: "base64",
						success: () => resolve(filePath),
						fail: () => resolve(SHARE_COVER),
					});
				});
			}
		} catch {
			/* 落盘失败走默认封面 */
		}
	}
	// #endif
	return Promise.resolve(SHARE_COVER);
}
