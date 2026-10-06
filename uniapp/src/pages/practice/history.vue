<template>
	<view class="page">
		<view v-if="loading && !records.length" class="card">
			<view v-for="i in 3" :key="'sk' + i" class="skel sk-line" :class="i === 1 ? 'sk-lg' : 'sk-md'" />
		</view>

		<view v-else-if="!records.length && !loading && channelFilter === ''" class="card empty-card">
			<text class="empty-title">还没有练习记录</text>
			<text class="empty-sub">做完一道练习题，这里就会留下痕迹</text>
		</view>

		<template v-else>
			<!-- 待做题库入口：生成的题都保留在这里，等著你做 -->
			<view class="card pool-entry fade-up" hover-class="card-hover" @tap="goPool">
				<view class="pool-entry-left">
					<text class="pool-title">待做题库</text>
					<text class="pool-sub">生成的题都保留在这里，不做也不丢</text>
				</view>
				<view class="pool-entry-right">
					<text class="pool-count num">{{ pendingCount }}</text>
					<text class="pool-count-unit">待做</text>
				</view>
			</view>

			<view class="card total-card fade-up">
				<text class="total-text">共 <text class="num total-num">{{ total }}</text> 次练习</text>
				<text class="total-sub">练过的题都在这里，答错的已自动收进错题本</text>
			</view>

			<!-- 渠道筛选：练习数据按来源分开看 -->
			<view class="filter-row fade-up">
				<view
					v-for="c in channelTabs"
					:key="c.value"
					class="chip"
					:class="{ 'chip-active': channelFilter === c.value }"
					hover-class="hv"
					@tap="switchChannel(c.value)"
				>
					{{ c.label }}
				</view>
			</view>

			<template v-if="!records.length && !loading">
				<view class="card empty-card">
					<text class="empty-title">该渠道还没有练习记录</text>
					<text class="empty-sub">换个渠道看看，或去做几题</text>
				</view>
			</template>

			<view
				v-for="r in records"
				:key="r.id"
				class="card record-card fade-up"
				hover-class="card-hover"
				@tap="openSource(r)"
			>
				<view class="record-top">
					<text class="result-badge" :class="r.isCorrect ? 'badge-good' : 'badge-bad'">
						{{ r.isCorrect ? "答对" : "答错" }}
					</text>
					<text class="record-source">{{ sourceLabel(r) }}</text>
					<text class="record-date num">{{ formatDate(r.createdAt) }}</text>
				</view>
				<text class="record-question">{{ r.questionText || "（无题目快照）" }}</text>
				<view class="record-foot">
					<text class="record-meta">{{ r.subject || "—" }} · {{ difficultyLabel(r.difficulty) }}</text>
					<text class="record-link">看详情 ›</text>
				</view>
			</view>

			<view v-if="loadingMore" class="list-tip">加载中...</view>
			<view v-else-if="records.length >= total" class="list-tip list-end">— 没有更多了 —</view>
		</template>
	</view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onReachBottom, onShow } from "@dcloudio/uni-app";
import {
	listPracticeRecords,
	listPracticeQuestions,
	type PracticeRecordItem,
	type PracticeChannel,
} from "@/api";

const PAGE_SIZE = 20;

const channelTabs = [
	{ value: "", label: "全部" },
	{ value: "free" as const, label: "自由练习" },
	{ value: "similar" as const, label: "举一反三" },
	{ value: "smart" as const, label: "薄弱点专项" },
];

const records = ref<PracticeRecordItem[]>([]);
const total = ref(0);
const pendingCount = ref(0);
const channelFilter = ref<PracticeChannel | "">("");
const page = ref(1);
const loading = ref(true);
const loadingMore = ref(false);

async function load(reset = false) {
	if (reset) {
		page.value = 1;
		loading.value = true;
	}
	try {
		const res = await listPracticeRecords({
			page: page.value,
			pageSize: PAGE_SIZE,
			channel: channelFilter.value || undefined,
		});
		total.value = res.total;
		records.value = reset ? res.records : [...records.value, ...res.records];
	} catch (e: any) {
		uni.showToast({ title: e?.message || "加载练习记录失败", icon: "none" });
	} finally {
		loading.value = false;
		loadingMore.value = false;
	}
}

/** 待做题库入口计数 */
async function loadPending() {
	try {
		const res = await listPracticeQuestions({ status: "pending", pageSize: 1 });
		pendingCount.value = res.pendingCount;
	} catch (e) {
		// 入口计数失败不打断列表
	}
}

function switchChannel(v: PracticeChannel | "") {
	if (channelFilter.value === v) return;
	channelFilter.value = v;
	load(true);
}

