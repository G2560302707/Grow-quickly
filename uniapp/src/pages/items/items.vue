<template>
	<view class="page">
		<view v-if="loading && items.length === 0" class="empty-tip">加载中...</view>
		<view v-else-if="errorMsg" class="error-tip">{{ errorMsg }}</view>
		<view v-else-if="items.length === 0" class="empty-tip">这本还没有错题，去"识别"页添加吧</view>
		<view v-else>
			<view
				v-for="item in items"
				:key="item.id"
				class="card item-card"
				@tap="openDetail(item)"
			>
				<text class="item-question">{{ item.questionText || "（无题目文本）" }}</text>
				<view class="item-footer">
					<view class="tag-row">
						<text v-if="firstTag(item)" class="tag">{{ firstTag(item) }}</text>
					</view>
					<text class="mastery" :class="masteryClass(item.masteryLevel)">
						{{ masteryLabel(item.masteryLevel) }}
					</text>
				</view>
			</view>
			<view v-if="loadingMore" class="empty-tip">加载中...</view>
			<view v-else-if="page >= totalPages" class="list-end">— 没有更多了 —</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad, onPullDownRefresh, onReachBottom } from "@dcloudio/uni-app";
import { listErrorItems, type ErrorItem } from "@/api";

const subjectId = ref("");
const items = ref<ErrorItem[]>([]);
const page = ref(1);
const totalPages = ref(1);
const loading = ref(true);
const loadingMore = ref(false);
const errorMsg = ref("");

onLoad((query) => {
	subjectId.value = (query?.subjectId as string) || "";
	if (query?.name) {
		uni.setNavigationBarTitle({ title: decodeURIComponent(query.name as string) });
	}
	loadFirstPage();
});

async function loadFirstPage() {
	loading.value = true;
	errorMsg.value = "";
	try {
		const res = await listErrorItems({ subjectId: subjectId.value, page: 1, pageSize: 15 });
		items.value = res.items;
		totalPages.value = res.totalPages;
		page.value = 1;
	} catch (e: any) {
		errorMsg.value = e?.message || "加载失败";
	} finally {
		loading.value = false;
		uni.stopPullDownRefresh();
	}
}

onPullDownRefresh(() => {
	loadFirstPage();
});

onReachBottom(async () => {
	if (loadingMore.value || page.value >= totalPages.value) return;
	loadingMore.value = true;
	try {
		const next = page.value + 1;
		const res = await listErrorItems({ subjectId: subjectId.value, page: next, pageSize: 15 });
		items.value = [...items.value, ...res.items];
		page.value = next;
		totalPages.value = res.totalPages;
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
	if (level >= 2) return "mastery-done";
	if (level === 1) return "mastery-doing";
	return "mastery-new";
}
</script>

<style scoped>
.item-card {
	display: flex;
	flex-direction: column;
}
.item-question {
	font-size: 30rpx;
	line-height: 1.5;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	overflow: hidden;
}
.item-footer {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: 20rpx;
}
.tag-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}
.tag {
	background: #fff7ed;
	color: #ea580c;
	font-size: 22rpx;
	padding: 4rpx 16rpx;
	border-radius: 999rpx;
}
.mastery {
	font-size: 22rpx;
	padding: 4rpx 16rpx;
	border-radius: 999rpx;
}
.mastery-new {
	background: #fef2f2;
	color: #ef4444;
}
.mastery-doing {
	background: #fffbeb;
	color: #d97706;
}
.mastery-done {
	background: #f0fdf4;
	color: #16a34a;
}
.list-end {
	text-align: center;
	color: #d1d5db;
	font-size: 24rpx;
	padding: 30rpx 0;
}
</style>
