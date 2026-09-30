<template>
	<view class="page">
		<!-- 步骤一：选择错题本 -->
		<view class="card">
			<view class="step-head">
				<text class="step-no">1</text>
				<text class="step-title">选择错题本</text>
			</view>
			<picker :range="notebookNames" @change="onNotebookChange">
				<view class="picker-value" hover-class="hv">
					<text :class="selectedNotebook ? 'picker-text' : 'picker-placeholder'">
						{{ selectedNotebook?.name || "请选择错题本" }}
					</text>
					<text class="picker-arrow">›</text>
				</view>
			</picker>
		</view>

		<!-- 步骤二：拍摄题目 -->
		<view class="card">
			<view class="step-head">
				<text class="step-no">2</text>
				<text class="step-title">拍摄题目</text>
			</view>
			<view v-if="!imagePath" class="upload-zone" hover-class="hv" @tap="chooseImage('camera')">
				<view class="upload-icon">📷</view>
				<text class="upload-text">点击拍照</text>
				<text class="upload-hint">对准题目，光线充足效果更好</text>
			</view>
			<view v-else class="preview-wrap">
				<image :src="imagePath" class="preview-image" mode="aspectFit" @tap="preview" />
				<view class="preview-actions">
					<button class="btn-outline small-btn" hover-class="button-hover" @tap="chooseImage('camera')">重拍</button>
					<button class="btn-outline small-btn" hover-class="button-hover" @tap="chooseImage('album')">换一张</button>
				</view>
			</view>
			<view class="alt-row">
				<text class="alt-link" @tap="chooseImage('album')">从相册选择 →</text>
			</view>
		</view>

		<!-- 步骤三：AI 识别 -->
		<view class="card">
			<view class="step-head">
				<text class="step-no">3</text>
				<text class="step-title">AI 识别与保存</text>
			</view>

			<button
				class="btn-primary analyze-btn"
				:disabled="!imagePath || !selectedNotebook || analyzing"
				hover-class="button-hover"
				@tap="handleAnalyze"
			>
				<text v-if="analyzing">✦ AI 识别中，约需 10-30 秒...</text>
				<text v-else>开始 AI 识别</text>
			</button>
			<view v-if="errorMsg" class="error-tip">{{ errorMsg }}</view>

			<!-- 识别结果 -->
			<view v-if="result" class="result">
				<view class="result-block result-q">
					<text class="result-label">题目</text>
					<text class="result-text">{{ result.questionText || "（未识别到题目）" }}</text>
				</view>
				<view v-if="result.wrongAnswerText" class="result-block result-wrong">
					<text class="result-label">我的答案</text>
					<text class="result-text">{{ result.wrongAnswerText }}</text>
				</view>
				<view class="result-block result-right">
					<text class="result-label">正确答案</text>
					<text class="result-text">{{ result.answerText || "—" }}</text>
				</view>
				<view v-if="result.analysis" class="result-block">
					<text class="result-label">解析</text>
					<MdView :content="result.analysis" />
				</view>
				<view v-if="result.mistakeAnalysis" class="result-block">
					<text class="result-label">错因分析</text>
					<text class="result-text">{{ result.mistakeAnalysis }}</text>
				</view>
				<view v-if="result.knowledgePoints?.length" class="result-block">
					<text class="result-label">知识点</text>
					<view class="tag-row">
						<text v-for="tag in result.knowledgePoints" :key="tag" class="tag">{{ tag }}</text>
					</view>
				</view>

				<button class="btn-primary save-btn" :disabled="saving" hover-class="button-hover" @tap="handleSave">
					{{ saving ? "保存中..." : "保存到错题本" }}
				</button>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { listNotebooks, analyzeImage, createErrorItem, type Notebook, type ParsedQuestion } from "@/api";
import MdView from "@/components/MdView.vue";

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

function preview() {
	if (imagePath.value) {
		uni.previewImage({ urls: [imagePath.value] });
	}
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
.step-head {
	display: flex;
	align-items: center;
	margin-bottom: 24rpx;
}
.step-no {
	width: 40rpx;
	height: 40rpx;
	border-radius: 12rpx;
	background: linear-gradient(135deg, #fb923c, #f97316);
	color: #ffffff;
	font-size: 24rpx;
	font-weight: 700;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 16rpx;
}
.step-title {
	font-size: 30rpx;
	font-weight: 600;
	color: #1f2937;
}

.picker-value {
	background: #f5f6fa;
	border-radius: 14rpx;
	padding: 24rpx 26rpx;
	display: flex;
	justify-content: space-between;
	align-items: center;
}
.picker-text {
	font-size: 28rpx;
	color: #1f2937;
}
.picker-placeholder {
	font-size: 28rpx;
	color: #c4c9d4;
}
.picker-arrow {
	color: #d1d5db;
	font-size: 36rpx;
}

.upload-zone {
	border: 2rpx dashed #fdba74;
	background: #fffaf5;
	border-radius: 20rpx;
	padding: 56rpx 0;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.upload-icon {
	font-size: 64rpx;
	margin-bottom: 16rpx;
}
.upload-text {
	font-size: 30rpx;
	font-weight: 600;
	color: #ea580c;
}
.upload-hint {
	font-size: 22rpx;
	color: #c4c9d4;
	margin-top: 8rpx;
}

.preview-wrap {
	display: flex;
	flex-direction: column;
}
.preview-image {
	width: 100%;
	height: 400rpx;
	border-radius: 16rpx;
	background: #f9fafb;
}
.preview-actions {
	display: flex;
	gap: 20rpx;
	margin-top: 20rpx;
}
.small-btn {
	flex: 1;
	font-size: 26rpx;
	padding: 8rpx 0;
}
.alt-row {
	margin-top: 16rpx;
	text-align: center;
}
.alt-link {
	font-size: 26rpx;
	color: #f97316;
}

.analyze-btn {
	margin-top: 8rpx;
}
.result {
	margin-top: 32rpx;
	border-top: 2rpx solid #f3f4f6;
	padding-top: 28rpx;
}
.result-block {
	border-radius: 16rpx;
	padding: 22rpx 24rpx;
	margin-bottom: 20rpx;
	background: #f9fafb;
}
.result-q {
	background: #f5f6fa;
}
.result-wrong {
	background: #fef2f2;
}
.result-wrong .result-label {
	color: #ef4444;
}
.result-right {
	background: #f0fdf4;
}
.result-right .result-label {
	color: #16a34a;
}
.result-label {
	display: block;
	font-size: 22rpx;
	color: #9ca3af;
	font-weight: 600;
	margin-bottom: 10rpx;
	letter-spacing: 1rpx;
}
.result-text {
	font-size: 27rpx;
	line-height: 1.7;
	white-space: pre-wrap;
	color: #374151;
}
.tag-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}
.save-btn {
	margin-top: 12rpx;
}
.hv {
	opacity: 0.85;
}
</style>
