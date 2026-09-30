<template>
	<view class="page">
		<view v-if="loading" class="empty-tip">加载中...</view>
		<view v-else-if="errorMsg" class="error-tip">{{ errorMsg }}</view>
		<template v-else-if="item">
			<view v-if="item.originalImageUrl" class="card image-card">
				<image
					:src="item.originalImageUrl"
					class="origin-image"
					mode="widthFix"
					@tap="previewImage"
				/>
				<view class="image-zoom-hint">点击查看大图</view>
			</view>

			<view class="card">
				<view class="section-title">题目</view>
				<text class="content-text">{{ item.questionText || "—" }}</text>

				<!-- 答案对比 -->
				<view class="answer-grid">
					<view v-if="item.wrongAnswerText" class="answer-box answer-wrong">
						<text class="answer-label">我的答案</text>
						<text class="answer-text">{{ item.wrongAnswerText }}</text>
					</view>
					<view class="answer-box answer-right">
						<text class="answer-label">正确答案</text>
						<text class="answer-text">{{ item.answerText || "—" }}</text>
					</view>
				</view>
			</view>

			<view v-if="item.analysis" class="card">
				<view class="section-title">解析</view>
				<MdView :content="item.analysis" />
			</view>

			<view v-if="item.mistakeAnalysis" class="card">
				<view class="section-title">错因分析</view>
				<text class="content-text">{{ item.mistakeAnalysis }}</text>
			</view>

			<view v-if="allTags.length" class="card">
				<view class="section-title">知识点</view>
				<view class="tag-row">
					<text v-for="tag in allTags" :key="tag" class="tag">{{ tag }}</text>
				</view>
			</view>

			<view class="card">
				<view class="section-title">我的笔记</view>
				<textarea
					v-model="notes"
					class="notes-input"
					placeholder="记录思路和易错点..."
					placeholder-class="ph"
					:maxlength="2000"
					auto-height
				/>
			</view>

			<!-- 底部固定操作栏 -->
			<view class="bottom-bar">
				<button class="btn-outline bar-btn" :disabled="savingNotes" hover-class="button-hover" @tap="saveNotes">
					{{ savingNotes ? "保存中..." : "保存笔记" }}
				</button>
				<button class="btn-primary bar-btn bar-btn-main" hover-class="button-hover" @tap="goPractice">
					举一反三 · 生成练习题
				</button>
			</view>
			<view class="bottom-placeholder" />
		</template>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { getErrorItem, updateErrorItemNotes, type ErrorItem } from "@/api";
import MdView from "@/components/MdView.vue";

const itemId = ref("");
const item = ref<ErrorItem | null>(null);
const notes = ref("");
const loading = ref(true);
const savingNotes = ref(false);
const errorMsg = ref("");

const allTags = computed<string[]>(() => {
	if (!item.value) return [];
	const fromRelation = (item.value.tags || []).map(t => t.name);
	if (fromRelation.length > 0) return fromRelation;
	try {
		const parsed = JSON.parse(item.value.knowledgePoints || "[]");
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
});

onLoad(async (query) => {
	itemId.value = (query?.id as string) || "";
	try {
		const data = await getErrorItem(itemId.value);
		item.value = data;
		notes.value = data.userNotes || "";
	} catch (e: any) {
		errorMsg.value = e?.message || "加载失败";
	} finally {
		loading.value = false;
	}
});

function previewImage() {
	if (item.value?.originalImageUrl) {
		uni.previewImage({ urls: [item.value.originalImageUrl] });
	}
}

async function saveNotes() {
	savingNotes.value = true;
	try {
		await updateErrorItemNotes(itemId.value, notes.value);
		uni.showToast({ title: "笔记已保存", icon: "success" });
	} catch (e: any) {
		uni.showToast({ title: e?.message || "保存失败", icon: "none" });
	} finally {
		savingNotes.value = false;
	}
}

function goPractice() {
	const subjectName = item.value?.subject?.name || "其他";
	uni.navigateTo({
		url: `/pages/practice/practice?errorItemId=${itemId.value}&subject=${encodeURIComponent(subjectName)}`,
	});
}
</script>

<style scoped>
.image-card {
	padding: 12rpx;
	position: relative;
}
.origin-image {
	width: 100%;
	border-radius: 16rpx;
}
.image-zoom-hint {
	position: absolute;
	right: 24rpx;
	bottom: 24rpx;
	background: rgba(31, 41, 55, 0.6);
	color: #ffffff;
	font-size: 20rpx;
	padding: 6rpx 16rpx;
	border-radius: 999rpx;
}

.answer-grid {
	display: flex;
	gap: 20rpx;
	margin-top: 28rpx;
}
.answer-box {
	flex: 1;
	border-radius: 16rpx;
	padding: 20rpx 24rpx;
}
.answer-wrong {
	background: #fef2f2;
}
.answer-right {
	background: #f0fdf4;
}
.answer-label {
	display: block;
	font-size: 22rpx;
	font-weight: 600;
	margin-bottom: 8rpx;
	letter-spacing: 1rpx;
}
.answer-wrong .answer-label {
	color: #ef4444;
}
.answer-right .answer-label {
	color: #16a34a;
}
.answer-text {
	font-size: 27rpx;
	line-height: 1.6;
	color: #374151;
	white-space: pre-wrap;
}

.content-text {
	font-size: 29rpx;
	line-height: 1.7;
	color: #1f2937;
	white-space: pre-wrap;
}

.tag-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

.notes-input {
	background: #f5f6fa;
	border-radius: 14rpx;
	padding: 22rpx;
	font-size: 28rpx;
	width: 100%;
	box-sizing: border-box;
	min-height: 140rpx;
}
.ph {
	color: #c4c9d4;
}

.bottom-bar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	gap: 20rpx;
	padding: 16rpx 24rpx calc(env(safe-area-inset-bottom) + 16rpx);
	background: rgba(255, 255, 255, 0.96);
	border-top: 2rpx solid #f3f4f6;
	z-index: 10;
}
.bar-btn {
	flex: 1;
	margin: 0;
	font-size: 28rpx;
}
.bar-btn-main {
	flex: 1.6;
}
.bottom-placeholder {
	height: calc(140rpx + env(safe-area-inset-bottom));
}
</style>
