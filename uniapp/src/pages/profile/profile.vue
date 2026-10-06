<template>
	<view class="page">
		<!-- 深蓝头部 -->
		<view class="header">
			<view class="header-ring" />
			<view class="header-glow" />
			<view class="user-row">
				<view class="avatar"><text class="avatar-char">{{ avatarChar }}</text></view>
				<view class="user-info">
					<text class="user-name">{{ session?.user?.name || "未登录" }}</text>
					<text class="user-email">{{ session?.user?.email || "" }}</text>
				</view>
			</view>
		</view>

		<!-- 学习概览 -->
		<view class="stats card fade-up">
			<template v-if="statsLoading">
				<view v-for="i in 3" :key="'sk' + i" class="stat-item">
					<view class="skel stat-skel-num" />
					<view class="skel stat-skel-label" />
				</view>
			</template>
			<template v-else>
				<view class="stat-item">
					<text class="stat-num num">{{ overview.totalItems }}</text>
					<text class="stat-label">累计错题</text>
				</view>
				<view class="stat-divider" />
				<view class="stat-item">
					<text class="stat-num num">{{ practice.total }}</text>
					<text class="stat-label">练习次数</text>
				</view>
				<view class="stat-divider" />
				<view class="stat-item">
					<text class="stat-num stat-num-gold num">{{ practice.rate }}<text class="stat-unit">%</text></text>
					<text class="stat-label">答对率</text>
				</view>
			</template>
		</view>

		<!-- 菜单 -->
		<view class="card menu-card fade-up">
			<view class="menu-item" hover-class="hv" @tap="goNotebooks">
				<view class="menu-icon menu-icon-brand">
					<view class="glyph-book">
						<view class="glyph-book-spine" />
					</view>
				</view>
				<text class="menu-text">我的错题本</text>
				<text class="menu-arrow">›</text>
			</view>
			<view class="menu-item" hover-class="hv" @tap="goStats">
				<view class="menu-icon menu-icon-blue">
					<view class="glyph-chart">
						<view class="glyph-bar glyph-bar-1" />
						<view class="glyph-bar glyph-bar-2" />
						<view class="glyph-bar glyph-bar-3" />
					</view>
				</view>
				<text class="menu-text">学习统计</text>
				<text class="menu-arrow">›</text>
			</view>
			<view class="menu-item" hover-class="hv" @tap="goFeedback">
				<view class="menu-icon menu-icon-gold">
					<view class="glyph-chat">
						<view class="glyph-chat-dot" />
						<view class="glyph-chat-dot glyph-chat-dot-2" />
					</view>
				</view>
				<text class="menu-text">帮助与反馈</text>
				<text class="menu-arrow">›</text>
			</view>
			<view class="menu-item" hover-class="hv" @tap="goDataManage">
				<view class="menu-icon menu-icon-blue">
					<view class="glyph-arrows">
						<text class="glyph-arrows-text">⇅</text>
					</view>
				</view>
				<text class="menu-text">数据导入导出</text>
				<text class="menu-arrow">›</text>
			</view>
			<view class="menu-item" hover-class="hv" @tap="goProfileEdit">
				<view class="menu-icon menu-icon-brand">
					<view class="glyph-user">
						<view class="glyph-user-head" />
						<view class="glyph-user-body" />
					</view>
				</view>
				<text class="menu-text">编辑资料</text>
				<text class="menu-arrow">›</text>
			</view>
		</view>

		<view class="version-row">
			<text class="version-text">智能错题本 · v1.0.0</text>
		</view>

		<button class="btn-outline logout-btn" hover-class="button-hover" @tap="handleLogout">退出登录</button>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { getOverviewStats, getPracticeSummary, type OverviewStats, type PracticeSummary } from "@/api";
import { getSession, logout, type Session } from "@/utils/auth";

const session = ref<Session | null>(null);
const statsLoading = ref(true);
const overview = ref<OverviewStats>({
	totalItems: 0,
	unmastered: 0,
	reviewing: 0,
	mastered: 0,
	masteryRate: 0,
	notebookCount: 0,
	weekAdded: 0,
});
const practice = ref<PracticeSummary>({ total: 0, correct: 0, rate: 0 });

const avatarChar = computed(() => (session.value?.user?.name || "未")[0]);

onShow(async () => {
	statsLoading.value = true;
	const [sess, ov, pr] = await Promise.all([
		getSession().catch(() => null),
		getOverviewStats().catch(() => null),
		getPracticeSummary().catch(() => null),
	]);
	session.value = sess;
	if (ov) overview.value = ov;
	if (pr) practice.value = pr;
	statsLoading.value = false;
});

function goNotebooks() {
	uni.switchTab({ url: "/pages/index/index" });
}

function goStats() {
	uni.navigateTo({ url: "/pages/stats/stats" });
}

function goFeedback() {
	uni.navigateTo({ url: "/pages/help/help" });
}

function goProfileEdit() {
	uni.navigateTo({ url: "/pages/profile-edit/profile-edit" });
}

function goDataManage() {
	uni.navigateTo({ url: "/pages/profile/data-manage" });
}

function handleLogout() {
	uni.showModal({
		title: "提示",
		content: "确定退出登录吗？",
		confirmColor: "#3d52d5",
		success: (res) => {
			if (res.confirm) {
				logout();
			}
		},
	});
}
</script>

