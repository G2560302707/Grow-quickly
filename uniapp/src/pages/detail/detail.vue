<template>
	<view class="page">
		<template v-if="loading">
			<view class="card">
				<view class="skel sk-line sk-lg" />
				<view class="skel sk-line sk-md" />
				<view class="skel sk-line sk-sm" />
			</view>
			<view class="card">
				<view class="skel sk-line sk-lg" />
				<view class="skel sk-line sk-md" />
			</view>
		</template>
		<view v-else-if="errorMsg" class="error-tip">{{ errorMsg }}</view>
		<template v-else-if="item">
			<view v-if="item.originalImageUrl" class="card image-card fade-up">
				<image
					:src="item.originalImageUrl"
					class="origin-image"
					mode="widthFix"
					@tap="previewImage"
				/>
				<view class="image-zoom-hint">点击查看大图</view>
			</view>

			<view class="card fade-up">
				<view class="section-head">
					<text class="section-title">题目</text>
					<view class="section-extra-wrap">
						<text v-if="item.origin" class="origin-chip">{{ originLabel(item.origin) }}</text>
						<text v-if="item.subject?.name" class="section-extra">{{ item.subject.name }}</text>
					</view>
				</view>
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

			<!-- 掌握度 -->
			<view class="card fade-up">
				<view class="section-head">
					<text class="section-title">掌握度</text>
					<text class="section-extra">标记后自动同步</text>
				</view>
				<view class="mastery-row">
					<view
						v-for="opt in masteryOptions"
						:key="opt.level"
						class="mastery-opt"
						:class="[`mastery-${opt.level}`, { 'mastery-active': item.masteryLevel === opt.level }]"
						hover-class="hv"
						@tap="setMastery(opt.level)"
					>
						{{ opt.label }}
					</view>
				</view>
			</view>

			<view v-if="item.analysis" class="card fade-up">
				<view class="section-title">解析</view>
				<MdView :content="item.analysis" />
			</view>

			<view v-if="item.mistakeAnalysis" class="card fade-up">
				<view class="section-title">错因分析</view>
				<text class="content-text">{{ item.mistakeAnalysis }}</text>
			</view>

			<view v-if="allTags.length" class="card fade-up">
				<view class="section-title">知识点</view>
				<view class="tag-row">
					<text v-for="tag in allTags" :key="tag" class="tag">{{ tag }}</text>
				</view>
			</view>

			<view class="card fade-up">
				<view class="section-head">
					<text class="section-title">我的笔记</text>
					<text class="section-extra">{{ notes.length }}/2000</text>
				</view>
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
import {
	getErrorItem,
	updateErrorItemNotes,
	updateErrorItemMastery,
	type ErrorItem,
} from "@/api";
import MdView from "@/components/MdView.vue";
import { originLabel } from "@/utils/origin";

const masteryOptions = [
	{ level: 0, label: "未掌握" },
	{ level: 1, label: "复习中" },
	{ level: 2, label: "已掌握" },
] as const;

const itemId = ref("");
const item = ref<ErrorItem | null>(null);
const notes = ref("");
const loading = ref(true);
const savingNotes = ref(false);
const savingMastery = ref(false);
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

async function setMastery(level: number) {
	if (!item.value || savingMastery.value || item.value.masteryLevel === level) return;
	savingMastery.value = true;
	const prev = item.value.masteryLevel;
	item.value.masteryLevel = level; // 乐观更新
	try {
		await updateErrorItemMastery(itemId.value, level);
		uni.showToast({ title: "已更新掌握度", icon: "none" });
	} catch (e: any) {
		if (item.value) item.value.masteryLevel = prev; // 失败回滚
		uni.showToast({ title: e?.message || "更新失败", icon: "none" });
	} finally {
		savingMastery.value = false;
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
	width: 46%;
	margin-top: 20rpx;
}

/* ---------- 题图 ---------- */
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
	background: rgba(10, 16, 34, 0.6);
	color: #ffffff;
	font-size: 20rpx;
	padding: 6rpx 18rpx;
	border-radius: 999rpx;
}

/* ---------- 答案对比 ---------- */
.answer-grid {
	display: flex;
	gap: 20rpx;
	margin-top: 28rpx;
}
.answer-box {
	flex: 1;
	border-radius: 16rpx;
	padding: 22rpx 26rpx;
}
.answer-wrong {
	background: var(--danger-50);
	border: 1rpx solid rgba(217, 58, 69, 0.14);
}
.answer-right {
	background: var(--success-50);
	border: 1rpx solid rgba(18, 133, 91, 0.14);
}
.answer-label {
	display: block;
	font-size: 22rpx;
	font-weight: 600;
	margin-bottom: 10rpx;
	letter-spacing: 1rpx;
}
.answer-wrong .answer-label {
	color: var(--danger-600);
}
.answer-right .answer-label {
	color: var(--success-600);
}
.answer-text {
	font-size: 28rpx;
	line-height: 1.6;
	color: var(--ink-700);
	white-space: pre-wrap;
}

/* ---------- 掌握度 ---------- */
.mastery-row {
	display: flex;
	gap: 16rpx;
}
.mastery-opt {
	flex: 1;
	text-align: center;
	font-size: 26rpx;
	font-weight: 500;
	color: var(--ink-500);
	background: var(--bg-fill);
	border: 2rpx solid transparent;
	border-radius: 14rpx;
	padding: 18rpx 0;
	transition: all 0.15s ease;
}
.mastery-0.mastery-active {
	background: var(--danger-50);
	border-color: var(--danger-600);
	color: var(--danger-600);
	font-weight: 600;
}
.mastery-1.mastery-active {
	background: var(--warning-50);
	border-color: var(--warning-600);
	color: var(--warning-600);
	font-weight: 600;
}
.mastery-2.mastery-active {
	background: var(--success-50);
	border-color: var(--success-600);
	color: var(--success-600);
	font-weight: 600;
}
.hv {
	opacity: 0.8;
}

/* ---------- 正文 ---------- */
.content-text {
	font-size: 29rpx;
	line-height: 1.75;
	color: var(--ink-900);
	white-space: pre-wrap;
}
.section-title {
	margin-bottom: 24rpx;
}

.tag-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

/* ---------- 来源标注 ---------- */
.section-extra-wrap {
	display: flex;
	align-items: center;
	gap: 12rpx;
}
.origin-chip {
	font-size: 22rpx;
	font-weight: 600;
	background: var(--brand-50);
	color: var(--brand-600);
	border-radius: 8rpx;
	padding: 4rpx 14rpx;
}

/* ---------- 笔记 ---------- */
.notes-input {
	background: var(--bg-fill);
	border-radius: 16rpx;
	padding: 24rpx;
	font-size: 28rpx;
	width: 100%;
	box-sizing: border-box;
	min-height: 140rpx;
	color: var(--ink-900);
}

/* ---------- 底部操作栏 ---------- */
.bottom-bar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	gap: 20rpx;
	padding: 16rpx 24rpx calc(env(safe-area-inset-bottom) + 16rpx);
	background: rgba(255, 255, 255, 0.94);
	-webkit-backdrop-filter: blur(20rpx);
	backdrop-filter: blur(20rpx);
	border-top: 1rpx solid var(--line-100);
	z-index: 10;
}
.bar-btn {
	flex: 1;
	margin: 0;
	font-size: 28rpx;
	height: 80rpx;
	line-height: 80rpx;
}
.bar-btn-main {
	flex: 1.6;
}
.bottom-placeholder {
	height: calc(140rpx + env(safe-area-inset-bottom));
}
</style>
