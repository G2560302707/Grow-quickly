<template>
	<view class="page">
		<!-- 步骤一：选择错题本 -->
		<view class="card fade-up">
			<view class="step-head">
				<text class="step-no num">1</text>
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
		<view class="card fade-up">
			<view class="step-head">
				<text class="step-no num">2</text>
				<text class="step-title">拍摄题目</text>
			</view>
			<view v-if="!imagePath" class="upload-zone" hover-class="hv" @tap="chooseImage('camera')">
				<view class="camera-glyph">
					<view class="camera-body">
						<view class="camera-lens" />
					</view>
					<view class="camera-hump" />
				</view>
				<text class="upload-text">点击拍照</text>
				<text class="upload-hint">支持整页多题，AI 自动定位题目</text>
			</view>
			<view v-else class="preview-wrap">
				<image :src="imagePath" class="preview-image" mode="aspectFit" @tap="preview" />
				<view class="preview-actions">
					<button class="btn-outline small-btn" hover-class="button-hover" @tap="chooseImage('camera')">重拍</button>
					<button class="btn-outline small-btn" hover-class="button-hover" @tap="chooseImage('album')">换一张</button>
					<button class="btn-outline small-btn" hover-class="button-hover" @tap="reopenCrop">重新框选</button>
				</view>
			</view>
			<view class="alt-row">
				<text class="alt-link" @tap="chooseImage('album')">从相册选择 →</text>
			</view>
		</view>

		<!-- 步骤三：AI 识别 -->
		<view class="card fade-up">
			<view class="step-head">
				<text class="step-no num">3</text>
				<text class="step-title">AI 识别与保存</text>
			</view>

			<button
				class="btn-primary analyze-btn"
				:disabled="!imagePath || !selectedNotebook || analyzing"
				hover-class="button-hover"
				@tap="handleAnalyze"
			>
				<text v-if="analyzing">AI 识别中，约需 10-30 秒...</text>
				<text v-else>开始 AI 识别</text>
			</button>
			<view v-if="errorMsg" class="error-tip analyze-error">{{ errorMsg }}</view>
			<view v-if="analyzing" class="analyzing-hint">
				<view class="pulse-dot" />
				<text class="analyzing-text">正在识别题目、答案与解析</text>
			</view>
		</view>

		<!-- 识别结果 -->
		<view v-if="result" class="card result fade-up">
			<view class="section-head">
				<text class="section-title">识别结果</text>
			</view>
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

		<!-- 裁剪 / 题号框选浮层 -->
		<CropOverlay
			:show="showCropOverlay"
			:src="originalPath"
			:questions="detected"
			:detecting="detecting"
			@close="onCropClose"
			@confirm="onCropConfirm"
		/>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import {
	listNotebooks,
	analyzeImage,
	createErrorItem,
	detectQuestions,
	type Notebook,
	type ParsedQuestion,
	type DetectedQuestionBox,
} from "@/api";
import MdView from "@/components/MdView.vue";
import CropOverlay from "@/components/crop-overlay.vue";

const notebooks = ref<Notebook[]>([]);
const selectedNotebookId = ref("");
const imagePath = ref("");
const analyzing = ref(false);
const saving = ref(false);
const errorMsg = ref("");
const result = ref<ParsedQuestion | null>(null);

// 整页原图与题目定位（用于框选/重框选/连续录题）
const originalPath = ref("");
const showCropOverlay = ref(false);
const detected = ref<DetectedQuestionBox[]>([]);
const detecting = ref(false);

const notebookNames = computed(() => notebooks.value.map(nb => nb.name));
const selectedNotebook = computed(() =>
	notebooks.value.find(nb => nb.id === selectedNotebookId.value)
);

onShow(async () => {
	try {
		const list = await listNotebooks();
		notebooks.value = Array.isArray(list) ? list : [];
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
			originalPath.value = res.tempFilePaths[0];
			result.value = null;
			errorMsg.value = "";
			detected.value = [];
			// 打开裁剪浮层并同时请求 AI 题目定位
			showCropOverlay.value = true;
			startDetect();
		},
	});
}

/** 请求 AI 定位整页中的各题位置；失败时浮层回退为自由框选 */
async function startDetect() {
	detecting.value = true;
	try {
		const base64 = await readImageAsBase64(originalPath.value);
		const res = await detectQuestions(base64);
		detected.value = res?.questions || [];
	} catch (e) {
		detected.value = [];
	} finally {
		detecting.value = false;
	}
}

/** 保存成功后对同一张原图继续框选下一题 */
function reopenCrop() {
	if (!originalPath.value) return;
	result.value = null;
	errorMsg.value = "";
	showCropOverlay.value = true;
}

function onCropClose() {
	showCropOverlay.value = false;
}

