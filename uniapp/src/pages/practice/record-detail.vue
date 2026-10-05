<template>
	<view class="page">
		<view v-if="loading" class="card">
			<view class="skel sk-lg" />
			<view class="skel sk-md" />
			<view class="skel sk-md" />
		</view>

		<view v-else-if="!record" class="card empty-card">
			<text class="empty-title">记录不存在</text>
			<text class="empty-sub">这条练习记录可能已被删除</text>
		</view>

		<template v-else>
			<!-- 结果与来源 -->
			<view class="card head-card fade-up">
				<view class="head-row">
					<text class="result-badge" :class="record.isCorrect ? 'badge-good' : 'badge-bad'">
						{{ record.isCorrect ? "答对" : "答错" }}
					</text>
					<text class="head-source">{{ sourceLabel }}</text>
					<text class="head-date num">{{ formatDate(record.createdAt) }}</text>
				</view>
				<text class="head-meta">{{ record.subject || "—" }} · {{ difficultyLabel(record.difficulty) }}</text>
			</view>

			<!-- 题目 -->
			<view class="card fade-up">
				<view class="section-head">
					<text class="section-title">题目</text>
				</view>
				<text class="content-text">{{ record.questionText || "（无题目快照）" }}</text>
			</view>

			<!-- 参考答案 -->
			<view v-if="record.answerText" class="card fade-up">
				<view class="section-head">
					<text class="section-title">参考答案</text>
				</view>
				<MdView :content="record.answerText" />
			</view>

			<!-- 解析 -->
			<view v-if="record.analysis" class="card fade-up">
				<view class="section-head">
					<text class="section-title">解析</text>
				</view>
				<MdView :content="record.analysis" />
			</view>

			<view v-else class="card fade-up old-record-tip">
				<text class="old-tip-text">这条记录保存时未存答案与解析快照</text>
			</view>

			<!-- 原错题（举一反三锚定的题） -->
			<view v-if="record.errorItemId" class="card entry-card fade-up" hover-class="hv" @tap="goOrigin">
				<view class="entry-text">
					<text class="entry-title">查看原错题</text>
					<text class="entry-sub">本次举一反三练习锚定的题目</text>
				</view>
				<text class="entry-arrow">›</text>
			</view>
		</template>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { getPracticeRecord, type PracticeRecordItem } from "@/api";
import MdView from "@/components/MdView.vue";

const recordId = ref("");
const record = ref<PracticeRecordItem | null>(null);
const loading = ref(true);

const sourceLabel = computed(() => {
	if (!record.value) return "";
	if (record.value.tagId) return record.value.tag?.name ? `薄弱点专项 · ${record.value.tag.name}` : "薄弱点专项";
	if (record.value.errorItemId) return "举一反三";
	return "自由练习";
});

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

function goOrigin() {
	if (record.value?.errorItemId) {
		uni.navigateTo({ url: `/pages/detail/detail?id=${record.value.errorItemId}` });
	}
}

onLoad((query) => {
	recordId.value = (query?.id as string) || "";
	if (!recordId.value) {
		loading.value = false;
		return;
	}
	getPracticeRecord(recordId.value)
		.then(r => (record.value = r))
		.catch(e => uni.showToast({ title: e?.message || "加载失败", icon: "none" }))
		.finally(() => (loading.value = false));
});
</script>

<style scoped>
.head-card {
	display: flex;
	flex-direction: column;
	gap: 12rpx;
}
.head-row {
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
.head-source {
	flex: 1;
	font-size: 25rpx;
	color: var(--brand-600);
	font-weight: 600;
}
.head-date {
	font-size: 22rpx;
	color: var(--ink-400);
}
.head-meta {
	font-size: 23rpx;
	color: var(--ink-400);
}
.section-head {
	margin-bottom: 18rpx;
}
.content-text {
	font-size: 30rpx;
	line-height: 1.75;
	color: var(--ink-900);
	white-space: pre-wrap;
}
.old-record-tip {
	padding: 24rpx 32rpx;
}
.old-tip-text {
	font-size: 23rpx;
	color: var(--ink-400);
}
.entry-card {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 30rpx 32rpx;
}
.entry-text {
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}
.entry-title {
	font-size: 30rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.entry-sub {
	font-size: 24rpx;
	color: var(--ink-400);
}
.entry-arrow {
	font-size: 44rpx;
	color: var(--ink-300);
	line-height: 1;
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
.hv {
	opacity: 0.85;
}
</style>
