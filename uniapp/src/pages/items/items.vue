<template>
	<view class="page">
		<!-- 搜索与筛选 -->
		<view class="toolbar">
			<view class="search-row">
				<view class="search-box">
					<view class="search-icon">
						<view class="search-circle" />
						<view class="search-handle" />
					</view>
					<input
						v-model="searchText"
						class="search-input"
						placeholder="搜题干 / 考点 / 解析"
						placeholder-class="ph"
						confirm-type="search"
						@input="onSearchInput"
						@confirm="doSearch"
					/>
					<text v-if="searchText" class="search-clear" @tap="clearSearch">✕</text>
				</view>
				<view class="search-btn" hover-class="hv" @tap="doSearch">搜索</view>
			</view>
			<view class="meta-row">
				<text class="filter-count num">共 {{ total }} 题</text>
				<text v-if="activeQuery" class="active-query">关键词「{{ activeQuery }}」</text>
			</view>

			<view class="filter-block">
				<text class="filter-label">掌握</text>
				<view class="chip-row">
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
				</view>
			</view>
			<view class="filter-block">
				<text class="filter-label">来源</text>
				<view class="chip-row">
					<view
						v-for="s in sourceFilters"
						:key="s.value"
						class="chip"
						:class="{ 'chip-active': sourceTypeFilter === s.value }"
						hover-class="hv"
						@tap="switchSource(s.value)"
					>
						{{ s.label }}
					</view>
				</view>
			</view>

			<view v-if="needsTagImport" class="filter-block tag-import-row">
				<text class="tag-import-text">尚未导入考点树</text>
				<text class="alt-link" @tap="goTagsManage">去导入 →</text>
			</view>
			<view v-else class="filter-block">
				<text class="filter-label">考点</text>
				<view class="tag-filter-row">
					<picker
						mode="multiSelector"
						:range="cascadeRange"
						:value="cascadeIndex"
						@columnchange="onCascadeColumn"
						@change="onCascadeChange"
					>
						<view class="picker-chip picker-chip-wide" :class="{ active: !!tagIdFilter }">
							{{ cascadeLabel }}
						</view>
					</picker>
					<text v-if="tagIdFilter" class="tag-clear" @tap="clearTagFilter">清除</text>
				</view>
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
			<text class="empty-main">{{ hasActiveFilters ? "没有找到相关错题" : "这本还没有错题" }}</text>
			<text v-if="!hasActiveFilters" class="empty-sub">去"识别"页添加吧</text>
			<text v-else class="empty-sub">试试清除考点筛选或换个关键词</text>
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
				<MdRich :content="item.questionText" />
				<view class="item-foot">
					<view class="item-tags">
						<text v-if="item.origin" class="tag tag-origin">{{ originLabel(item.origin) }}</text>
						<text v-for="name in itemTagNames(item)" :key="name" class="tag">{{ name }}</text>
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
import { ref, computed } from "vue";
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from "@dcloudio/uni-app";
import { listErrorItems, getUserTagTree, type ErrorItem, type TagTreeNode } from "@/api";
import MdRich from "@/components/MdRich.vue";
import { originLabel } from "@/utils/origin";

const PAGE_SIZE = 15;

const masteryFilters = [
	{ value: "", label: "全部" },
	{ value: "0", label: "未掌握" },
	{ value: "1", label: "已掌握" }, // API: mastery=1 → level > 0（含复习中）
] as const;

