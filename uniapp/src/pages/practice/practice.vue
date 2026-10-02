<template>
	<view class="page">
		<view v-if="loading" class="card loading-card">
			<view class="ai-indicator">
				<view class="ai-dot" />
				<view class="ai-dot ai-dot-2" />
				<view class="ai-dot ai-dot-3" />
			</view>
			<text class="loading-title">{{ smartMode ? "AI 正在针对薄弱点出题" : "AI 正在出题" }}</text>
			<text class="loading-sub">{{ smartMode ? "结合你的错题与错因，定向生成" : "根据你的错题定制同类练习" }}</text>
			<view v-if="sessionMode" class="session-progress">
				<text class="session-progress-text num">{{ Math.min(sessionIndex + 1, sessionTotal) }} / {{ sessionTotal }}</text>
			</view>
			<view class="skel sk-line sk-lg" />
			<view class="skel sk-line sk-md" />
			<view class="skel sk-line sk-sm" />
		</view>
		<view v-else-if="errorMsg" class="card error-card">
			<view class="error-glyph">!</view>
			<text class="error-msg">{{ errorMsg }}</text>
			<button class="btn-outline retry-btn" hover-class="button-hover" @tap="generate">重新生成</button>
		</view>

		<!-- 会话小结 -->
		<template v-else-if="sessionDone">
			<view class="card summary-card fade-up">
				<view class="summary-ring" :class="sessionAllCorrect ? 'summary-ring-good' : ''">
					<text class="summary-ring-num num">{{ sessionCorrectCount }}<text class="summary-ring-unit">/{{ sessionTotal }}</text></text>
				</view>
				<text class="summary-title">{{ summaryTitle }}</text>
				<text class="summary-sub">{{ summarySub }}</text>
				<view class="summary-stats">
					<view class="summary-stat">
						<text class="summary-stat-num num">{{ firstRating }}</text>
						<text class="summary-stat-label">初始能力值</text>
					</view>
					<view class="summary-stat-divider" />
					<view class="summary-stat">
						<text class="summary-stat-num" :class="lastRating > firstRating ? 'stat-up' : 'stat-down'">{{ lastRating }}</text>
						<text class="summary-stat-label">当前能力值</text>
					</view>
				</view>
				<view class="summary-actions">
					<button class="btn-outline summary-btn" hover-class="button-hover" @tap="restartSession">再来一组</button>
					<button class="btn-primary summary-btn" hover-class="button-hover" @tap="finishSession">完成</button>
				</view>
			</view>
		</template>

		<template v-else-if="question">
			<!-- 难度选择（会话模式由 Elo 自适应，隐藏手动选择） -->
			<view v-if="!sessionMode" class="seg-wrap">
				<view class="seg">
					<view
						v-for="d in difficulties"
						:key="d.value"
						class="seg-item"
						:class="{ 'seg-item-active': difficulty === d.value }"
						hover-class="hv"
						@tap="switchDifficulty(d.value)"
					>
						{{ d.label }}
					</view>
				</view>
			</view>

			<view class="card fade-up">
				<view class="section-head">
					<text class="section-title">练习题</text>
					<text class="section-extra" :class="{ 'smart-tag': smartMode }">
						{{ sessionMode ? `第 ${sessionIndex} / ${sessionTotal} 题 · ${question.meta?.difficulty || "medium"}` : smartMode ? "薄弱点专项 · " + subjectName : subjectName }}
					</text>
				</view>
				<text class="content-text">{{ question.questionText || "—" }}</text>
			</view>

			<view class="card fade-up">
				<view class="section-head">
					<text class="section-title">我的作答</text>
					<text class="section-extra">{{ answer.length }}/2000</text>
				</view>
				<textarea
					v-model="answer"
					class="answer-input"
					placeholder="写下你的答案和解题过程..."
					placeholder-class="ph"
					:maxlength="2000"
					auto-height
				/>
			</view>

			<template v-if="revealed">
				<view class="card fade-up">
					<view class="section-head">
						<text class="section-title">参考答案</text>
					</view>
					<text class="content-text answer-reveal">{{ question.answerText || "—" }}</text>
					<view v-if="question.analysis" class="block">
						<view class="section-title">解析</view>
						<MdView :content="question.analysis" />
					</view>
				</view>

				<view class="judge-row">
					<button class="btn-outline judge-btn judge-wrong" hover-class="button-hover" @tap="record(false)">
						答错了
					</button>
					<button class="btn-primary judge-btn" hover-class="button-hover" @tap="record(true)">
						答对了
					</button>
				</view>
			</template>

			<button
				v-else
				class="btn-primary reveal-btn"
				:disabled="!answer.trim()"
				hover-class="button-hover"
				@tap="revealed = true"
			>
				提交并查看答案
			</button>
		</template>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { generatePractice, recordPractice, smartGenerate, type ParsedQuestion, type SmartQuestion } from "@/api";
import MdView from "@/components/MdView.vue";

const difficulties = [
	{ value: "easy", label: "简单" },
	{ value: "medium", label: "中等" },
	{ value: "hard", label: "困难" },
] as const;

