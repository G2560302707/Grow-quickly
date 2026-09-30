<template>
	<view class="page">
		<view v-if="loading" class="empty-tip">AI 正在出题，请稍候...</view>
		<view v-else-if="errorMsg" class="error-tip">
			{{ errorMsg }}
			<button class="btn-outline retry-btn" @tap="generate">重试</button>
		</view>
		<template v-else-if="question">
			<view class="card">
				<view class="practice-head">
					<text class="difficulty-tag">{{ difficultyLabel }}</text>
					<text class="subject-tag">{{ subjectName }}</text>
				</view>
				<view class="section-title">练习题</view>
				<text class="content-text">{{ question.questionText || "—" }}</text>
			</view>

			<view class="card">
				<view class="section-title">我的作答</view>
				<textarea
					v-model="answer"
					class="answer-input"
					placeholder="写下你的答案和解题过程..."
					:maxlength="2000"
					auto-height
				/>
			</view>

			<template v-if="revealed">
				<view class="card">
					<view class="section-title">参考答案</view>
					<text class="content-text">{{ question.answerText || "—" }}</text>
					<view class="block">
						<view class="section-title">解析</view>
						<text class="content-text">{{ question.analysis || "—" }}</text>
					</view>
				</view>

				<view class="judge-row">
					<button class="btn-outline judge-btn judge-wrong" @tap="record(false)">答错了</button>
					<button class="btn-primary judge-btn" @tap="record(true)">答对了</button>
				</view>
			</template>

			<button v-else class="btn-primary reveal-btn" :disabled="!answer.trim()" @tap="revealed = true">
				提交并查看答案
			</button>
		</template>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { generatePractice, recordPractice, type ParsedQuestion } from "@/api";

const errorItemId = ref("");
const subjectName = ref("其他");
const question = ref<ParsedQuestion | null>(null);
const answer = ref("");
const revealed = ref(false);
const loading = ref(true);
const errorMsg = ref("");
const difficulty = ref<"easy" | "medium" | "hard">("medium");

const difficultyLabel = computed(
	() => ({ easy: "简单", medium: "中等", hard: "困难" }[difficulty.value] || "中等")
);

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

async function record(isCorrect: boolean) {
	try {
		await recordPractice(subjectName.value, difficulty.value, isCorrect);
		uni.showToast({ title: isCorrect ? "真棒！继续加油" : "已记录，多复习哦", icon: "none" });
		setTimeout(() => {
			uni.navigateBack();
		}, 1200);
	} catch (e: any) {
		uni.showToast({ title: e?.message || "记录失败", icon: "none" });
	}
}
</script>

<style scoped>
.practice-head {
	display: flex;
	gap: 12rpx;
	margin-bottom: 20rpx;
}
.difficulty-tag {
	background: #eff6ff;
	color: #2563eb;
	font-size: 22rpx;
	padding: 4rpx 16rpx;
	border-radius: 999rpx;
}
.subject-tag {
	background: #fff7ed;
	color: #ea580c;
	font-size: 22rpx;
	padding: 4rpx 16rpx;
	border-radius: 999rpx;
}
.content-text {
	font-size: 30rpx;
	line-height: 1.7;
	white-space: pre-wrap;
}
.block {
	margin-top: 24rpx;
}
.answer-input {
	background: #f9fafb;
	border-radius: 12rpx;
	padding: 20rpx;
	font-size: 28rpx;
	width: 100%;
	box-sizing: border-box;
	min-height: 160rpx;
}
.reveal-btn {
	margin: 30rpx 24rpx 60rpx;
}
.judge-row {
	display: flex;
	gap: 24rpx;
	margin: 30rpx 24rpx 60rpx;
}
.judge-btn {
	flex: 1;
}
.judge-wrong {
	color: #ef4444;
	border-color: #fecaca;
}
.retry-btn {
	margin: 20rpx 24rpx;
}
</style>
