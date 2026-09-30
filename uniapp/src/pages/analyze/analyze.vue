<template>
	<view class="page">
		<!-- 选择错题本 -->
		<view class="card">
			<view class="section-title">选择错题本</view>
			<picker :range="notebookNames" @change="onNotebookChange">
				<view class="picker-value">{{ selectedNotebook?.name || "请选择错题本" }}</view>
			</picker>
		</view>

		<!-- 拍照 / 相册 -->
		<view class="card">
			<view class="section-title">拍摄或选择题目图片</view>
			<view class="upload-actions">
				<button class="btn-outline action-btn" :disabled="analyzing" @tap="chooseImage('camera')">
					📷 拍照
				</button>
				<button class="btn-outline action-btn" :disabled="analyzing" @tap="chooseImage('album')">
					🖼 相册
				</button>
			</view>
			<image
				v-if="imagePath"
				:src="imagePath"
				class="preview-image"
				mode="aspectFit"
			/>
		</view>

		<!-- 识别 -->
		<button
			class="btn-primary analyze-btn"
			:disabled="!imagePath || !selectedNotebook || analyzing"
			@tap="handleAnalyze"
		>
			{{ analyzing ? "AI 识别中，请稍候..." : "开始 AI 识别" }}
		</button>
		<view v-if="errorMsg" class="error-tip">{{ errorMsg }}</view>

		<!-- 识别结果 -->
		<view v-if="result" class="card">
			<view class="section-title">识别结果</view>
			<view class="result-block">
				<text class="result-label">题目</text>
				<text class="result-text">{{ result.questionText || "（未识别到题目）" }}</text>
			</view>
			<view class="result-block">
				<text class="result-label">我的答案</text>
				<text class="result-text">{{ result.wrongAnswerText || "（图中未包含作答内容）" }}</text>
			</view>
			<view class="result-block">
				<text class="result-label">正确答案</text>
				<text class="result-text">{{ result.answerText || "—" }}</text>
			</view>
			<view class="result-block">
				<text class="result-label">解析</text>
				<text class="result-text">{{ result.analysis || "—" }}</text>
			</view>
			<view class="result-block">
				<text class="result-label">错因分析</text>
				<text class="result-text">{{ result.mistakeAnalysis || "—" }}</text>
			</view>
			<view v-if="result.knowledgePoints?.length" class="result-block">
				<text class="result-label">知识点</text>
				<view class="tag-row">
					<text v-for="tag in result.knowledgePoints" :key="tag" class="tag">{{ tag }}</text>
				</view>
			</view>

			<button class="btn-primary save-btn" :disabled="saving" @tap="handleSave">
				{{ saving ? "保存中..." : "保存到错题本" }}
			</button>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { listNotebooks, analyzeImage, createErrorItem, type Notebook, type ParsedQuestion } from "@/api";

const notebooks = ref<Notebook[]>([]);
const selectedNotebookId = ref("");
const imagePath = ref("");
const analyzing = ref(false);
const saving = ref(false);
const errorMsg = ref("");
const result = ref<ParsedQuestion | null>(null);

const notebookNames = computed(() => notebooks.value.map(nb => nb.name));
const selectedNotebook = computed(() =>
	notebooks.value.find(nb => nb.id === selectedNotebookId.value)
);

onShow(async () => {
	try {
		notebooks.value = await listNotebooks();
		if (notebooks.value.length > 0 && !selectedNotebookId.value) {
			selectedNotebookId.value = notebooks.value[0].id;
		}
	} catch (e: any) {
		errorMsg.value = e?.message || "加载错题本失败";
	}
});

function onNotebookChange(e: any) {
	const index = Number(e.detail.value);
	selectedNotebookId.value = notebooks.value[index]?.id || "";
}

function chooseImage(sourceType: "camera" | "album") {
	uni.chooseImage({
		count: 1,
		sizeType: ["compressed"],
		sourceType: [sourceType],
		success: (res) => {
			imagePath.value = res.tempFilePaths[0];
			result.value = null;
			errorMsg.value = "";
		},
	});
}

/** 读取所选图片为 base64 Data URL（H5 与小程序两条路径） */
function readImageAsBase64(filePath: string): Promise<string> {
	// #ifdef H5
	return fetch(filePath)
		.then(res => res.blob())
		.then(
			blob =>
				new Promise<string>((resolve, reject) => {
					const reader = new FileReader();
					reader.onload = () => resolve(reader.result as string);
					reader.onerror = () => reject(new Error("读取图片失败"));
					reader.readAsDataURL(blob);
				})
		);
	// #endif
	// #ifndef H5
	return new Promise((resolve, reject) => {
		uni.getFileSystemManager().readFile({
			filePath,
			encoding: "base64",
			success: res => resolve(`data:image/jpeg;base64,${res.data}`),
			fail: () => reject(new Error("读取图片失败")),
		});
	});
	// #endif
}

async function handleAnalyze() {
	if (!imagePath.value || !selectedNotebook.value) return;
	analyzing.value = true;
	errorMsg.value = "";
	result.value = null;
	try {
		const base64 = await readImageAsBase64(imagePath.value);
		result.value = await analyzeImage(base64, selectedNotebook.value.id);
	} catch (e: any) {
		errorMsg.value = e?.message || "AI 识别失败，请重试";
	} finally {
		analyzing.value = false;
	}
}

async function handleSave() {
	if (!result.value || !selectedNotebook.value) return;
	if (!result.value.questionText) {
		uni.showToast({ title: "未识别到题目内容", icon: "none" });
		return;
	}
	saving.value = true;
	try {
		const base64 = await readImageAsBase64(imagePath.value);
		const item = await createErrorItem({
			questionText: result.value.questionText || "",
			answerText: result.value.answerText || "",
			analysis: result.value.analysis || "",
			wrongAnswerText: result.value.wrongAnswerText || "",
			mistakeAnalysis: result.value.mistakeAnalysis || "",
			mistakeStatus: result.value.mistakeStatus,
			knowledgePoints: result.value.knowledgePoints || [],
			originalImageUrl: base64,
			subjectId: selectedNotebook.value.id,
		});
		uni.showToast({ title: "已保存", icon: "success" });
		result.value = null;
		imagePath.value = "";
		uni.navigateTo({ url: `/pages/detail/detail?id=${item.id}` });
	} catch (e: any) {
		uni.showToast({ title: e?.message || "保存失败", icon: "none" });
	} finally {
		saving.value = false;
	}
}
</script>

<style scoped>
.picker-value {
	background: #f3f4f6;
	border-radius: 12rpx;
	padding: 20rpx 24rpx;
	font-size: 28rpx;
}
.upload-actions {
	display: flex;
	gap: 20rpx;
	margin-bottom: 20rpx;
}
.action-btn {
	flex: 1;
}
.preview-image {
	width: 100%;
	height: 400rpx;
	border-radius: 12rpx;
	background: #f9fafb;
}
.analyze-btn {
	margin: 30rpx 24rpx;
}
.result-block {
	margin-bottom: 24rpx;
}
.result-label {
	display: block;
	font-size: 24rpx;
	color: #6b7280;
	margin-bottom: 8rpx;
}
.result-text {
	font-size: 28rpx;
	line-height: 1.6;
	white-space: pre-wrap;
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
.save-btn {
	margin-top: 10rpx;
}
</style>
