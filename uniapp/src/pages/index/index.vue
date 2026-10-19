<template>
	<view :class="['page', themeCls]">
		<!-- 毛玻璃自定义导航：hero 渐变延伸到状态栏，导航悬浮其上融合 -->
		<view class="nav-glass" :style="{ paddingTop: statusBarHeight + 'px', height: navTotalHeight + 'px' }">
			<view class="nav-glass-row">
				<text class="nav-title">智能错题本</text>
			</view>
		</view>

		<!-- 深蓝 Hero：问候 + 录入入口 -->
		<view class="hero" :style="{ paddingTop: heroPadTop + 'px' }">
			<view class="hero-ring hero-ring-1" />
			<view class="hero-glow" />
			<view class="greet-row">
				<view class="greet-info">
					<text class="greet">{{ greeting }}，{{ userName }}</text>
					<text class="greet-sub">坚持整理，稳步提分</text>
				</view>
				<view class="hero-cta" hover-class="hv" @tap="goAnalyze">
					<text class="hero-cta-plus">＋</text>
					<text class="hero-cta-text">拍错题</text>
				</view>
			</view>
		</view>

		<!-- 学习概览卡 -->
		<view class="overview card" :class="{ 'fade-up': playEnterAnim }">
			<!-- 游客横幅：未登录可浏览演示数据，登录后同步真实数据 -->
			<view v-if="guestMode" class="notice-bar" hover-class="hv" @tap="goLogin">
				<text class="notice-badge">游客</text>
				<text class="notice-title">正在浏览演示数据，登录后同步你的错题本</text>
				<text class="guest-login">登录</text>
			</view>
			<!-- 公告条：有数据再显示，避免从识别切回时高度闪一下 -->
			<view v-if="notice" class="notice-bar" hover-class="hv" @tap="openAnnouncement">
				<text class="notice-badge">公告</text>
				<text class="notice-title">{{ notice.title }}</text>
				<view v-if="hasUnread" class="notice-dot" />
				<text class="notice-arrow">›</text>
			</view>
			<template v-if="statsLoading && firstLoad">
				<view class="ov-skel-row">
					<view v-for="i in 3" :key="i" class="ov-skel-item">
						<view class="skel ov-skel-num" />
						<view class="skel ov-skel-label" />
					</view>
				</view>
			</template>
			<template v-else>
				<view class="ov-stats">
					<view class="ov-item">
						<text class="ov-num num">{{ stats.totalItems }}</text>
						<text class="ov-label">累计错题</text>
					</view>
					<view class="ov-divider" />
					<view class="ov-item">
						<text class="ov-num ov-num-gold num">{{ stats.mastered }}</text>
						<text class="ov-label">已掌握</text>
					</view>
					<view class="ov-divider" />
					<view class="ov-item">
						<text class="ov-num num">{{ stats.masteryRate }}<text class="ov-unit">%</text></text>
						<text class="ov-label">掌握率</text>
					</view>
				</view>
				<view class="ov-progress">
					<view class="ov-progress-bar" :style="{ width: stats.masteryRate + '%' }" />
				</view>
				<view class="ov-legend">
					<text class="ov-legend-text">未掌握 {{ stats.unmastered }}</text>
					<text class="ov-legend-text">复习中 {{ stats.reviewing }}</text>
					<text class="ov-legend-text ov-legend-strong">已掌握 {{ stats.mastered }}</text>
				</view>
			</template>
		</view>

		<!-- 错题本列表 -->
		<view class="list-head">
			<view class="list-head-left">
				<text class="list-title">我的错题本</text>
				<text v-if="!statsLoading" class="list-count num">{{ notebooks.length }} 个</text>
			</view>
			<text class="list-manage" hover-class="hv" @tap="goManage">管理</text>
		</view>

		<template v-if="loading && firstLoad">
			<view v-for="i in 3" :key="'sk' + i" class="card nb-card">
				<view class="skel nb-skel-icon" />
				<view class="nb-skel-lines">
					<view class="skel nb-skel-line" />
					<view class="skel nb-skel-line-short" />
				</view>
			</view>
		</template>
		<view v-else-if="errorMsg" class="error-tip">{{ errorMsg }}</view>
		<view v-else-if="notebooks.length === 0" class="empty-tip">
			<view class="empty-badge">＋</view>
			<text class="empty-main">还没有错题本</text>
			<text class="empty-sub">点击下方"拍错题"添加第一道错题</text>
		</view>
		<template v-else>
			<view
				v-for="(nb, idx) in notebooks"
				:key="nb.id"
				class="card nb-card"
				:class="{ 'fade-up': playEnterAnim }"
				hover-class="card-hover"
				:style="playEnterAnim ? { animationDelay: idx * 0.05 + 's' } : undefined"
				@tap="openNotebook(nb)"
			>
				<view
					class="nb-icon"
					:style="cardIcon(nb)
						? { background: moduleTint(nb.name) }
						: { background: moduleGradient(nb.name), boxShadow: moduleShadow(nb.name) }"
				>
					<image v-if="cardIcon(nb)" class="nb-icon-img" :src="cardIcon(nb)" mode="aspectFit" />
					<text v-else class="nb-icon-char">{{ nb.name.charAt(0) }}</text>
				</view>
				<view class="nb-info">
					<view class="nb-name-row">
						<text class="nb-name">{{ nb.name }}</text>
						<text v-if="nb.isDefault" class="nb-default-tag">默认</text>
					</view>
					<text class="nb-count num">{{ nb._count?.errorItems ?? 0 }} 道错题</text>
				</view>
				<text class="nb-arrow">›</text>
			</view>
		</template>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onShow, onPullDownRefresh } from "@dcloudio/uni-app";
