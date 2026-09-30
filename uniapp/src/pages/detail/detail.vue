<template>
	<view class="page">
		<view v-if="loading" class="empty-tip">加载中...</view>
		<view v-else-if="errorMsg" class="error-tip">{{ errorMsg }}</view>
		<template v-else-if="item">
			<image
				v-if="item.originalImageUrl"
				:src="item.originalImageUrl"
				class="card origin-image"
				mode="widthFix"
				@tap="previewImage"
			/>

			<view class="card">
				<view class="section-title">题目</view>
				<text class="content-text">{{ item.questionText || "—" }}</text>
				<view v-if="item.wrongAnswerText" class="block">
					<view class="section-title">我的答案</view>
					<text class="content-text wrong">{{ item.wrongAnswerText }}</text>
				</view>
				<view class="block">
					<view class="section-title">正确答案</view>
					<text class="content-text">{{ item.answerText || "—" }}</text>
				</view>
			</view>

			<view class="card">
				<view class="section-title">解析</view>
				<text class="content-text">{{ item.analysis || "—" }}</text>
				<view v-if="item.mistakeAnalysis" class="block">
					<view class="section-title">错因分析</view>
					<text class="content-text">{{ item.mistakeAnalysis }}</text>
				</view>
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
					:maxlength="2000"
					auto-height
				/>
				<button class="btn-outline notes-save" :disabled="savingNotes" @tap="saveNotes">
					{{ savingNotes ? "保存中..." : "保存笔记" }}
				</button>
			</view>

			<button class="btn-primary practice-btn" @tap="goPractice">举一反三 · 生成练习题</button>
		</template>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { getErrorItem, updateErrorItemNotes, type ErrorItem } from "@/api";

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
.origin-image {
	width: calc(100% - 48rpx);
	height: 400rpx;
}
.block {
	margin-top: 24rpx;
}
.content-text {
	font-size: 28rpx;
	line-height: 1.7;
	white-space: pre-wrap;
}
.content-text.wrong {
	color: #ef4444;
}
.tag-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}
.tag {
	background: #fff7ed;
	color: #ea580c;
	font-size: 24rpx;
	padding: 6rpx 16rpx;
	border-radius: 999rpx;
}
.notes-input {
	background: #f9fafb;
	border-radius: 12rpx;
	padding: 20rpx;
	font-size: 28rpx;
	width: 100%;
	box-sizing: border-box;
	min-height: 120rpx;
}
.notes-save {
	margin-top: 20rpx;
}
.practice-btn {
	margin: 30rpx 24rpx 60rpx;
}
</style>
