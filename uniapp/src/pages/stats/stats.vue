<template>
	<view class="page">
		<view v-if="anyLoading" class="card">
			<view class="skel sk-line sk-lg" />
			<view class="skel sk-line sk-md" />
			<view class="skel sk-line sk-sm" />
			<view class="skel sk-line sk-md" />
		</view>
		<view v-else-if="bothFailed" class="error-tip">{{ loadError || "统计数据加载失败" }}</view>
		<template v-else>
			<!-- 错题掌握度 -->
			<view class="card fade-up">
				<view class="section-head">
					<text class="section-title">错题掌握度</text>
					<text class="section-extra">累计 {{ overview.totalItems }} 题</text>
				</view>
				<template v-if="overview.totalItems > 0">
					<view class="mastery-top">
					<view
						class="mastery-ring"
						:style="{
							background: `conic-gradient(var(--brand-600) 0deg, var(--brand-600) ${overview.masteryRate * 3.6}deg, var(--brand-50) ${overview.masteryRate * 3.6}deg, var(--brand-50) 360deg)`,
						}"
					>
						<text class="mastery-ring-num num">{{ overview.masteryRate }}<text class="mastery-ring-unit">%</text></text>
					</view>
						<view class="mastery-brief">
							<text class="mastery-brief-title">已掌握比例</text>
							<text class="mastery-brief-sub">本周新增 {{ overview.weekAdded }} 题，继续加油</text>
						</view>
					</view>
					<view class="stack-bar">
						<view class="stack-seg" :style="{ width: segWidth(overview.unmastered), background: '#e2565f' }" />
						<view class="stack-seg" :style="{ width: segWidth(overview.reviewing), background: '#e8993c' }" />
						<view class="stack-seg" :style="{ width: segWidth(overview.mastered), background: '#18a058' }" />
					</view>
					<view class="legend-row">
						<view class="legend-item">
							<view class="legend-dot" style="background: #e2565f" />
							<text class="legend-text">未掌握 {{ overview.unmastered }}</text>
						</view>
						<view class="legend-item">
							<view class="legend-dot" style="background: #e8993c" />
							<text class="legend-text">复习中 {{ overview.reviewing }}</text>
						</view>
						<view class="legend-item">
							<view class="legend-dot" style="background: #18a058" />
							<text class="legend-text">已掌握 {{ overview.mastered }}</text>
						</view>
					</view>
				</template>
				<view v-else class="empty-tip empty-inline">还没有错题，去"识别"页添加吧</view>
			</view>

			<!-- 练习概况 -->
			<view class="card fade-up">
				<view class="section-head">
					<text class="section-title">练习概况</text>
					<text class="section-extra">来自举一反三</text>
				</view>
				<template v-if="practice.overallStats.total > 0">
					<view class="stat-row">
						<view class="stat-cell">
							<text class="stat-num num">{{ practice.overallStats.total }}</text>
							<text class="stat-label">练习次数</text>
						</view>
						<view class="stat-divider" />
						<view class="stat-cell">
							<text class="stat-num num">{{ practice.overallStats.correct }}</text>
							<text class="stat-label">答对</text>
						</view>
						<view class="stat-divider" />
						<view class="stat-cell">
							<text class="stat-num stat-num-gold num">{{ practice.overallStats.rate }}<text class="stat-unit">%</text></text>
							<text class="stat-label">答对率</text>
						</view>
					</view>
				</template>
				<view v-else class="empty-tip empty-inline">还没有练习记录，做错题详情页点"举一反三"试试</view>
			</view>

			<!-- 近 6 个月练习趋势 -->
			<view v-if="practice.overallStats.total > 0" class="card fade-up">
				<view class="section-head">
					<text class="section-title">近 6 个月练习趋势</text>
					<view class="chart-tip">
						<view class="legend-dot" style="background: var(--brand-600)" />
						<text class="legend-text">答对</text>
						<view class="legend-dot" style="background: var(--brand-100)" />
						<text class="legend-text">未答对</text>
					</view>
				</view>
				<view class="bar-chart">
					<view v-for="m in trend" :key="m.key" class="bar-col">
						<text v-if="m.total > 0" class="bar-count num">{{ m.total }}</text>
						<view class="bar-stack">
							<view class="bar-rest" :style="{ height: m.restH + 'rpx' }" />
							<view class="bar-correct" :style="{ height: m.correctH + 'rpx' }" />
						</view>
						<text class="bar-label">{{ m.label }}</text>
					</view>
				</view>
			</view>

			<!-- 科目分布 -->
			<view v-if="subjects.length > 0" class="card fade-up">
				<view class="section-head">
					<text class="section-title">科目分布</text>
				</view>
				<view v-for="s in subjects" :key="s.name" class="hbar-row">
					<text class="hbar-name">{{ s.name }}</text>
					<view class="hbar-track">
						<view class="hbar-fill" :style="{ width: s.pct + '%' }" />
					</view>
					<text class="hbar-count num">{{ s.value }}</text>
				</view>
			</view>

			<!-- 薄弱点诊断 -->
			<view class="card fade-up">
				<view class="section-head">
					<text class="section-title">薄弱点诊断</text>
					<text class="section-extra">{{ weakness.totalErrorItems > 0 ? `基于 ${weakness.totalErrorItems} 道错题` : "积累中" }}</text>
				</view>
				<template v-if="weakness.topKps.length > 0">
					<view v-for="(kp, idx) in weakness.topKps" :key="kp.tagId" class="weak-row">
						<view class="weak-rank" :class="`weak-rank-${idx}`"><text class="weak-rank-num num">{{ idx + 1 }}</text></view>
						<view class="weak-body">
							<view class="weak-head">
								<text class="weak-name">{{ kp.name }}</text>
								<text class="weak-trend" :class="`trend-${kp.trend}`">{{ trendLabel(kp.trend) }}</text>
							</view>
							<view class="weak-bar-track">
								<view class="weak-bar-fill" :style="{ width: kp.score + '%' }" />
							</view>
							<view class="weak-meta">
								<text class="weak-meta-text">薄弱度 {{ kp.score }}</text>
								<text class="weak-meta-text">错 {{ kp.errorCount }} 题</text>
								<text class="weak-meta-text">{{ kp.chapterName || "未分类" }}</text>
								<text class="weak-meta-text">证据 {{ Math.round(kp.confidence * 100) }}%</text>
							</view>
						</view>
						<view class="weak-cta" hover-class="hv" @tap="goSmartPractice(kp)">
							<text class="weak-cta-text">专项练</text>
						</view>
					</view>
					<view class="weak-footnote">
						<text class="weak-footnote-text">薄弱度综合错题积累、复发频率与掌握进度，随练习动态更新</text>
					</view>
				</template>
				<view v-else class="empty-tip empty-inline">
					{{ weakness.totalErrorItems > 0 ? "证据积累中：给错题标注知识点后，这里会指出你的薄弱环节" : "还没有错题数据，先去拍照识题吧" }}
				</view>
			</view>

			<!-- 难度分布 -->
			<view v-if="practice.overallStats.total > 0 && difficulties.length > 0" class="card fade-up">
				<view class="section-head">
					<text class="section-title">难度分布</text>
				</view>
				<view v-for="d in difficulties" :key="d.name" class="hbar-row">
					<view class="diff-name-wrap">
						<view class="legend-dot" :style="{ background: d.color }" />
						<text class="hbar-name diff-name">{{ d.name }}</text>
					</view>
					<view class="hbar-track">
						<view class="hbar-fill" :style="{ width: d.pct + '%', background: d.color }" />
					</view>
					<text class="hbar-count num">{{ d.value }}</text>
				</view>
			</view>
		</template>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import {
	getOverviewStats,
	getPracticeStats,
	getWeaknessReport,
	type OverviewStats,
	type PracticeStats,
	type WeaknessReport,
	type KpDiagnosis,
} from "@/api";