import {
	listNotebooks,
	getOverviewStats,
	getAnnouncements,
	markAnnouncementsRead,
	type Notebook,
	type OverviewStats,
	type AnnouncementItem,
	getFocusStats,
} from "@/api";
import { subjectIcon, subjectTint } from "@/utils/subject-icon";
import { notebookIconSrc } from "@/utils/notebook-icons";
import { useThemeClass } from "@/utils/theme";
import { getSession } from "@/utils/auth";

const themeCls = useThemeClass();

// 自定义导航尺寸：状态栏 + 胶囊对齐（微信）；H5 无胶囊按 44px
const statusBarHeight = ref(0);
const navBarHeight = ref(44);
try {
	const win = uni.getWindowInfo && uni.getWindowInfo();
	if (win) statusBarHeight.value = win.statusBarHeight || 0;
	// #ifdef MP-WEIXIN
	const menu = uni.getMenuButtonBoundingClientRect();
	if (menu && menu.height && menu.bottom) {
		// 玻璃底边锚定胶囊下沿 + 6px 余量，保证问候语完整落在玻璃之外
		navBarHeight.value = menu.bottom - statusBarHeight.value + 6;
	}
	// #endif
} catch (e) {
	// 降级保持默认 44px
}
const navTotalHeight = computed(() => statusBarHeight.value + navBarHeight.value);
const heroPadTop = computed(() => navTotalHeight.value + 20);


const notebooks = ref<Notebook[]>([]);
const loading = ref(true);
const firstLoad = ref(true);
/** 仅首次进入播放入场动画，Tab 切回不再 fade-up 造成抖动 */
const playEnterAnim = ref(true);
const errorMsg = ref("");
const statsLoading = ref(true);
const userName = ref("同学");
let refreshing = false;

const EMPTY_STATS: OverviewStats = {
	totalItems: 0,
	unmastered: 0,
	reviewing: 0,
	mastered: 0,
	masteryRate: 0,
	notebookCount: 0,
	weekAdded: 0,
};
const stats = ref<OverviewStats>({ ...EMPTY_STATS });
const guestMode = ref(false);

function goLogin() {
	uni.navigateTo({ url: "/pages/login/login" });
}

// 公告：展示最新一条，未读时亮红点，点开看全文并标记已读
const announcements = ref<AnnouncementItem[]>([]);
const notice = computed(() => announcements.value[0] ?? null);
const hasUnread = computed(() => announcements.value.some(a => !a.read));

function openAnnouncement() {
	if (!notice.value) return;
	uni.showModal({
		title: notice.value.title,
		content: notice.value.content,
		showCancel: false,
		confirmText: "知道了",
		success: () => {
			if (hasUnread.value) {
				markAnnouncementsRead()
					.then(() => {
						announcements.value = announcements.value.map(a => ({ ...a, read: true }));
					})
					.catch(() => {});
			}
		},
	});
}

