<template>
	<view class="page">
		<!-- 状态筛选：待做 / 已做 / 已弃 -->
		<view class="toolbar">
			<view class="filter-row">
				<view
					v-for="s in statusTabs"
					:key="s.value"
					class="chip"
					:class="{ 'chip-active': statusFilter === s.value }"
					hover-class="hv"
					@tap="switchStatus(s.value)"
				>
					{{ s.label }}
				</view>
				<text class="filter-count num">待做 {{ pendingCount }}</text>
			</view>
			<!-- 渠道筛选 -->
			<view class="filter-row">
				<view
					v-for="c in channelTabs"
					:key="c.value"
					class="chip chip-sm"
					:class="{ 'chip-active': channelFilter === c.value }"
					hover-class="hv"
					@tap="switchChannel(c.value)"
				>
					{{ c.label }}
				</view>
			</view>
		</view>

		<template v-if="loading && questions.length === 0">
			<view v-for="i in 3" :key="'sk' + i" class="card">
				<view class="skel sk-line sk-lg" />
				<view class="skel sk-line sk-md" />
			</view>
		</template>
		<view v-else-if="errorMsg" class="error-tip">{{ errorMsg }}</view>
		<view v-else-if="questions.length === 0" class="card empty-card">
			<text class="empty-title">{{ emptyTitle }}</text>
			<text class="empty-sub">{{ emptySub }}</text>
		</view>
		<template v-else>
			<view
				v-for="q in questions"
				:key="q.id"
				class="card question-card fade-up"
				hover-class="card-hover"
				@tap="openQuestion(q)"
			>
				<view class="question-top">
					<text class="channel-badge" :class="channelClass(q.channel)">{{ channelLabel(q.channel) }}</text>
					<text class="question-diff">{{ difficultyLabel(q.difficulty) }}</text>
					<text v-if="q.status === 'answered'" class="result-badge" :class="q.isCorrect ? 'badge-good' : 'badge-bad'">
						{{ q.isCorrect ? "答对" : "答错" }}
					</text>
					<text class="question-date num">{{ formatDate(q.createdAt) }}</text>
				</view>
				<text class="question-text">{{ q.questionText || "（无题目内容）" }}</text>
				<view v-if="q.tag || q.errorItem" class="question-meta">
					<text v-if="q.tag" class="meta-tag">{{ q.tag.name }}</text>
					<text v-if="q.errorItem" class="meta-anchor">锚定原错题</text>
				</view>
				<view class="question-foot">
					<text class="foot-hint">{{ footHint(q) }}</text>
					<view class="foot-actions">
						<view
							v-if="q.status === 'pending'"
							class="action-btn action-secondary"
							hover-class="hv"
							@tap.stop="discardQuestion(q)"
						>
							<text class="action-text action-secondary-text">不做这道</text>
						</view>
						<view
							v-else-if="q.status === 'discarded'"
							class="action-btn action-secondary"
							hover-class="hv"
							@tap.stop="restoreQuestion(q)"
						>
							<text class="action-text action-secondary-text">恢复待做</text>
						</view>
						<view v-if="q.status === 'pending'" class="action-btn action-primary" hover-class="hv" @tap.stop="openQuestion(q)">
							<text class="action-text action-primary-text">去做</text>
						</view>
					</view>
				</view>
			</view>

			<view v-if="loadingMore" class="list-tip">加载中...</view>
			<view v-else-if="questions.length >= total" class="list-tip list-end">— 没有更多了 —</view>
		</template>
	</view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onPullDownRefresh, onReachBottom, onShow } from "@dcloudio/uni-app";
import {
	listPracticeQuestions,
	patchPracticeQuestion,
	type PracticeQuestionItem,
	type PracticeChannel,
	type PracticeQuestionStatus,
} from "@/api";

const PAGE_SIZE = 20;