<style scoped>
/* ---------- 头部 ---------- */
.header {
	background: linear-gradient(172deg, var(--brand-800) 0%, var(--brand-900) 100%);
	padding: calc(var(--status-bar-height) + 100rpx) 40rpx calc(96rpx + 40rpx);
	position: relative;
	overflow: hidden;
}
.header-ring {
	position: absolute;
	width: 420rpx;
	height: 420rpx;
	border-radius: 50%;
	border: 1rpx solid rgba(255, 255, 255, 0.07);
	top: -180rpx;
	right: -100rpx;
}
.header-glow {
	position: absolute;
	width: 340rpx;
	height: 340rpx;
	border-radius: 50%;
	background: radial-gradient(circle, rgba(85, 104, 232, 0.28) 0%, rgba(85, 104, 232, 0) 70%);
	top: -60rpx;
	right: 60rpx;
}
.user-row {
	display: flex;
	align-items: center;
	position: relative;
}
.avatar {
	width: 120rpx;
	height: 120rpx;
	border-radius: 50%;
	background: linear-gradient(140deg, #5568e8 0%, #3d52d5 80%);
	border: 3rpx solid rgba(201, 151, 63, 0.75);
	box-shadow: 0 12rpx 32rpx rgba(5, 10, 26, 0.35);
	color: #ffffff;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 28rpx;
}
.avatar-char {
	font-size: 52rpx;
	font-weight: 700;
}
.user-info {
	display: flex;
	flex-direction: column;
}
.user-name {
	font-size: 38rpx;
	font-weight: 700;
	color: #ffffff;
	letter-spacing: 1rpx;
}
.user-email {
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.6);
	margin-top: 10rpx;
}

/* ---------- 统计卡 ---------- */
.stats {
	margin-top: -72rpx;
	position: relative;
	z-index: 2;
	padding: 32rpx;
	display: flex;
	align-items: stretch;
}
.stat-item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.stat-num {
	font-size: 44rpx;
	font-weight: 700;
	color: var(--ink-900);
	line-height: 1.15;
}
.stat-num-gold {
	color: var(--gold-600);
}
.stat-unit {
	font-size: 24rpx;
	font-weight: 600;
	margin-left: 2rpx;
}
.stat-label {
	font-size: 24rpx;
	color: var(--ink-400);
	margin-top: 8rpx;
}
.stat-divider {
	width: 1rpx;
	background: var(--line-100);
	margin: 8rpx 0;
}
.stat-skel-num {
	width: 88rpx;
	height: 44rpx;
	border-radius: 10rpx;
}
.stat-skel-label {
	width: 80rpx;
	height: 22rpx;
	border-radius: 8rpx;
	margin-top: 12rpx;
}

/* ---------- 菜单 ---------- */
.menu-card {
	padding: 8rpx 32rpx;
}
.menu-item {
	display: flex;
	align-items: center;
	padding: 28rpx 0;
}
.menu-item + .menu-item {
	border-top: 1rpx solid var(--line-50);
}
.menu-icon {
	width: 72rpx;
	height: 72rpx;
	border-radius: 18rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 24rpx;
	flex-shrink: 0;
}
.menu-icon-brand {
	background: var(--brand-50);
	border: 1rpx solid var(--brand-100);
}
.menu-icon-blue {
	background: #eaf3fb;
	border: 1rpx solid #d3e5f3;
}
.menu-icon-gold {
	background: var(--gold-50);
	border: 1rpx solid var(--gold-100);
}
.menu-text {
	flex: 1;
	font-size: 30rpx;
	color: var(--ink-900);
	font-weight: 500;
}
.menu-arrow {
	color: var(--ink-300);
	font-size: 40rpx;
	font-weight: 300;
}
.hv {
	opacity: 0.72;
	background: #fafbfd;
}

/* ---------- CSS 图标 ---------- */
.glyph-user {
	position: relative;
	width: 36rpx;
	height: 40rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.glyph-user-head {
	width: 14rpx;
	height: 14rpx;
	border: 3rpx solid var(--brand-600);
	border-radius: 50%;
}
.glyph-user-body {
	width: 24rpx;
	height: 12rpx;
	border: 3rpx solid var(--brand-600);
	border-bottom: none;
	border-radius: 12rpx 12rpx 0 0;
	margin-top: 4rpx;
}
.glyph-arrows {
	display: flex;
	align-items: center;
	justify-content: center;
}
.glyph-arrows-text {
	font-size: 30rpx;
	font-weight: 700;
	color: var(--brand-600);
	line-height: 1;
}
.glyph-book {
	position: relative;
	width: 36rpx;
	height: 40rpx;
	border: 3rpx solid var(--brand-600);
	border-radius: 6rpx;
}
.glyph-book-spine {
	position: absolute;
	left: 50%;
	top: 4rpx;
	bottom: 4rpx;
	width: 3rpx;
	background: var(--brand-600);
	transform: translateX(-50%);
}
.glyph-chart {
	display: flex;
	align-items: flex-end;
	gap: 6rpx;
	height: 40rpx;
}
.glyph-bar {
	width: 8rpx;
	border-radius: 3rpx;
	background: #1273b4;
}
.glyph-bar-1 {
	height: 18rpx;
}
.glyph-bar-2 {
	height: 30rpx;
}
.glyph-bar-3 {
	height: 40rpx;
}
.glyph-chat {
	position: relative;
	width: 40rpx;
	height: 34rpx;
	border: 3rpx solid var(--gold-600);
	border-radius: 10rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
}
.glyph-chat-dot {
	width: 8rpx;
	height: 8rpx;
	border-radius: 50%;
	background: var(--gold-600);
}
.glyph-chat-dot-2 {
	opacity: 0.55;
}

/* ---------- 版本 / 退出 ---------- */
.version-row {
	display: flex;
	justify-content: center;
	padding: 16rpx 0 8rpx;
}
.version-text {
	font-size: 22rpx;
	color: var(--ink-300);
	letter-spacing: 1rpx;
}
.logout-btn {
	margin: 32rpx 24rpx calc(env(safe-area-inset-bottom) + 40rpx);
	color: var(--danger-600);
	border-color: rgba(217, 58, 69, 0.3);
}
</style>