const EMPTY_OVERVIEW: OverviewStats = {
	totalItems: 0,
	unmastered: 0,
	reviewing: 0,
	mastered: 0,
	masteryRate: 0,
	notebookCount: 0,
	weekAdded: 0,
};

const overview = ref<OverviewStats>({ ...EMPTY_OVERVIEW });

/** 页面内部使用的严格类型（数据经 normalizePractice 归一化） */
interface NormalizedPractice {
	subjectStats: { name: string; value: number }[];
	activityStats: { date: string; total: number; correct: number }[];
	difficultyStats: { name: string; value: number }[];
	overallStats: { total: number; correct: number; rate: number };
}

const practice = ref<NormalizedPractice>({
	subjectStats: [],
	activityStats: [],
	difficultyStats: [],
	overallStats: { total: 0, correct: 0, rate: 0 },
});

const weakness = ref<WeaknessReport>({
	generatedAt: "",
	totalErrorItems: 0,
	readyKpCount: 0,
	kps: [],
	chapters: [],
	topKps: [],
});

function trendLabel(trend: KpDiagnosis["trend"]): string {
	if (trend === "worsening") return "↑ 恶化中";
	if (trend === "improving") return "↓ 改善中";
	if (trend === "flat") return "→ 持平";
	return "· 观察";
}

