<template>
	<view class="page">
		<!-- 搜索与筛选 -->
		<view class="toolbar">
			<view class="search-box">
				<view class="search-icon">
					<view class="search-circle" />
					<view class="search-handle" />
				</view>
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
			<view class="filter-row">
				<view
					v-for="f in masteryFilters"
					:key="f.value"
					class="chip"
					:class="{ 'chip-active': masteryFilter === f.value }"
					hover-class="hv"
					@tap="switchFilter(f.value)"
				>
					{{ f.label }}
				</view>
				<text class="filter-count num">共 {{ total }} 题</text>
			</view>
		</view>

		<template v-if="loading && items.length === 0">
			<view v-for="i in 4" :key="'sk' + i" class="card item-card">
				<view class="skel sk-line sk-line-badge" />
				<view class="skel sk-line sk-line-title" />
				<view class="skel sk-line sk-line-sub" />
			</view>
		</template>
		<view v-else-if="errorMsg" class="error-tip">{{ errorMsg }}</view>
		<view v-else-if="items.length === 0" class="empty-tip">
			<view class="empty-badge">🔍</view>
			<text class="empty-main">{{ activeQuery || masteryFilter !== "" ? "没有找到相关错题" : "这本还没有错题" }}</text>
			<text v-if="!activeQuery && masteryFilter === ''" class="empty-sub">去"识别"页添加吧</text>
		</view>
		<view v-else>
			<view
				v-for="(item, idx) in items"
				:key="item.id"
				class="card item-card fade-up"
				hover-class="card-hover"
				@tap="openDetail(item)"
			>
				<view class="item-top">
					<text class="item-no num">{{ String((page - 1) * PAGE_SIZE + idx + 1).padStart(2, "0") }}</text>
					<text class="mastery badge" :class="masteryClass(item.masteryLevel)">
						{{ masteryLabel(item.masteryLevel) }}
					</text>
				</view>
				<text class="item-question">{{ item.questionText || "（无题目文本）" }}</text>
				<view class="item-foot">
					<view class="item-tags">
						<text v-if="firstTag(item)" class="tag">{{ firstTag(item) }}</text>
					</view>
					<text v-if="formatDate(item.createdAt)" class="item-date num">{{ formatDate(item.createdAt) }}</text>
				</view>
			</view>
			<view v-if="loadingMore" class="list-tip">加载中...</view>
			<view v-else-if="page >= totalPages" class="list-tip list-end">— 没有更多了 —</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from "@dcloudio/uni-app";
import { listErrorItems, type ErrorItem } from "@/api";

const PAGE_SIZE = 15;

const masteryFilters = [
	{ value: "", label: "全部" },
	{ value: "0", label: "未掌握" },
	{ value: "1", label: "已掌握" },
] as const;

const subjectId = ref("");
const items = ref<ErrorItem[]>([]);
const page = ref(1);
const totalPages = ref(1);
const total = ref(0);
const loading = ref(true);
const loadingMore = ref(false);
const refreshing = ref(false);
const errorMsg = ref("");
const searchText = ref("");
const activeQuery = ref("");
const masteryFilter = ref<"" | "0" | "1">("");

onLoad((query) => {
	subjectId.value = (query?.subjectId as string) || "";
	if (query?.name) {
		uni.setNavigationBarTitle({ title: decodeURIComponent(query.name as string) });
	}
	loadFirstPage();
});

// 从详情页返回时静默刷新：onLoad 只在首次进入触发，掌握度等状态变更靠这里同步
let firstShow = true;
onShow(() => {
	if (firstShow) {
		firstShow = false;
		return;
	}
	refreshLoadedPages();
});

/**
 * 无感刷新已加载的所有页（原地替换，保持滚动位置）
 * 静默失败：不打断浏览，下拉刷新或再次进入时总会重新同步
 */
