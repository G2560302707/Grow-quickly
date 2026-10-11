<template>
	<view class="page">
		<!-- 深蓝 Hero：问候 + 录入入口 -->
		<view class="hero">
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
		<view class="overview card fade-up">
			<!-- 公告条 -->
			<view v-if="notice" class="notice-bar" hover-class="hv" @tap="openAnnouncement">
				<text class="notice-badge">公告</text>
				<text class="notice-title">{{ notice.title }}</text>
				<view v-if="hasUnread" class="notice-dot" />
				<text class="notice-arrow">›</text>
			</view>
			<template v-if="statsLoading">
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
			<text class="list-title">我的错题本</text>
			<text v-if="!statsLoading" class="list-count num">{{ notebooks.length }} 个</text>
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
				class="card nb-card fade-up"
				hover-class="card-hover"
				:style="{ animationDelay: idx * 0.05 + 's' }"
				@tap="openNotebook(nb)"
			>
				<view
					class="nb-icon"
					:style="moduleIcon(nb.name)
						? { background: moduleTint(nb.name) }
						: { background: moduleGradient(nb.name), boxShadow: moduleShadow(nb.name) }"
				>
					<image v-if="moduleIcon(nb.name)" class="nb-icon-img" :src="moduleIcon(nb.name)" mode="aspectFit" />
					<text v-else class="nb-icon-char">{{ nb.name.charAt(0) }}</text>
				</view>
				<view class="nb-info">
					<text class="nb-name">{{ nb.name }}</text>
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
import { getSession } from "@/utils/auth";


const notebooks = ref<Notebook[]>([]);
const loading = ref(true);
const firstLoad = ref(true);
const errorMsg = ref("");
const statsLoading = ref(true);
const userName = ref("同学");

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
	loading.value = true;
	errorMsg.value = "";
	// 先确认会话；未登录直接去登录页，避免一串 401
	const session = await getSession().catch(() => null);
	if (!session?.user) {
		loading.value = false;
		uni.reLaunch({ url: "/pages/login/login" });
		return;
	}
	if (session.user.name) userName.value = session.user.name;
	await Promise.all([loadStats(), loadAnnouncements()]);
	try {
		const list = await listNotebooks();
		notebooks.value = Array.isArray(list) ? list : [];
	} catch (e: any) {
		errorMsg.value = e?.message || "加载失败";
	} finally {
		loading.value = false;
		firstLoad.value = false;
		uni.stopPullDownRefresh();
	}
});

async function loadStats() {
	statsLoading.value = true;
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
.hero {
	background: linear-gradient(180deg, var(--brand-800) 0%, var(--brand-900) 100%);
	padding: 24rpx 40rpx calc(120rpx + 40rpx);
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
	background: radial-gradient(circle, rgba(85, 104, 232, 0.25) 0%, rgba(85, 104, 232, 0) 70%);
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
	background: linear-gradient(135deg, #d9ab52 0%, #c9973f 100%);
	border-radius: 999rpx;
	padding: 14rpx 30rpx;
	box-shadow: 0 8rpx 24rpx rgba(201, 151, 63, 0.35);
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