const statusTabs = [
	{ value: "pending" as const, label: "待做" },
	{ value: "answered" as const, label: "已做" },
	{ value: "discarded" as const, label: "已弃" },
];
const channelTabs = [
	{ value: "", label: "全部" },
	{ value: "free" as const, label: "自由练习" },
	{ value: "similar" as const, label: "举一反三" },
	{ value: "smart" as const, label: "薄弱点专项" },
];

const statusFilter = ref<PracticeQuestionStatus>("pending");
const channelFilter = ref<PracticeChannel | "">("");
const questions = ref<PracticeQuestionItem[]>([]);
const pendingCount = ref(0);
const total = ref(0);
const page = ref(1);
const loading = ref(true);
const loadingMore = ref(false);
const errorMsg = ref("");

const emptyTitle = ref("");
const emptySub = ref("");

function buildEmpty() {
	if (statusFilter.value === "pending") {
		emptyTitle.value = "没有待做的题";
		emptySub.value = "生成的练习题都会留在这里，随时回来做";
	} else if (statusFilter.value === "answered") {
		emptyTitle.value = "还没有做过的题";
		emptySub.value = "做完的题会归档到这里";
	} else {
		emptyTitle.value = "没有弃题";
		emptySub.value = "「不做这道」的题会暂存在这里，可随时恢复";
	}
}

async function load(reset = false) {
	if (reset) {
		page.value = 1;
		loading.value = true;
		questions.value = [];
	}
	try {
		const res = await listPracticeQuestions({
			status: statusFilter.value,
			channel: channelFilter.value || undefined,
			page: page.value,
			pageSize: PAGE_SIZE,
		});
		pendingCount.value = res.pendingCount;
		total.value = res.total;
		questions.value = reset ? res.questions : [...questions.value, ...res.questions];
		errorMsg.value = "";
	} catch (e: any) {
		errorMsg.value = e?.message || "加载题库失败";
	} finally {
		loading.value = false;
		loadingMore.value = false;
	}
}

function switchStatus(v: PracticeQuestionStatus) {
	if (statusFilter.value === v) return;
	statusFilter.value = v;
	buildEmpty();
	load(true);
}

function switchChannel(v: PracticeChannel | "") {
	if (channelFilter.value === v) return;
	channelFilter.value = v;
	load(true);
}

onShow(() => {
	buildEmpty();
	load(true);
});

onPullDownRefresh(async () => {
	await load(true);
	uni.stopPullDownRefresh();
});

onReachBottom(() => {
	if (loading.value || loadingMore.value) return;
	if (questions.value.length >= total.value) return;
	loadingMore.value = true;
	page.value += 1;
	load();
});

/** 去做：进入答题（带 questionId 直接作答这道题） */
function openQuestion(q: PracticeQuestionItem) {
	if (q.status !== "pending") return;
	const params = [`questionId=${q.id}`];
	if (q.tagId) {
		params.push(`tagId=${q.tagId}`);
		if (q.tag?.name) params.push(`tagName=${encodeURIComponent(q.tag.name)}`);
		params.push("subject=" + encodeURIComponent(q.tag?.name || "其他"));
	} else if (q.subject) {
		params.push("subject=" + encodeURIComponent(q.subject));
	}
	uni.navigateTo({ url: `/pages/practice/practice?${params.join("&")}` });
}

async function discardQuestion(q: PracticeQuestionItem) {
	try {
		await patchPracticeQuestion(q.id, "discard");
		q.status = "discarded";
		pendingCount.value = Math.max(0, pendingCount.value - 1);
		uni.showToast({ title: "已移入已弃，可随时恢复", icon: "none" });
	} catch (e: any) {
		uni.showToast({ title: e?.message || "操作失败", icon: "none" });
	}
}

async function restoreQuestion(q: PracticeQuestionItem) {
	try {
		await patchPracticeQuestion(q.id, "restore");
		q.status = "pending";
		pendingCount.value += 1;
		uni.showToast({ title: "已恢复为待做", icon: "none" });
	} catch (e: any) {
		uni.showToast({ title: e?.message || "操作失败", icon: "none" });
	}
}