async function refreshLoadedPages() {
	if (refreshing.value || loading.value || loadingMore.value) return;
	const targetPage = page.value;
	const targetFilter = masteryFilter.value;
	refreshing.value = true;
	try {
		const results = await Promise.all(
			Array.from({ length: targetPage }, (_, i) =>
				listErrorItems({
					subjectId: subjectId.value,
					query: activeQuery.value || undefined,
					mastery: (targetFilter || undefined) as "0" | "1" | undefined,
					page: i + 1,
					pageSize: PAGE_SIZE,
				})
			)
		);
		// 请求期间页码或筛选变了则丢弃结果，避免覆盖新状态
		if (targetPage !== page.value || targetFilter !== masteryFilter.value) return;
		items.value = results.flatMap(r => (Array.isArray(r?.items) ? r.items : []));
		totalPages.value = results[0]?.totalPages ?? 1;
		total.value = results[0]?.total ?? items.value.length;
	} catch {
		// 静默失败
	} finally {
		refreshing.value = false;
	}
}

async function fetchPage(targetPage: number, append: boolean) {
	const res = await listErrorItems({
		subjectId: subjectId.value,
		query: activeQuery.value || undefined,
		mastery: (masteryFilter.value || undefined) as "0" | "1" | undefined,
		page: targetPage,
		pageSize: PAGE_SIZE,
	});
	const list = Array.isArray(res?.items) ? res.items : [];
	items.value = append ? [...items.value, ...list] : list;
	page.value = targetPage;
	totalPages.value = res?.totalPages ?? 1;
	total.value = res?.total ?? list.length;
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

function switchFilter(value: "" | "0" | "1") {
	if (masteryFilter.value === value) return;
	masteryFilter.value = value;
	loadFirstPage();
}

onPullDownRefresh(() => {
	loadFirstPage();
});

onReachBottom(async () => {
	if (loadingMore.value || refreshing.value || page.value >= totalPages.value) return;
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

function formatDate(iso?: string): string {
	if (!iso) return "";
	const d = new Date(iso);
	if (isNaN(d.getTime())) return "";
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${m}-${day}`;
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
/* ---------- 工具栏 ---------- */
.toolbar {
	background: var(--bg-card);
	padding: 20rpx 24rpx 20rpx;
	border-bottom: 1rpx solid var(--line-50);
}
.search-box {
	background: var(--bg-fill);
	border-radius: 16rpx;
	padding: 20rpx 28rpx;
	display: flex;
	align-items: center;
}
.search-icon {
	position: relative;
	width: 32rpx;
	height: 32rpx;
	margin-right: 16rpx;
	flex-shrink: 0;
}
.search-circle {
	width: 22rpx;
	height: 22rpx;
	border: 3rpx solid var(--ink-400);
	border-radius: 50%;
}
.search-handle {
	position: absolute;
	width: 3rpx;
	height: 14rpx;
	background: var(--ink-400);
	border-radius: 2rpx;
	bottom: 2rpx;
	right: 2rpx;
	transform: rotate(-45deg);
}
.search-input {
	flex: 1;
	font-size: 28rpx;
	color: var(--ink-900);
}
.search-clear {
	color: var(--ink-300);
	font-size: 26rpx;
	padding: 0 8rpx;
}
.filter-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
	margin-top: 20rpx;
}
.filter-count {
	margin-left: auto;
	font-size: 22rpx;
	color: var(--ink-400);
}
.hv {
	opacity: 0.85;
}

/* ---------- 骨架 ---------- */
.sk-line {
	height: 28rpx;
	border-radius: 8rpx;
}
.sk-line-badge {
	width: 120rpx;
	height: 32rpx;
	border-radius: 999rpx;
}
.sk-line-title {
	width: 92%;
	margin-top: 24rpx;
}
.sk-line-sub {
	width: 55%;
	margin-top: 16rpx;
}

/* ---------- 错题卡片 ---------- */
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
	color: var(--ink-300);
	font-weight: 700;
	letter-spacing: 1rpx;
}
.item-question {
	font-size: 30rpx;
	line-height: 1.6;
	color: var(--ink-900);
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	overflow: hidden;
}
.item-foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 20rpx;
}
.item-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}
.item-date {
	font-size: 22rpx;
	color: var(--ink-300);
}
.list-tip {
	text-align: center;
	color: var(--ink-300);
	font-size: 24rpx;
	padding: 30rpx 0;
}
.list-end {
	color: var(--ink-300);
	opacity: 0.7;
}

/* ---------- 空态 ---------- */
.empty-badge {
	width: 112rpx;
	height: 112rpx;
	margin: 0 auto 28rpx;
	border-radius: 32rpx;
	background: var(--brand-50);
	border: 1rpx solid var(--brand-100);
	font-size: 48rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
</style>