async function loadAnnouncements() {
	try {
		const res = await getAnnouncements();
		announcements.value = Array.isArray(res?.announcements) ? res.announcements : [];
	} catch {
		announcements.value = [];
	}
}

const greeting = computed(() => {
	const h = new Date().getHours();
	if (h < 6) return "夜深了";
	if (h < 11) return "早上好";
	if (h < 13) return "中午好";
	if (h < 18) return "下午好";
	return "晚上好";
});

const totalItems = computed(() =>
	notebooks.value.reduce((sum, nb) => sum + (nb._count?.errorItems ?? 0), 0)
);

onShow(async () => {
	if (refreshing) return;
	errorMsg.value = "";
	// 合规整改：未登录留在首页浏览演示数据，右上角/横幅提供登录入口
	const session = await getSession().catch(() => null);
	guestMode.value = !session?.user;
	if (session?.user?.name) userName.value = session.user.name;

	const isFirst = firstLoad.value;
	if (isFirst) {
		loading.value = true;
		playEnterAnim.value = true;
	} else {
		// 从识别等 Tab 切回：保留旧内容静默刷新，避免骨架/动画抖动
		playEnterAnim.value = false;
	}

	refreshing = true;
	try {
		await Promise.all([loadStats(!isFirst), loadAnnouncements()]);
		const list = await listNotebooks();
		notebooks.value = Array.isArray(list) ? list : [];
	} catch (e: any) {
		errorMsg.value = e?.message || "加载失败";
	} finally {
		loading.value = false;
		firstLoad.value = false;
		refreshing = false;
		uni.stopPullDownRefresh();
	}
});

async function loadStats(silent = false) {
	if (!silent) statsLoading.value = true;
	try {
		stats.value = await getOverviewStats();
	} catch {
		// 概览接口失败时退回错题本合计，不打断页面
		stats.value = { ...EMPTY_STATS, totalItems: totalItems.value, notebookCount: notebooks.value.length };
	} finally {
		statsLoading.value = false;
	}
}

onPullDownRefresh(async () => {
	try {
		const [nb, ] = await Promise.all([listNotebooks(), loadStats()]);
		notebooks.value = Array.isArray(nb) ? nb : [];
	} finally {
		uni.stopPullDownRefresh();
	}
});

function openNotebook(nb: Notebook) {
	uni.navigateTo({
		url: `/pages/items/items?subjectId=${nb.id}&name=${encodeURIComponent(nb.name)}`,
	});
}

function goAnalyze() {
	uni.switchTab({ url: "/pages/analyze/analyze" });
}

/** 行测模块专属配色（沉稳商务色调） */
const MODULE_COLORS: Array<[string, string]> = [
	["言语", "#3d52d5"],
	["常识", "#b8862f"],
	["判断", "#7048c6"],
	["数量", "#0f8a5f"],
	["资料", "#0e7fa8"],
	["申论", "#c04e58"],
];

function moduleColor(name: string): string {
	for (const [key, color] of MODULE_COLORS) {
		if (name.includes(key)) return color;
	}
	return "#56628c";
}

function moduleIcon(name: string): string {
	return subjectIcon(name);
}

/** 卡片图标：有 iconKey 用统一图标库，否则退回按名称映射 */
function cardIcon(nb: Notebook): string {
	return nb.iconKey ? notebookIconSrc(nb.iconKey) : subjectIcon(nb.name);
}

function goManage() {
	uni.navigateTo({ url: "/pages/notebook-manage/notebook-manage" });
}

function moduleTint(name: string): string {
	return subjectTint(name) || 'transparent';
}

function moduleGradient(name: string): string {
	const c = moduleColor(name);
	return `linear-gradient(140deg, ${c} 0%, ${c}c4 100%)`;
}

function moduleShadow(name: string): string {
	const c = moduleColor(name);
	return `0 8rpx 20rpx ${c}40`;
}
</script>