const sourceFilters = [
	{ value: "", label: "全部" },
	{ value: "manual", label: "录入" },
	{ value: "practice", label: "练习" },
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
const sourceTypeFilter = ref<"" | "manual" | "practice">("");
const tagTree = ref<TagTreeNode[]>([]);
const needsTagImport = ref(false);
const moduleId = ref("");
const pointId = ref("");
const leafId = ref("");
const tagIdFilter = ref("");

const moduleOptions = computed(() => tagTree.value);
const pointOptions = computed(() => {
	const m = moduleOptions.value.find((x) => x.id === moduleId.value);
	return m?.children || [];
});
const leafOptions = computed(() => {
	const p = pointOptions.value.find((x) => x.id === pointId.value);
	return p?.children || [];
});

/** 多列联动：列滚动时用临时 index，确认后再写入 module/point/leaf */
const cascadeIndex = ref([0, 0, 0]);
const cascadeRange = computed(() => {
	const mods = ["不限模块", ...moduleOptions.value.map((m) => m.name)];
	const mi = cascadeIndex.value[0] || 0;
	const points =
		mi <= 0
			? ["先选模块"]
			: ["不限一级", ...(moduleOptions.value[mi - 1]?.children || []).map((p) => p.name)];
	const pi = cascadeIndex.value[1] || 0;
	const leaves =
		mi <= 0 || pi <= 0
			? ["先选一级"]
			: [
					"不限二级",
					...((moduleOptions.value[mi - 1]?.children || [])[pi - 1]?.children || []).map(
						(l) => l.name,
					),
				];
	return [mods, points, leaves];
});
const cascadeLabel = computed(() => {
	if (!tagIdFilter.value) return "全部考点 · 点此筛选";
	const parts: string[] = [];
	const m = moduleOptions.value.find((x) => x.id === moduleId.value);
	if (m) parts.push(m.name);
	const p = pointOptions.value.find((x) => x.id === pointId.value);
	if (p) parts.push(p.name);
	const l = leafOptions.value.find((x) => x.id === leafId.value);
	if (l) parts.push(l.name);
	return parts.join(" › ") || "全部考点 · 点此筛选";
});

function syncTagIdFilter() {
	tagIdFilter.value = leafId.value || pointId.value || moduleId.value || "";
}

function syncCascadeIndexFromIds() {
	const mi = moduleId.value
		? moduleOptions.value.findIndex((m) => m.id === moduleId.value) + 1
		: 0;
	const points = mi > 0 ? moduleOptions.value[mi - 1]?.children || [] : [];
	const pi = pointId.value ? points.findIndex((p) => p.id === pointId.value) + 1 : 0;
	const leaves = pi > 0 ? points[pi - 1]?.children || [] : [];
	const li = leafId.value ? leaves.findIndex((l) => l.id === leafId.value) + 1 : 0;
	cascadeIndex.value = [Math.max(0, mi), Math.max(0, pi), Math.max(0, li)];
}

function onCascadeColumn(e: any) {
	const col = Number(e.detail.column);
	const row = Number(e.detail.value);
	const next = [...cascadeIndex.value] as number[];
	next[col] = row;
	if (col === 0) {
		next[1] = 0;
		next[2] = 0;
	} else if (col === 1) {
		next[2] = 0;
	}
	cascadeIndex.value = next;
}

function onCascadeChange(e: any) {
	const [mi, pi, li] = (e.detail.value || [0, 0, 0]).map(Number);
	cascadeIndex.value = [mi, pi, li];
	moduleId.value = mi <= 0 ? "" : moduleOptions.value[mi - 1]?.id || "";
	const points = moduleId.value
		? moduleOptions.value.find((m) => m.id === moduleId.value)?.children || []
		: [];
	pointId.value = pi <= 0 || !moduleId.value ? "" : points[pi - 1]?.id || "";
	const leaves = pointId.value ? points.find((p) => p.id === pointId.value)?.children || [] : [];
	leafId.value = li <= 0 || !pointId.value ? "" : leaves[li - 1]?.id || "";
	syncTagIdFilter();
	loadFirstPage();
}

function clearTagFilter() {
	moduleId.value = "";
	pointId.value = "";
	leafId.value = "";
	tagIdFilter.value = "";
	cascadeIndex.value = [0, 0, 0];
	loadFirstPage();
}

function goTagsManage() {
	uni.navigateTo({ url: "/pages/tags/tags" });
}

async function loadTagTree() {
	try {
		const data = await getUserTagTree();
		tagTree.value = data.tags || [];
		needsTagImport.value = !!data.needsImport || tagTree.value.length === 0;
		syncCascadeIndexFromIds();
	} catch {
		tagTree.value = [];
		needsTagImport.value = true;
	}
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;

const hasActiveFilters = computed(
	() =>
		!!activeQuery.value ||
		masteryFilter.value !== "" ||
		sourceTypeFilter.value !== "" ||
		!!tagIdFilter.value,
);

onLoad(async (query) => {
	subjectId.value = (query?.subjectId as string) || "";
	if (query?.name) {
		uni.setNavigationBarTitle({ title: decodeURIComponent(query.name as string) });
	}
	await loadTagTree();
	// 不按本子名自动套考点筛选，避免标签 id 不一致时误显示空本
	loadFirstPage();
});

// 从详情页返回时静默刷新：onLoad 只在首次进入触发，掌握度等状态变更靠这里同步
let firstShow = true;
onShow(() => {
	loadTagTree();
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
	const targetSource = sourceTypeFilter.value;
	const targetTag = tagIdFilter.value;
	refreshing.value = true;
	try {
		const results = await Promise.all(
			Array.from({ length: targetPage }, (_, i) =>
				listErrorItems({
					subjectId: subjectId.value,
					query: activeQuery.value || undefined,
					mastery: (targetFilter || undefined) as "0" | "1" | undefined,
					sourceType: (targetSource || undefined) as "manual" | "practice" | undefined,
					tagId: targetTag || undefined,
					page: i + 1,
					pageSize: PAGE_SIZE,
				})
			)
		);
		// 请求期间页码或筛选变了则丢弃结果，避免覆盖新状态
		if (
			targetPage !== page.value ||
			targetFilter !== masteryFilter.value ||
			targetSource !== sourceTypeFilter.value ||
			targetTag !== tagIdFilter.value
		) {
			return;
		}
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
		sourceType: (sourceTypeFilter.value || undefined) as "manual" | "practice" | undefined,
		tagId: tagIdFilter.value || undefined,
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
	if (searchTimer) {
		clearTimeout(searchTimer);
		searchTimer = null;
	}
	const next = searchText.value.trim();
	if (next === activeQuery.value) {
		if (!next) uni.showToast({ title: "输入关键词后点搜索", icon: "none" });
		return;
	}
	activeQuery.value = next;
	loadFirstPage();
}

function onSearchInput() {
	if (searchTimer) clearTimeout(searchTimer);
	// 清空时立刻恢复；有内容则短防抖自动搜，无需只靠键盘「搜索」键
	searchTimer = setTimeout(() => {
		const next = searchText.value.trim();
		if (next === activeQuery.value) return;
		activeQuery.value = next;
		loadFirstPage();
	}, nextEmptyDelay(searchText.value));
}

function nextEmptyDelay(text: string) {
	return text.trim() ? 450 : 0;
}

function clearSearch() {
	if (searchTimer) {
		clearTimeout(searchTimer);
		searchTimer = null;
	}
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

function switchSource(value: "" | "manual" | "practice") {
	if (sourceTypeFilter.value === value) return;
	sourceTypeFilter.value = value;
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

/** 与详情页 allTags 一致：优先关联标签，否则回退 knowledgePoints */
function itemTagNames(item: ErrorItem): string[] {
	const fromRelation = (item.tags || []).map((t) => t.name).filter(Boolean);
	if (fromRelation.length > 0) return fromRelation;
	try {
		const points = JSON.parse(item.knowledgePoints || "[]");
		return Array.isArray(points) ? points.filter((p) => typeof p === "string" && p) : [];
	} catch {
		return [];
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
	padding: 20rpx 24rpx 24rpx;
	border-bottom: 1rpx solid var(--line-50);
}
.search-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
}
.search-box {
	flex: 1;
	min-width: 0;
	background: var(--bg-fill);
	border-radius: 16rpx;
	padding: 16rpx 24rpx;
	display: flex;
	align-items: center;
}
.search-btn {
	flex-shrink: 0;
	padding: 16rpx 28rpx;
	border-radius: 16rpx;
	background: var(--brand-600);
	color: #fff;
	font-size: 26rpx;
	font-weight: 600;
}
.meta-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
	margin-top: 16rpx;
	min-height: 32rpx;
}
.active-query {
	font-size: 22rpx;
	color: var(--brand-600);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.filter-block {
	display: flex;
	align-items: flex-start;
	gap: 16rpx;
	margin-top: 18rpx;
}
.filter-label {
	flex-shrink: 0;
	width: 56rpx;
	padding-top: 12rpx;
	font-size: 22rpx;
	color: var(--ink-400);
}
.chip-row {
	flex: 1;
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
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
.filter-count {
	font-size: 22rpx;
	color: var(--ink-400);
}
.tag-filter-row {
	flex: 1;
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 12rpx;
}
.picker-chip {
	font-size: 24rpx;
	color: var(--ink-700);
	background: var(--bg-fill);
	border: 1rpx solid var(--line-100);
	padding: 10rpx 20rpx;
	border-radius: 999rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.picker-chip-wide {
	max-width: 520rpx;
}
.picker-chip.active {
	color: var(--brand-600);
	background: var(--brand-50);
	border-color: var(--brand-100);
}
.tag-clear {
	font-size: 24rpx;
	color: var(--brand-600);
	padding: 8rpx 4rpx;
}
.tag-import-row {
	justify-content: flex-start;
}
.tag-import-text {
	font-size: 24rpx;
	color: var(--ink-400);
}
.alt-link {
	font-size: 24rpx;
	color: var(--brand-600);
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
	align-items: flex-start;
	justify-content: space-between;
	gap: 16rpx;
	margin-top: 20rpx;
}
.item-tags {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}
.tag-origin {
	background: var(--brand-50);
	color: var(--brand-600);
}
.item-date {
	flex-shrink: 0;
	padding-top: 4rpx;
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