function goSmartPractice(kp: KpDiagnosis) {
	uni.navigateTo({
		url: `/pages/practice/practice?mode=session&tagId=${kp.tagId}&tagName=${encodeURIComponent(kp.name)}`,
	});
}

const anyLoading = ref(true);
const overviewFailed = ref(false);
const practiceFailed = ref(false);
const loadError = ref("");

const bothFailed = computed(() => overviewFailed.value && practiceFailed.value);

const DIFF_META: Record<string, { label: string; color: string; order: number }> = {
	easy: { label: "简单", color: "#18a058", order: 0 },
	medium: { label: "中等", color: "#e8993c", order: 1 },
	hard: { label: "困难", color: "#e2565f", order: 2 },
	other: { label: "其他", color: "#9aa3b8", order: 3 },
};

/** 近 6 个月趋势（补齐空月份，等比换算柱高） */
const trend = computed(() => {
	const raw = practice.value.activityStats || [];
	const map = new Map(raw.map(a => [a.date, a]));
	const months: { key: string; label: string; total: number; correct: number }[] = [];
	const now = new Date();
	for (let i = 5; i >= 0; i--) {
		const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
		const hit = map.get(key);
		months.push({
			key,
			label: `${d.getMonth() + 1}月`,
			total: hit?.total || 0,
			correct: hit?.correct || 0,
		});
	}
	const max = Math.max(...months.map(m => m.total), 1);
	const BAR_MAX = 200;
	return months.map(m => {
		const rest = m.total - m.correct;
		return {
			...m,
			restH: rest > 0 ? Math.max((rest / max) * BAR_MAX, 8) : 0,
			correctH: m.correct > 0 ? Math.max((m.correct / max) * BAR_MAX, 8) : 0,
		};
	});
});

const subjects = computed(() => {
	const list = practice.value.subjectStats || [];
	const max = Math.max(...list.map(s => s.value), 1);
	return [...list]
		.sort((a, b) => b.value - a.value)
		.map(s => ({
			name: !s.name || s.name === "Unknown" ? "其他" : s.name,
			value: s.value,
			pct: Math.max((s.value / max) * 100, 4),
		}));
});

const difficulties = computed(() => {
	const list = practice.value.difficultyStats || [];
	const max = Math.max(...list.map(d => d.value), 1);
	return list
		.map(d => {
			const key = (d.name || "other").toLowerCase();
			const meta = DIFF_META[key] || DIFF_META.other;
			return { name: meta.label, color: meta.color, order: meta.order, value: d.value, pct: Math.max((d.value / max) * 100, 4) };
		})
		.sort((a, b) => a.order - b.order);
});

function segWidth(v: number): string {
	const total = overview.value.totalItems || 1;
	return `${(v / total) * 100}%`;
}