function channelLabel(c: string): string {
	return ({ free: "自由练习", similar: "举一反三", smart: "薄弱点专项" } as Record<string, string>)[c] || c;
}
function channelClass(c: string): string {
	return ({ free: "channel-free", similar: "channel-similar", smart: "channel-smart" } as Record<string, string>)[c] || "";
}
function difficultyLabel(d?: string): string {
	if (!d) return "中等";
	return ({ easy: "简单", medium: "中等", hard: "困难", harder: "挑战" } as Record<string, string>)[d] || d;
}
function footHint(q: PracticeQuestionItem): string {
	if (q.status === "pending") return "点击卡片或「去做」开始答题";
	if (q.status === "answered") return `已完成 · ${formatDate(q.answeredAt || "")}`;
	return "已弃置，不会出现在取题队列";
}
function formatDate(iso?: string): string {
	if (!iso) return "";
	const dt = new Date(iso);
	if (Number.isNaN(dt.getTime())) return "";
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${dt.getMonth() + 1}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
</script>

<style scoped>
.toolbar {
	padding: 20rpx 24rpx 4rpx;
}
.filter-row {
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 14rpx;
	margin-bottom: 14rpx;
	position: relative;
}
.chip {
	font-size: 26rpx;
	color: var(--ink-600);
	background: var(--bg-card);
	border-radius: 999rpx;
	padding: 10rpx 28rpx;
	border: 2rpx solid var(--line-100);
}
.chip-sm {
	font-size: 24rpx;
	padding: 8rpx 22rpx;
}
.chip-active {
	color: var(--brand-600);
	background: var(--brand-50);
	border-color: var(--brand-600);
	font-weight: 600;
}
.filter-count {
	position: absolute;
	right: 0;
	top: 50%;
	transform: translateY(-50%);
	font-size: 24rpx;
	color: var(--ink-400);
}

.question-card {
	display: flex;
	flex-direction: column;
	gap: 14rpx;
}
.question-top {
	display: flex;
	align-items: center;
	gap: 14rpx;
}
.channel-badge {
	font-size: 22rpx;
	font-weight: 600;
	border-radius: 8rpx;
	padding: 4rpx 14rpx;
	background: var(--brand-50);
	color: var(--brand-600);
}
.channel-free {
	background: var(--bg-fill);
	color: var(--ink-500);
}
.channel-similar {
	background: var(--gold-50, #fdf6e5);
	color: var(--gold-600, #b8860b);
}
.channel-smart {
	background: var(--brand-50);
	color: var(--brand-600);
}
.question-diff {
	font-size: 22rpx;
	color: var(--ink-400);
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
.question-date {
	margin-left: auto;
	font-size: 22rpx;
	color: var(--ink-400);
}
.question-text {
	font-size: 28rpx;
	line-height: 1.6;
	color: var(--ink-900);
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 3;
	overflow: hidden;
}
.question-meta {
	display: flex;
	gap: 12rpx;
}
.meta-tag,
.meta-anchor {
	font-size: 22rpx;
	color: var(--ink-500);
	background: var(--bg-fill);
	border-radius: 8rpx;
	padding: 4rpx 12rpx;
}
.question-foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.foot-hint {
	font-size: 22rpx;
	color: var(--ink-400);
}
.foot-actions {
	display: flex;
	gap: 14rpx;
}
.action-btn {
	border-radius: 999rpx;
	padding: 10rpx 26rpx;
}
.action-primary {
	background: var(--brand-600);
}
.action-primary-text {
	color: #ffffff;
	font-size: 24rpx;
	font-weight: 600;
}
.action-secondary {
	background: var(--bg-fill);
}
.action-secondary-text {
	color: var(--ink-500);
	font-size: 24rpx;
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
.error-tip {
	padding: 60rpx 40rpx;
	text-align: center;
	color: var(--danger-600);
	font-size: 26rpx;
}
</style>