<style scoped>
/* ---------- Hero ---------- */
/* ---------- 毛玻璃自定义导航 ---------- */
.nav-glass {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	z-index: 90;
	display: flex;
	flex-direction: column;
	/* 关键：height 含 padding（否则玻璃实际高度多出一个状态栏，真机上会盖住问候语） */
	box-sizing: border-box;
	/* 半透明渐变到透明：与 hero 顶色融合，无割裂线 */
	background: linear-gradient(180deg, var(--nav-glass) 0%, rgba(255, 255, 255, 0) 72%);
	backdrop-filter: blur(16px);
	-webkit-backdrop-filter: blur(16px);
}
.nav-glass-row {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
}
.nav-title {
	color: #ffffff;
	font-size: 32rpx;
	font-weight: 600;
	letter-spacing: 2rpx;
}

/* ---------- Hero ---------- */
.hero {
	background: linear-gradient(180deg, var(--brand-800) 0%, var(--brand-900) 100%);
	/* 顶部让位毛玻璃导航（内联 padding-top），底部给概览卡叠压留白 */
	padding: 0 40rpx calc(120rpx + 40rpx);
	position: relative;
	overflow: hidden;
}
.hero-ring {
	position: absolute;
	border-radius: 50%;
	border: 1rpx solid rgba(255, 255, 255, 0.06);
}
.hero-ring-1 {
	width: 420rpx;
	height: 420rpx;
	top: -200rpx;
	right: -120rpx;
}
.hero-glow {
	position: absolute;
	width: 360rpx;
	height: 360rpx;
	border-radius: 50%;
	background: radial-gradient(circle, var(--glow-primary) 0%, transparent 70%);
	top: -80rpx;
	right: 40rpx;
}
.greet-row {
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	position: relative;
}
.greet-info {
	display: flex;
	flex-direction: column;
}
.greet {
	color: #ffffff;
	font-size: 38rpx;
	font-weight: 700;
	letter-spacing: 1rpx;
}
.greet-sub {
	color: rgba(255, 255, 255, 0.55);
	font-size: 24rpx;
	margin-top: 10rpx;
	letter-spacing: 2rpx;
}
.hero-cta {
	display: flex;
	align-items: center;
	background: linear-gradient(135deg, var(--gold-500) 0%, var(--gold-600) 100%);
	border-radius: 999rpx;
	padding: 14rpx 30rpx;
	box-shadow: var(--shadow-primary);
}
.hero-cta-plus {
	color: #ffffff;
	font-size: 30rpx;
	font-weight: 600;
	margin-right: 6rpx;
}
.hero-cta-text {
	color: #ffffff;
	font-size: 26rpx;
	font-weight: 600;
	letter-spacing: 2rpx;
}
.hv {
	opacity: 0.85;
}

	/* ---------- 公告条（位于白色概览卡内，勿用白字） ---------- */
	.notice-bar {
		display: flex;
		align-items: center;
		background: rgba(201, 151, 63, 0.1);
		border: 1rpx solid rgba(201, 151, 63, 0.28);
		border-radius: 14rpx;
		padding: 16rpx 22rpx;
		margin-bottom: 28rpx;
	}
	.notice-badge {
		background: linear-gradient(135deg, #d9ab52, #c9973f);
		color: #ffffff;
		font-size: 20rpx;
		font-weight: 600;
		border-radius: 6rpx;
		padding: 4rpx 12rpx;
		margin-right: 16rpx;
		flex-shrink: 0;
		letter-spacing: 2rpx;
	}
	.notice-title {
		flex: 1;
		min-width: 0;
		color: #1a2332;
		font-size: 26rpx;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.guest-login {
		color: var(--brand-600);
		font-size: 26rpx;
		font-weight: 600;
		flex-shrink: 0;
		padding: 4rpx 8rpx;
	}
	.notice-dot {
		width: 12rpx;
		height: 12rpx;
		border-radius: 50%;
		background: #ff5a5f;
		margin: 0 10rpx;
		flex-shrink: 0;
		box-shadow: 0 0 10rpx rgba(255, 90, 95, 0.8);
	}
	.notice-arrow {
		color: rgba(26, 35, 50, 0.35);
		font-size: 36rpx;
		margin-left: 8rpx;
		flex-shrink: 0;
	}

	/* ---------- 概览卡 ---------- */
.overview {
	margin-top: -96rpx;
	position: relative;
	z-index: 2;
	padding: 36rpx 32rpx 32rpx;
}
.ov-stats {
	display: flex;
	align-items: stretch;
}
.ov-item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.ov-num {
	font-size: 52rpx;
	font-weight: 700;
	color: var(--ink-900);
	line-height: 1.15;
}
.ov-num-gold {
	color: var(--gold-600);
}
.ov-unit {
	font-size: 28rpx;
	font-weight: 600;
	margin-left: 2rpx;
}
.ov-label {
	font-size: 24rpx;
	color: var(--ink-400);
	margin-top: 8rpx;
}
.ov-divider {
	width: 1rpx;
	background: var(--line-100);
	margin: 8rpx 0;
}
.ov-progress {
	height: 12rpx;
	border-radius: 999rpx;
	background: var(--line-50);
	margin-top: 30rpx;
	overflow: hidden;
}
.ov-progress-bar {
	height: 100%;
	border-radius: 999rpx;
	background: linear-gradient(90deg, var(--gold-500) 0%, var(--brand-500) 55%, var(--brand-600) 100%);
	transition: width 0.5s ease;
	min-width: 0;
}
.ov-legend {
	display: flex;
	justify-content: space-between;
	margin-top: 14rpx;
}
.ov-legend-text {
	font-size: 22rpx;
	color: var(--ink-400);
}
.ov-legend-strong {
	color: var(--success-600);
	font-weight: 600;
}
.ov-skel-row {
	display: flex;
}
.ov-skel-item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.ov-skel-num {
	width: 96rpx;
	height: 52rpx;
	border-radius: 12rpx;
}
.ov-skel-label {
	width: 88rpx;
	height: 24rpx;
	border-radius: 8rpx;
	margin-top: 14rpx;
}

/* ---------- 列表头 ---------- */
.list-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 20rpx 32rpx 4rpx;
}
.list-title {
	font-size: 30rpx;
	font-weight: 700;
	color: var(--ink-900);
	letter-spacing: 1rpx;
}
.list-count {
	font-size: 24rpx;
	color: var(--ink-400);
}
.list-head-left {
	display: flex;
	align-items: baseline;
	gap: 12rpx;
}
.list-manage {
	font-size: 26rpx;
	color: var(--brand-600);
	font-weight: 500;
	padding: 4rpx 8rpx;
}
.nb-name-row {
	display: flex;
	align-items: center;
	gap: 12rpx;
}
.nb-default-tag {
	font-size: 20rpx;
	color: var(--brand-600);
	background: var(--brand-50);
	border-radius: 8rpx;
	padding: 2rpx 12rpx;
	line-height: 1.5;
	flex-shrink: 0;
}

/* ---------- 错题本卡片 ---------- */
.nb-card {
	display: flex;
	align-items: center;
	padding: 30rpx 32rpx;
}
.nb-skel-icon {
	width: 92rpx;
	height: 92rpx;
	border-radius: 26rpx;
	flex-shrink: 0;
}
.nb-skel-lines {
	flex: 1;
	margin-left: 26rpx;
}
.nb-skel-line {
	height: 30rpx;
	width: 40%;
	border-radius: 8rpx;
}
.nb-skel-line-short {
	height: 22rpx;
	width: 26%;
	border-radius: 8rpx;
	margin-top: 16rpx;
}
.nb-icon {
	width: 92rpx;
	height: 92rpx;
	border-radius: 26rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 26rpx;
	flex-shrink: 0;
}
.nb-icon-img {
	width: 46rpx;
	height: 46rpx;
}
.nb-icon-char {
	color: #ffffff;
	font-size: 40rpx;
	font-weight: 600;
}
.nb-info {
	flex: 1;
	display: flex;
	flex-direction: column;
}
.nb-name {
	font-size: 32rpx;
	font-weight: 600;
	color: var(--ink-900);
}
.nb-count {
	font-size: 24rpx;
	color: var(--ink-400);
	margin-top: 8rpx;
}
.nb-arrow {
	font-size: 44rpx;
	color: var(--ink-300);
	font-weight: 300;
}

/* ---------- 空态 ---------- */
.empty-badge {
	width: 112rpx;
	height: 112rpx;
	margin: 0 auto 28rpx;
	border-radius: 32rpx;
	background: var(--brand-50);
	border: 1rpx solid var(--brand-100);
	color: var(--brand-600);
	font-size: 52rpx;
	font-weight: 300;
	display: flex;
	align-items: center;
	justify-content: center;
}
</style>