function onCropConfirm(payload: { path: string; autoStart: boolean }) {
	imagePath.value = payload.path;
	showCropOverlay.value = false;
	result.value = null;
	errorMsg.value = "";
	if (payload.autoStart) {
		handleAnalyze();
	}
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
		// 同一张图可能还有其他题：询问是否继续框选
		uni.showModal({
			title: "已保存",
			content: "继续用这张图框选下一题吗？",
			confirmText: "继续框选",
			cancelText: "查看详情",
			success: (m) => {
				if (m.confirm && originalPath.value) {
					imagePath.value = originalPath.value;
					showCropOverlay.value = true;
				} else {
					imagePath.value = "";
					originalPath.value = "";
					detected.value = [];
					uni.navigateTo({ url: `/pages/detail/detail?id=${item.id}` });
				}
			},
		});
	} catch (e: any) {
		uni.showToast({ title: e?.message || "保存失败", icon: "none" });
	} finally {
		saving.value = false;
	}
}
</script>

<style scoped>
/* ---------- 步骤 ---------- */
.step-head {
	display: flex;
	align-items: center;
	margin-bottom: 24rpx;
}
.step-no {
	width: 44rpx;
	height: 44rpx;
	border-radius: 14rpx;
	background: var(--brand-50);
	border: 1rpx solid var(--brand-100);
	color: var(--brand-600);
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
	color: var(--ink-900);
	letter-spacing: 1rpx;
}

/* ---------- 选择器 ---------- */
.picker-value {
	background: var(--bg-fill);
	border-radius: 16rpx;
	padding: 24rpx 28rpx;
	display: flex;
	justify-content: space-between;
	align-items: center;
}
.picker-text {
	font-size: 28rpx;
	color: var(--ink-900);
}
.picker-placeholder {
	font-size: 28rpx;
	color: var(--ink-300);
}
.picker-arrow {
	color: var(--ink-300);
	font-size: 36rpx;
}
.hv {
	opacity: 0.85;
}

/* ---------- 上传区 ---------- */
.upload-zone {
	border: 2rpx dashed var(--brand-100);
	background: var(--brand-50);
	border-radius: 20rpx;
	padding: 60rpx 0;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.camera-glyph {
	position: relative;
	width: 112rpx;
	height: 88rpx;
	margin-bottom: 24rpx;
}
.camera-body {
	position: absolute;
	left: 0;
	right: 0;
	top: 12rpx;
	bottom: 0;
	border: 4rpx solid var(--brand-600);
	border-radius: 18rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.camera-lens {
	width: 32rpx;
	height: 32rpx;
	border: 4rpx solid var(--brand-600);
	border-radius: 50%;
}
.camera-hump {
	position: absolute;
	top: 0;
	left: 50%;
	transform: translateX(-50%);
	width: 36rpx;
	height: 14rpx;
	border: 4rpx solid var(--brand-600);
	border-bottom: none;
	border-radius: 8rpx 8rpx 0 0;
	background: var(--brand-50);
}
.upload-text {
	font-size: 30rpx;
	font-weight: 600;
	color: var(--brand-600);
}
.upload-hint {
	font-size: 22rpx;
	color: var(--ink-400);
	margin-top: 10rpx;
}

/* ---------- 预览 ---------- */
.preview-wrap {
	display: flex;
	flex-direction: column;
}
.preview-image {
	width: 100%;
	height: 400rpx;
	border-radius: 16rpx;
	background: var(--bg-fill);
}
.preview-actions {
	display: flex;
	gap: 20rpx;
	margin-top: 20rpx;
}
.small-btn {
	flex: 1;
	font-size: 26rpx;
	padding: 0;
	height: 72rpx;
	line-height: 72rpx;
}
.alt-row {
	margin-top: 16rpx;
	text-align: center;
}
.alt-link {
	font-size: 26rpx;
	color: var(--brand-600);
}

/* ---------- 识别 ---------- */
.analyze-btn {
	margin-top: 8rpx;
}
.analyze-error {
	margin: 24rpx 0 0;
}
.analyzing-hint {
	display: flex;
	align-items: center;
	justify-content: center;
	margin-top: 24rpx;
}
.pulse-dot {
	width: 14rpx;
	height: 14rpx;
	border-radius: 50%;
	background: var(--brand-600);
	margin-right: 14rpx;
	animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse {
	0%,
	100% {
		opacity: 0.25;
		transform: scale(0.8);
	}
	50% {
		opacity: 1;
		transform: scale(1.15);
	}
}
.analyzing-text {
	font-size: 24rpx;
	color: var(--ink-400);
}

/* ---------- 结果 ---------- */
.result-block {
	border-radius: 16rpx;
	padding: 24rpx 26rpx;
	margin-bottom: 20rpx;
	background: var(--bg-fill);
	border-left: 6rpx solid var(--brand-500);
}
.result-q {
	background: var(--brand-50);
	border-left-color: var(--brand-600);
}
.result-wrong {
	background: var(--danger-50);
	border-left-color: var(--danger-600);
}
.result-wrong .result-label {
	color: var(--danger-600);
}
.result-right {
	background: var(--success-50);
	border-left-color: var(--success-600);
}
.result-right .result-label {
	color: var(--success-600);
}
.result-label {
	display: block;
	font-size: 22rpx;
	color: var(--ink-500);
	font-weight: 600;
	margin-bottom: 12rpx;
	letter-spacing: 2rpx;
}
.result-text {
	font-size: 27rpx;
	line-height: 1.7;
	white-space: pre-wrap;
	color: var(--ink-700);
}
.tag-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}
.save-btn {
	margin-top: 12rpx;
}
</style>