const SESSION_TOTAL = 5;
const sessionTotal = SESSION_TOTAL;

const errorItemId = ref("");
const subjectName = ref("其他");
const question = ref<SmartQuestion | null>(null);
const answer = ref("");
const revealed = ref(false);
const loading = ref(true);
const errorMsg = ref("");
const difficulty = ref<"easy" | "medium" | "hard">("medium");

// 薄弱点专项模式（mode=smart：单题；mode=session：连续一组）
const smartMode = ref(false);
const sessionMode = ref(false);
const smartTagId = ref("");
const sessionIndex = ref(0); // 当前第几题（1 起）
const sessionResults = ref<boolean[]>([]);
const sessionRatings = ref<number[]>([]);

const sessionCorrectCount = computed(() => sessionResults.value.filter(Boolean).length);
const sessionDone = computed(() => sessionMode.value && sessionResults.value.length >= SESSION_TOTAL);
const sessionAllCorrect = computed(() => sessionCorrectCount.value === SESSION_TOTAL);
const firstRating = computed(() => sessionRatings.value[0] ?? 1200);
const lastRating = computed(() => sessionRatings.value[sessionRatings.value.length - 1] ?? 1200);
const summaryTitle = computed(() =>
	sessionAllCorrect ? "全对！这个考点已经拿下" : sessionCorrectCount.value >= 3 ? "进步明显，继续保持" : "这个考点还需要多练"
);
const summarySub = computed(() =>
	`「${subjectName.value}」专项 ${SESSION_TOTAL} 题完成，难度已按你的作答自动调整`
);

onLoad((query) => {
	errorItemId.value = (query?.errorItemId as string) || "";
	subjectName.value = query?.subject ? decodeURIComponent(query.subject as string) : "其他";
	if (query?.tagId) {
		smartMode.value = true;
		smartTagId.value = query.tagId as string;
		if (query?.tagName) {
			subjectName.value = decodeURIComponent(query.tagName as string);
		}
		if (query?.mode === "session") {
			sessionMode.value = true;
			sessionIndex.value = 1;
		}
	}
	generate();
});

async function generate() {
	loading.value = true;
	errorMsg.value = "";
	revealed.value = false;
	answer.value = "";
	try {
		if (smartMode.value) {
			const res = await smartGenerate({
				tagId: smartTagId.value,
				difficulty: sessionMode.value ? undefined : difficulty.value,
			});
			question.value = res;
			if (sessionMode.value && typeof res.meta?.elo?.rating === "number") {
				sessionRatings.value.push(res.meta.elo.rating);
			}
		} else {
			question.value = await generatePractice(errorItemId.value, difficulty.value);
		}
	} catch (e: any) {
		errorMsg.value = e?.message || "生成练习题失败";
	} finally {
		loading.value = false;
	}
}

function switchDifficulty(value: "easy" | "medium" | "hard") {
	if (difficulty.value === value) return;
	difficulty.value = value;
	generate();
}

async function record(isCorrect: boolean) {
	const meta = smartMode.value ? question.value?.meta : null;
	try {
		await recordPractice(subjectName.value, difficulty.value, isCorrect, {
			tagId: meta?.tagId,
			errorItemId: meta?.primaryErrorItemId || undefined,
			questionText: question.value?.questionText || undefined,
		});
	} catch (e: any) {
		// 记录失败不阻塞练习流程，仅提示
		uni.showToast({ title: e?.message || "记录失败", icon: "none" });
	}

	if (!sessionMode.value) {
		uni.showToast({ title: isCorrect ? "真棒！继续加油" : "已记录，多复习哦", icon: "none" });
		setTimeout(() => {
			uni.navigateBack();
		}, 1200);
		return;
	}

	// 会话模式：记录结果后自动进入下一题 / 小结
	sessionResults.value.push(isCorrect);
	if (sessionResults.value.length >= SESSION_TOTAL) {
		loading.value = false;
		question.value = null;
		return;
	}
	sessionIndex.value += 1;
	await generate();
}

function restartSession() {
	sessionResults.value = [];
	sessionRatings.value = [];
	sessionIndex.value = 1;
	generate();
}

function finishSession() {
	uni.navigateBack();
}
</script>

