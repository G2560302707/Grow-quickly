<template>
	<view class="page">
		<view v-if="loading" class="loading-box">
			<view class="loading-dot" />
			<text class="empty-tip">AI 正在出题，请稍候...</text>
		</view>
		<view v-else-if="errorMsg" class="card error-card">
			<text class="error-emoji">😵</text>
			<text class="error-msg">{{ errorMsg }}</text>
			<button class="btn-outline retry-btn" hover-class="button-hover" @tap="generate">重新生成</button>
		</view>
		<template v-else-if="question">
			<!-- 难度选择 -->
			<view class="diff-row">
				<view
					v-for="d in difficulties"
					:key="d.value"
					class="diff-chip"
					:class="{ 'diff-active': difficulty === d.value }"
					hover-class="hv"
					@tap="switchDifficulty(d.value)"
				>
					{{ d.label }}
				</view>
			</view>

			<view class="card">
				<view class="section-title">练习题</view>
				<text class="content-text">{{ question.questionText || "—" }}</text>
			</view>

			<view class="card">
				<view class="section-title">我的作答</view>
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
				<view class="card">
					<view class="section-title">参考答案</view>
					<text class="content-text answer-reveal">{{ question.answerText || "—" }}</text>
					<view v-if="question.analysis" class="block">
						<view class="section-title">解析</view>
						<MdView :content="question.analysis" />
					</view>
				</view>

				<view class="judge-row">
					<button class="btn-outline judge-btn judge-wrong" hover-class="button-hover" @tap="record(false)">
						✗ 答错了
					</button>
					<button class="btn-primary judge-btn" hover-class="button-hover" @tap="record(true)">
						✓ 答对了
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
import { generatePractice, recordPractice, type ParsedQuestion } from "@/api";
import MdView from "@/components/MdView.vue";

const difficulties = [
	{ value: "easy", label: "简单" },
	{ value: "medium", label: "中等" },
	{ value: "hard", label: "困难" },
] as const;

const errorItemId = ref("");
const subjectName = ref("其他");
const question = ref<ParsedQuestion | null>(null);
const answer = ref("");
const revealed = ref(false);
const loading = ref(true);
const errorMsg = ref("");
const difficulty = ref<"easy" | "medium" | "hard">("medium");

onLoad((query) => {
	errorItemId.value = (query?.errorItemId as string) || "";
	subjectName.value = query?.subject ? decodeURIComponent(query.subject as string) : "其他";
	generate();
});

async function generate() {
	loading.value = true;
	errorMsg.value = "";
	revealed.value = false;
	answer.value = "";
	try {
		question.value = await generatePractice(errorItemId.value, difficulty.value);
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
	try {
		await recordPractice(subjectName.value, difficulty.value, isCorrect);
		uni.showToast({ title: isCorrect ? "真棒！继续加油 🎉" : "已记录，多复习哦 💪", icon: "none" });
		setTimeout(() => {
			uni.navigateBack();
		}, 1200);
	} catch (e: any) {
		uni.showToast({ title: e?.message || "记录失败", icon: "none" });
	}
}
</script>

<style scoped>
.loading-box {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding-top: 120rpx;
}
.loading-dot {
	width: 24rpx;
	height: 24rpx;
	border-radius: 50%;
	background: #f97316;
	animation: bounce 0.8s ease-in-out infinite alternate;
}
@keyframes bounce {
	from {
		transform: translateY(0);
	}
	to {
		transform: translateY(-24rpx);
	}
}

.error-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 60rpx 40rpx;
}
.error-emoji {
	font-size: 72rpx;
	margin-bottom: 20rpx;
}
.error-msg {
	font-size: 26rpx;
	color: #ef4444;
	text-align: center;
	line-height: 1.6;
	margin-bottom: 32rpx;
}
.retry-btn {
	padding: 0 60rpx;
}

.diff-row {
	display: flex;
	gap: 16rpx;
	padding: 24rpx 24rpx 0;
}
.diff-chip {
	flex: 1;
	text-align: center;
	background: #ffffff;
	color: #6b7280;
	font-size: 26rpx;
	font-weight: 500;
	padding: 14rpx 0;
	border-radius: 999rpx;
	border: 2rpx solid #e5e7eb;
}
.diff-active {
	background: linear-gradient(135deg, #fb923c, #f97316);
	color: #ffffff;
	border-color: #f97316;
	font-weight: 600;
	box-shadow: 0 4rpx 12rpx rgba(249, 115, 22, 0.3);
}

.content-text {
	font-size: 30rpx;
	line-height: 1.7;
	color: #1f2937;
	white-space: pre-wrap;
}
.answer-reveal {
	color: #16a34a;
	font-weight: 600;
}
.block {
	margin-top: 28rpx;
}

.answer-input {
	background: #f5f6fa;
	border-radius: 14rpx;
	padding: 22rpx;
	font-size: 28rpx;
	width: 100%;
	box-sizing: border-box;
	min-height: 160rpx;
}
.ph {
	color: #c4c9d4;
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
	color: #ef4444;
	border-color: #fecaca;
}
.hv {
	opacity: 0.85;
}
</style>