onShow(async () => {
	anyLoading.value = true;
	overviewFailed.value = false;
	practiceFailed.value = false;
	const [ov, pr, wp] = await Promise.allSettled([getOverviewStats(), getPracticeStats(), getWeaknessReport()]);
	if (ov.status === "fulfilled") overview.value = ov.value;
	else overviewFailed.value = true;
	if (pr.status === "fulfilled") practice.value = normalizePractice(pr.value);
	else practiceFailed.value = true;
	if (wp.status === "fulfilled") weakness.value = wp.value;
	if (bothFailed.value) loadError.value = (ov as PromiseRejectedResult).reason?.message || "网络异常，请下拉重试";
	anyLoading.value = false;
});

function normalizePractice(p: PracticeStats): NormalizedPractice {
	return {
		subjectStats: Array.isArray(p?.subjectStats) ? p.subjectStats : [],
		activityStats: Array.isArray(p?.activityStats) ? p.activityStats : [],
		difficultyStats: Array.isArray(p?.difficultyStats) ? p.difficultyStats : [],
		overallStats: {
			total: Number(p?.overallStats?.total) || 0,
			correct: Number(p?.overallStats?.correct) || 0,
			rate: Number(p?.overallStats?.rate) || 0,
		},
	};
}
</script>

<style scoped>
/* ---------- 骨架 ---------- */
.sk-line {
	height: 28rpx;
	border-radius: 8rpx;
}
.sk-lg {
	width: 94%;
}
.sk-md {
	width: 70%;
	margin-top: 20rpx;
}
.sk-sm {
	width: 48%;
	margin-top: 20rpx;
}

/* ---------- 掌握度 ---------- */
.mastery-top {
	display: flex;
	align-items: center;
	margin-bottom: 28rpx;
}
.mastery-ring {
	width: 132rpx;
	height: 132rpx;
	border-radius: 50%;
	background: var(--brand-50); /* conic-gradient 内联样式覆盖；不支持时整体淡色兜底 */
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
}
.mastery-ring::before {
	content: "";
	position: absolute;
	width: 100rpx;
	height: 100rpx;
	border-radius: 50%;
	background: var(--bg-card);
}
.mastery-ring-num {
	position: relative;
	font-size: 36rpx;
	font-weight: 700;
	color: var(--brand-600);
}
.mastery-ring-unit {
	font-size: 20rpx;
}
.mastery-brief {
	margin-left: 28rpx;
	display: flex;
	flex-direction: column;
}
.mastery-brief-title {
	font-size: 30rpx;
	font-weight: 600;
	color: var(--ink-900);
}
.mastery-brief-sub {
	font-size: 24rpx;
	color: var(--ink-400);
	margin-top: 10rpx;
}

.stack-bar {
	display: flex;
	height: 16rpx;
	border-radius: 999rpx;
	overflow: hidden;
	background: var(--line-50);
}
.stack-seg {
	height: 100%;
	transition: width 0.4s ease;
}
.legend-row {
	display: flex;
	justify-content: space-between;
	margin-top: 20rpx;
}
.legend-item {
	display: flex;
	align-items: center;
}
.legend-dot {
	width: 14rpx;
	height: 14rpx;
	border-radius: 4rpx;
	margin-right: 10rpx;
}
.legend-text {
	font-size: 22rpx;
	color: var(--ink-500);
}

