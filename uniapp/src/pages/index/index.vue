<template>
	<view class="page">
		<view v-if="loading && firstLoad" class="empty-tip">正在整理错题本...</view>
		<view v-else-if="errorMsg" class="error-tip">{{ errorMsg }}</view>
		<template v-else>
			<!-- 概览条 -->
			<view class="summary card">
				<view class="summary-item">
					<text class="summary-num">{{ notebooks.length }}</text>
					<text class="summary-label">错题本</text>
				</view>
				<view class="summary-divider" />
				<view class="summary-item">
					<text class="summary-num">{{ totalItems }}</text>
					<text class="summary-label">错题总数</text>
				</view>
				<view class="summary-divider" />
				<view class="summary-item" @tap="goAnalyze">
					<text class="summary-num summary-num-action">＋</text>
					<text class="summary-label">拍错题</text>
				</view>
			</view>

			<view v-if="notebooks.length === 0" class="empty-tip">
				<text class="empty-main">还没有错题本</text>
				<text class="empty-sub">点击下方"识别"添加第一道错题</text>
			</view>

			<!-- 错题本列表 -->
			<view
				v-for="nb in notebooks"
				:key="nb.id"
				class="card nb-card"
				hover-class="card-hover"
				@tap="openNotebook(nb)"
			>
				<view class="nb-icon" :style="{ background: moduleGradient(nb.name) }">
					{{ nb.name.charAt(0) }}
				</view>
				<view class="nb-info">
					<text class="nb-name">{{ nb.name }}</text>
					<view class="nb-meta">
						<text class="nb-count">{{ nb._count?.errorItems ?? 0 }} 道题目</text>
					</view>
				</view>
				<text class="nb-arrow">›</text>
			</view>
		</template>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onShow, onPullDownRefresh } from "@dcloudio/uni-app";
import { listNotebooks, type Notebook } from "@/api";

const notebooks = ref<Notebook[]>([]);
const loading = ref(true);
const firstLoad = ref(true);
const errorMsg = ref("");

const totalItems = computed(() =>
	notebooks.value.reduce((sum, nb) => sum + (nb._count?.errorItems ?? 0), 0)
);

onShow(async () => {
	loading.value = true;
	errorMsg.value = "";
	try {
		notebooks.value = await listNotebooks();
	} catch (e: any) {
		errorMsg.value = e?.message || "加载失败";
	} finally {
		loading.value = false;
		firstLoad.value = false;
		uni.stopPullDownRefresh();
	}
});

onPullDownRefresh(async () => {
	try {
		notebooks.value = await listNotebooks();
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

/** 行测模块专属配色 */
const MODULE_COLORS: Array<[string, string]> = [
	["言语", "#3b82f6"],
	["判断", "#8b5cf6"],
	["数量", "#10b981"],
	["资料", "#06b6d4"],
	["常识", "#f97316"],
	["申论", "#f43f5e"],
];

function moduleColor(name: string): string {
	for (const [key, color] of MODULE_COLORS) {
		if (name.includes(key)) return color;
	}
	return "#64748b";
}

function moduleGradient(name: string): string {
	const c = moduleColor(name);
	return `linear-gradient(135deg, ${c} 0%, ${c}b3 100%)`;
}
</script>

<style scoped>
.summary {
	display: flex;
	align-items: center;
	padding: 32rpx 0;
}
.summary-item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.summary-num {
	font-size: 44rpx;
	font-weight: 700;
	color: #1f2937;
}
.summary-num-action {
	color: #f97316;
}
.summary-label {
	font-size: 24rpx;
	color: #9ca3af;
	margin-top: 6rpx;
}
.summary-divider {
	width: 2rpx;
	height: 56rpx;
	background: #f3f4f6;
}

.nb-card {
	display: flex;
	align-items: center;
}
.nb-icon {
	width: 92rpx;
	height: 92rpx;
	border-radius: 24rpx;
	color: #ffffff;
	font-size: 40rpx;
	font-weight: 600;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 26rpx;
	flex-shrink: 0;
	box-shadow: 0 6rpx 14rpx rgba(31, 41, 55, 0.12);
}
.nb-info {
	flex: 1;
	display: flex;
	flex-direction: column;
}
.nb-name {
	font-size: 32rpx;
	font-weight: 600;
}
.nb-count {
	font-size: 24rpx;
	color: #9ca3af;
	margin-top: 8rpx;
}
.nb-arrow {
	font-size: 44rpx;
	color: #d1d5db;
	font-weight: 300;
}
.empty-main {
	display: block;
	font-size: 32rpx;
	color: #6b7280;
	font-weight: 600;
}
.empty-sub {
	display: block;
	font-size: 24rpx;
	color: #c4c9d4;
	margin-top: 12rpx;
}
</style>
