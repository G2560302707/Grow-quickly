<template>
	<view class="page">
		<!-- 搜索 -->
		<view class="search-wrap">
			<view class="search-box">
				<text class="search-icon">🔍</text>
				<input
					v-model="searchText"
					class="search-input"
					placeholder="搜索题目关键词"
					placeholder-class="ph"
					confirm-type="search"
					@confirm="doSearch"
				/>
				<text v-if="searchText" class="search-clear" @tap="clearSearch">✕</text>
			</view>
		</view>

		<view v-if="loading && items.length === 0" class="empty-tip">正在加载错题...</view>
		<view v-else-if="errorMsg" class="error-tip">{{ errorMsg }}</view>
		<view v-else-if="items.length === 0" class="empty-tip">
			<text class="empty-main">{{ searchText ? "没有找到相关错题" : "这本还没有错题" }}</text>
			<text v-if="!searchText" class="empty-sub">去"识别"页添加吧</text>
		</view>
		<view v-else>
			<view
				v-for="(item, idx) in items"
				:key="item.id"
				class="card item-card"
				hover-class="card-hover"
				@tap="openDetail(item)"
			>
				<view class="item-top">
					<text class="item-no">{{ (page - 1) * PAGE_SIZE + idx + 1 }}</text>
					<text class="mastery badge" :class="masteryClass(item.masteryLevel)">
						{{ masteryLabel(item.masteryLevel) }}
					</text>
				</view>
				<text class="item-question">{{ item.questionText || "（无题目文本）" }}</text>
				<view v-if="firstTag(item)" class="item-tags">
					<text class="tag">{{ firstTag(item) }}</text>
				</view>
			</view>
			<view v-if="loadingMore" class="list-tip">加载中...</view>
			<view v-else-if="page >= totalPages" class="list-tip list-end">— 没有更多了 —</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad, onPullDownRefresh, onReachBottom } from "@dcloudio/uni-app";
import { listErrorItems, type ErrorItem } from "@/api";

const PAGE_SIZE = 15;

const subjectId = ref("");
const items = ref<ErrorItem[]>([]);
const page = ref(1);
const totalPages = ref(1);
const loading = ref(true);
const loadingMore = ref(false);
const errorMsg = ref("");
const searchText = ref("");
const activeQuery = ref("");

onLoad((query) => {
	subjectId.value = (query?.subjectId as string) || "";
	if (query?.name) {
		uni.setNavigationBarTitle({ title: decodeURIComponent(query.name as string) });
	}
	loadFirstPage();
});

async function fetchPage(targetPage: number, append: boolean) {
	const res = await listErrorItems({
		subjectId: subjectId.value,
		query: activeQuery.value || undefined,
		page: targetPage,
		pageSize: PAGE_SIZE,
	});
	items.value = append ? [...items.value, ...res.items] : res.items;
	page.value = targetPage;
	totalPages.value = res.totalPages;
}

async function loadFirstPage() {
	loading.value = true;
	errorMsg.value = "";
	try {
		await fetchPage(1, false);
	} catch (e: any) {
		errorMsg.value = e?.message || "加载失败";
	} finally {
		loading.value = false;
		uni.stopPullDownRefresh();
	}
}

function doSearch() {
	activeQuery.value = searchText.value.trim();
	loadFirstPage();
}

function clearSearch() {
	if (!searchText.value && !activeQuery.value) return;
	searchText.value = "";
	activeQuery.value = "";
	loadFirstPage();
}

onPullDownRefresh(() => {
	loadFirstPage();
});

onReachBottom(async () => {
	if (loadingMore.value || page.value >= totalPages.value) return;
	loadingMore.value = true;
	try {
		await fetchPage(page.value + 1, true);
	} catch (e: any) {
		uni.showToast({ title: e?.message || "加载更多失败", icon: "none" });
	} finally {
		loadingMore.value = false;
	}
});

function openDetail(item: ErrorItem) {
	uni.navigateTo({ url: `/pages/detail/detail?id=${item.id}` });
}

function firstTag(item: ErrorItem): string {
	const tags = item.tags || [];
	if (tags.length > 0) return tags[0].name;
	try {
		const points = JSON.parse(item.knowledgePoints || "[]");
		return Array.isArray(points) && points.length > 0 ? points[0] : "";
	} catch {
		return "";
	}
}

function masteryLabel(level: number): string {
	if (level >= 2) return "已掌握";
	if (level === 1) return "复习中";
	return "未掌握";
}

function masteryClass(level: number): string {
	if (level >= 2) return "badge-done";
	if (level === 1) return "badge-doing";
	return "badge-new";
}
</script>

<style scoped>
.search-wrap {
	padding: 20rpx 24rpx 4rpx;
}
.search-box {
	background: #ffffff;
	border-radius: 999rpx;
	padding: 18rpx 28rpx;
	display: flex;
	align-items: center;
	box-shadow: 0 2rpx 10rpx rgba(31, 41, 55, 0.04);
}
.search-icon {
	font-size: 28rpx;
	margin-right: 14rpx;
}
.search-input {
	flex: 1;
	font-size: 28rpx;
}
.ph {
	color: #c4c9d4;
}
.search-clear {
	color: #c4c9d4;
	font-size: 26rpx;
	padding: 0 8rpx;
}

.item-card {
	display: flex;
	flex-direction: column;
}
.item-top {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 14rpx;
}
.item-no {
	font-size: 24rpx;
	color: #c4c9d4;
	font-weight: 600;
}
.item-question {
	font-size: 30rpx;
	line-height: 1.55;
	color: #1f2937;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	overflow: hidden;
}
.item-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-top: 18rpx;
}
.list-tip {
	text-align: center;
	color: #c4c9d4;
	font-size: 24rpx;
	padding: 30rpx 0;
}
.list-end {
	color: #e0e3ea;
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