function goPool() {
	uni.navigateTo({ url: "/pages/practice/pool" });
}

onReachBottom(() => {
	if (loading.value || loadingMore.value) return;
	if (records.value.length >= total.value) return;
	loadingMore.value = true;
	page.value += 1;
	load();
});

onShow(() => {
	load(true);
	loadPending();
});

/** 渠道标签：优先用后端固化的 channel 字段，异常时兜底按归因推导 */
function sourceLabel(r: PracticeRecordItem): string {
	const c = r.channel || (r.tagId ? "smart" : r.errorItemId ? "similar" : "free");
	if (c === "smart") return r.tag?.name ? `薄弱点专项 · ${r.tag.name}` : "薄弱点专项";
	if (c === "similar") return "举一反三";
	return "自由练习";
}

function difficultyLabel(d?: string): string {
	if (!d) return "中等";
	return ({ easy: "简单", medium: "中等", hard: "困难", harder: "挑战" } as Record<string, string>)[d] || d;
}

function formatDate(iso?: string): string {
	if (!iso) return "";
	const dt = new Date(iso);
	if (Number.isNaN(dt.getTime())) return "";
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${dt.getMonth() + 1}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

/** 点卡片进练习详情（完整题目 + 答案 + 解析） */
function openSource(r: PracticeRecordItem) {
	uni.navigateTo({ url: `/pages/practice/record-detail?id=${r.id}` });
}
</script>

<style scoped>
.pool-entry {
	display: flex;
	align-items: center;
	padding: 28rpx 32rpx;
}
.pool-entry-left {
	display: flex;
	flex-direction: column;
	gap: 6rpx;
	flex: 1;
}
.pool-title {
	font-size: 30rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.pool-sub {
	font-size: 22rpx;
	color: var(--ink-400);
}
.pool-entry-right {
	display: flex;
	align-items: baseline;
	gap: 6rpx;
}
.pool-count {
	font-size: 44rpx;
	font-weight: 700;
	color: var(--brand-600);
}
.pool-count-unit {
	font-size: 22rpx;
	color: var(--ink-400);
}
.total-card {
	display: flex;
	flex-direction: column;
	padding: 32rpx;
}
.total-text {
	font-size: 30rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.total-num {
	color: var(--brand-600);
}
.total-sub {
	font-size: 24rpx;
	color: var(--ink-400);
	margin-top: 8rpx;
}
.filter-row {
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 14rpx;
	margin-bottom: 6rpx;
}
.chip {
	font-size: 24rpx;
	color: var(--ink-600);
	background: var(--bg-card);
	border-radius: 999rpx;
	padding: 10rpx 26rpx;
	border: 2rpx solid var(--line-100);
}
.chip-active {
	color: var(--brand-600);
	background: var(--brand-50);
	border-color: var(--brand-600);
	font-weight: 600;
}

.record-card {
	display: flex;
	flex-direction: column;
	gap: 14rpx;
}
.record-top {
	display: flex;
	align-items: center;
	gap: 14rpx;
}
.result-badge {
	font-size: 22rpx;
	font-weight: 700;
	border-radius: 8rpx;
	padding: 4rpx 14rpx;
}
.badge-good {
	background: var(--success-50);
	color: var(--success-600);
}
.badge-bad {
	background: var(--danger-50);
	color: var(--danger-600);
}
.record-source {
	flex: 1;
	font-size: 24rpx;
	color: var(--brand-600);
	font-weight: 600;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.record-date {
	font-size: 22rpx;
	color: var(--ink-400);
}
.record-question {
	font-size: 28rpx;
	line-height: 1.6;
	color: var(--ink-900);
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 3;
	overflow: hidden;
}
.record-foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.record-meta {
	font-size: 22rpx;
	color: var(--ink-400);
}
.record-link {
	font-size: 22rpx;
	color: var(--brand-600);
}
.list-tip {
	text-align: center;
	font-size: 24rpx;
	color: var(--ink-400);
	padding: 24rpx 0;
}
.list-end {
	padding-bottom: calc(env(safe-area-inset-bottom) + 40rpx);
}
.empty-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 72rpx 40rpx;
}
.empty-title {
	font-size: 30rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.empty-sub {
	font-size: 24rpx;
	color: var(--ink-400);
	margin-top: 12rpx;
}
.skel {
	height: 28rpx;
	border-radius: 8rpx;
	background: var(--bg-fill);
	margin-bottom: 20rpx;
}
.sk-lg {
	width: 96%;
}
.sk-md {
	width: 72%;
}
</style>