/* ---------- 练习概况 ---------- */
.stat-row {
	display: flex;
	align-items: stretch;
}
.stat-cell {
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
.empty-inline {
	padding: 48rpx 24rpx;
	font-size: 26rpx;
}

/* ---------- 趋势柱状图 ---------- */
.chart-tip {
	display: flex;
	align-items: center;
}
.chart-tip .legend-dot {
	margin-right: 8rpx;
}
.chart-tip .legend-dot + .legend-text {
	margin-right: 20rpx;
}
.bar-chart {
	display: flex;
	align-items: flex-end;
}
.bar-col {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.bar-count {
	font-size: 20rpx;
	color: var(--ink-400);
	margin-bottom: 8rpx;
	min-height: 28rpx;
}
.bar-stack {
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
	height: 200rpx;
}
.bar-rest {
	width: 36rpx;
	background: var(--brand-100);
	border-radius: 8rpx 8rpx 0 0;
}
.bar-correct {
	width: 36rpx;
	background: linear-gradient(180deg, var(--brand-500), var(--brand-600));
	border-radius: 8rpx 8rpx 0 0;
	margin-top: -4rpx;
}
.bar-label {
	font-size: 22rpx;
	color: var(--ink-400);
	margin-top: 12rpx;
}

/* ---------- 水平条 ---------- */
.hbar-row {
	display: flex;
	align-items: center;
	padding: 14rpx 0;
}
.hbar-name {
	width: 140rpx;
	font-size: 26rpx;
	color: var(--ink-600);
	flex-shrink: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.diff-name-wrap {
	display: flex;
	align-items: center;
	width: 140rpx;
	flex-shrink: 0;
}
.diff-name-wrap .legend-dot {
	margin-right: 10rpx;
}
.diff-name {
	width: auto;
}
.hbar-track {
	flex: 1;
	height: 18rpx;
	border-radius: 999rpx;
	background: var(--line-50);
	overflow: hidden;
	margin: 0 20rpx;
}
.hbar-fill {
	height: 100%;
	border-radius: 999rpx;
	background: linear-gradient(90deg, var(--brand-500), var(--brand-600));
	transition: width 0.4s ease;
}
.hbar-count {
	width: 64rpx;
	text-align: right;
	font-size: 24rpx;
	color: var(--ink-500);
	flex-shrink: 0;
}

/* ---------- 薄弱点诊断 ---------- */
.weak-row {
	display: flex;
	align-items: center;
	padding: 18rpx 0;
}
.weak-row + .weak-row {
	border-top: 1rpx solid var(--line-50);
}
.weak-rank {
	width: 52rpx;
	height: 52rpx;
	border-radius: 16rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 20rpx;
	flex-shrink: 0;
	background: var(--danger-50);
}
.weak-rank-1 {
	background: var(--danger-50);
	color: var(--danger-600);
}
.weak-rank-2 {
	background: var(--warning-50);
	color: var(--warning-600);
}
.weak-rank-0 {
	background: var(--danger-50);
	color: var(--danger-600);
}
.weak-rank-num {
	font-size: 26rpx;
	font-weight: 700;
	color: inherit;
}
.weak-rank-1 .weak-rank-num {
	color: var(--danger-600);
}
.weak-rank-2 .weak-rank-num {
	color: var(--warning-600);
}
.weak-rank-0 .weak-rank-num {
	color: var(--danger-600);
}
.weak-body {
	flex: 1;
	min-width: 0;
}
.weak-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.weak-name {
	font-size: 28rpx;
	font-weight: 600;
	color: var(--ink-900);
}
.weak-trend {
	font-size: 22rpx;
	color: var(--ink-400);
}
.trend-worsening {
	color: var(--danger-600);
	font-weight: 600;
}
.trend-improving {
	color: var(--success-600);
}
.weak-bar-track {
	height: 14rpx;
	border-radius: 999rpx;
	background: var(--line-50);
	margin-top: 12rpx;
	overflow: hidden;
}
.weak-bar-fill {
	height: 100%;
	border-radius: 999rpx;
	background: linear-gradient(90deg, var(--gold-500), var(--danger-600));
	transition: width 0.4s ease;
}
.weak-meta {
	display: flex;
	gap: 18rpx;
	margin-top: 10rpx;
	flex-wrap: wrap;
}
.weak-meta-text {
	font-size: 20rpx;
	color: var(--ink-400);
}
.weak-cta {
	flex-shrink: 0;
	margin-left: 16rpx;
	background: var(--brand-600);
	border-radius: 999rpx;
	padding: 12rpx 26rpx;
	box-shadow: 0 6rpx 16rpx rgba(61, 82, 213, 0.24);
}
.weak-cta-text {
	color: #ffffff;
	font-size: 24rpx;
	font-weight: 600;
}
.weak-footnote {
	margin-top: 16rpx;
}
.weak-footnote-text {
	font-size: 20rpx;
	color: var(--ink-300);
	line-height: 1.6;
}

/* ---------- 练习记录入口 ---------- */
</style>