<style scoped>
/* ---------- 加载 ---------- */
.loading-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 72rpx 40rpx 48rpx;
}
.ai-indicator {
	display: flex;
	align-items: center;
	gap: 14rpx;
	margin-bottom: 28rpx;
}
.ai-dot {
	width: 16rpx;
	height: 16rpx;
	border-radius: 50%;
	background: var(--brand-600);
	animation: bounce 0.9s ease-in-out infinite;
}
.ai-dot-2 {
	animation-delay: 0.15s;
	background: var(--brand-500);
}
.ai-dot-3 {
	animation-delay: 0.3s;
	background: var(--gold-500);
}
@keyframes bounce {
	0%,
	100% {
		transform: translateY(0);
		opacity: 0.4;
	}
	50% {
		transform: translateY(-14rpx);
		opacity: 1;
	}
}
.loading-title {
	font-size: 32rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.smart-tag {
	color: var(--brand-600);
	font-weight: 600;
}
.session-progress {
	margin: 6rpx 0 24rpx;
	background: var(--brand-50);
	border: 1rpx solid var(--brand-100);
	border-radius: 999rpx;
	padding: 8rpx 28rpx;
}
.session-progress-text {
	font-size: 26rpx;
	font-weight: 700;
	color: var(--brand-600);
}
.loading-sub {
	font-size: 24rpx;
	color: var(--ink-400);
	margin: 10rpx 0 40rpx;
}
.sk-line {
	height: 28rpx;
	border-radius: 8rpx;
	width: 100%;
}
.sk-lg {
	width: 96%;
}
.sk-md {
	width: 78%;
	margin-top: 20rpx;
}
.sk-sm {
	width: 55%;
	margin-top: 20rpx;
}

/* ---------- 会话小结 ---------- */
.summary-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 64rpx 40rpx 48rpx;
}
.summary-ring {
	width: 176rpx;
	height: 176rpx;
	border-radius: 50%;
	background: var(--brand-50);
	border: 6rpx solid var(--brand-100);
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 28rpx;
}
.summary-ring-good {
	border-color: var(--success-600);
	background: var(--success-50);
}
.summary-ring-num {
	font-size: 56rpx;
	font-weight: 700;
	color: var(--brand-600);
}
.summary-ring-good .summary-ring-num {
	color: var(--success-600);
}
.summary-ring-unit {
	font-size: 28rpx;
	font-weight: 600;
}
.summary-title {
	font-size: 34rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.summary-sub {
	font-size: 24rpx;
	color: var(--ink-400);
	margin: 12rpx 0 36rpx;
	text-align: center;
}
.summary-stats {
	display: flex;
	align-items: stretch;
	width: 100%;
	background: var(--bg-fill);
	border-radius: 20rpx;
	padding: 28rpx 0;
	margin-bottom: 36rpx;
}
.summary-stat {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.summary-stat-num {
	font-size: 40rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.stat-up {
	color: var(--success-600);
}
.stat-down {
	color: var(--danger-600);
}
.summary-stat-label {
	font-size: 22rpx;
	color: var(--ink-400);
	margin-top: 8rpx;
}
.summary-stat-divider {
	width: 1rpx;
	background: var(--line-100);
}
.summary-actions {
	display: flex;
	gap: 20rpx;
	width: 100%;
}
.summary-btn {
	flex: 1;
	margin: 0;
}

/* ---------- 错误 ---------- */
.error-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 64rpx 40rpx;
}
.error-glyph {
	width: 96rpx;
	height: 96rpx;
	border-radius: 50%;
	background: var(--danger-50);
	color: var(--danger-600);
	font-size: 56rpx;
	font-weight: 700;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 24rpx;
}
.error-msg {
	font-size: 26rpx;
	color: var(--danger-600);
	text-align: center;
	line-height: 1.6;
	margin-bottom: 36rpx;
}
.retry-btn {
	padding: 0;
	height: 76rpx;
	line-height: 76rpx;
}
.hv {
	opacity: 0.85;
}

/* ---------- 难度分段选择 ---------- */
.seg-wrap {
	padding: 24rpx 24rpx 0;
}
.seg {
	display: flex;
	background: #eceef5;
	border-radius: 999rpx;
	padding: 6rpx;
}
.seg-item {
	flex: 1;
	text-align: center;
	color: var(--ink-500);
	font-size: 26rpx;
	font-weight: 500;
	padding: 16rpx 0;
	border-radius: 999rpx;
	transition: all 0.2s ease;
}
.seg-item-active {
	background: #ffffff;
	color: var(--brand-600);
	font-weight: 600;
	box-shadow: 0 4rpx 14rpx rgba(16, 26, 60, 0.12);
}

/* ---------- 正文 ---------- */
.section-title {
	margin-bottom: 20rpx;
}
.content-text {
	font-size: 30rpx;
	line-height: 1.75;
	color: var(--ink-900);
	white-space: pre-wrap;
}
.answer-reveal {
	color: var(--success-600);
	font-weight: 600;
}
.block {
	margin-top: 32rpx;
}

.answer-input {
	background: var(--bg-fill);
	border-radius: 16rpx;
	padding: 24rpx;
	font-size: 28rpx;
	width: 100%;
	box-sizing: border-box;
	min-height: 160rpx;
	color: var(--ink-900);
}

.reveal-btn {
	margin: 30rpx 24rpx calc(env(safe-area-inset-bottom) + 40rpx);
}
.judge-row {
	display: flex;
	gap: 24rpx;
	margin: 30rpx 24rpx calc(env(safe-area-inset-bottom) + 40rpx);
}
.judge-btn {
	flex: 1;
	margin: 0;
}
.judge-wrong {
	color: var(--danger-600);
	border-color: rgba(217, 58, 69, 0.3);
}
</style>
