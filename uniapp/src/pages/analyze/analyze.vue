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
			<view v-if="uncertainty.uncertain" class="warn-box">
				<text class="warn-title">⚠️ 识别可能不准确，请对照原图核对</text>
				<text v-for="s in uncertainty.signals" :key="s.key" class="warn-item">· {{ s.message }}</text>
				<text class="warn-hint">点题目右侧「编辑」修正文本后再「重新解答」</text>
			</view>
			<view class="result-block result-q">
				<view class="result-label-row">
					<text class="result-label">题目</text>
					<text v-if="!editingQuestion" class="edit-link" @tap="startEditQuestion">✏️ 编辑</text>
				</view>
				<textarea
					v-if="editingQuestion"
					v-model="editedQuestionText"
					class="question-editor"
					:maxlength="-1"
					auto-height
					:disabled="reanswering"
				/>
				<text v-else class="result-text">{{ result.questionText || "（未识别到题目）" }}</text>
				<view v-if="editingQuestion" class="edit-actions">
					<button class="btn-outline small-btn" :disabled="reanswering" hover-class="button-hover" @tap="cancelEditQuestion">
						取消
					</button>
					<button
						class="btn-primary small-btn"
						:disabled="reanswering || !editedQuestionText.trim()"
						hover-class="button-hover"
						@tap="handleReanswer"
					>
						<text v-if="reanswering">AI 重新解答中…</text>
						<text v-else>🔄 重新解答</text>
					</button>
				</view>
				<text v-if="editingQuestion" class="edit-hint">修正题目后点「重新解答」，答案与解析会按修正后的题目重新生成</text>
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
	reanswerQuestion,
	type Notebook,
	type ParsedQuestion,
	type DetectedQuestionBox,
} from "@/api";
import MdView from "@/components/MdView.vue";
import CropOverlay from "@/components/crop-overlay.vue";
import { detectUncertainty } from "@/utils/uncertainty";

const notebooks = ref<Notebook[]>([]);
const selectedNotebookId = ref("");
const imagePath = ref("");
const analyzing = ref(false);
const saving = ref(false);
const errorMsg = ref("");
const result = ref<ParsedQuestion | null>(null);

// 题目校正与重新解答：识别结果可能转录错误（数字/选项），用户修正文本后按新题目重出答案
const editingQuestion = ref(false);
const editedQuestionText = ref("");
const reanswering = ref(false);
// 当前 imagePath 对应的 base64，识别后复用给重新解答（避免重复读文件）
const imageBase64Cache = ref("");

// 整页原图与题目定位（用于框选/重框选/连续录题）
const originalPath = ref("");
const showCropOverlay = ref(false);
const detected = ref<DetectedQuestionBox[]>([]);
const detecting = ref(false);

const notebookNames = computed(() => notebooks.value.map(nb => nb.name));
const selectedNotebook = computed(() =>
	notebooks.value.find(nb => nb.id === selectedNotebookId.value)
);
const uncertainty = computed(() =>
	detectUncertainty({
		questionText: result.value?.questionText,
		answerText: result.value?.answerText,
		analysis: result.value?.analysis,
	})
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
			editingQuestion.value = false;
			imageBase64Cache.value = "";
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
	editingQuestion.value = false;
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
	editingQuestion.value = false;
	imageBase64Cache.value = "";
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
	editingQuestion.value = false;
	try {
		const base64 = await readImageAsBase64(imagePath.value);
		imageBase64Cache.value = base64;
		result.value = await analyzeImage(base64, selectedNotebook.value.id);
	} catch (e: any) {
		errorMsg.value = e?.message || "AI 识别失败，请重试";
	} finally {
		analyzing.value = false;
	}
}

function startEditQuestion() {
	if (!result.value) return;
	editedQuestionText.value = result.value.questionText || "";
	editingQuestion.value = true;
}

function cancelEditQuestion() {
	editingQuestion.value = false;
}

/** 重新解答：按校正后的题目文本重出答案与解析（复用网页端 /api/reanswer，AI 调用较慢） */
async function handleReanswer() {
	const questionText = editedQuestionText.value.trim();
	if (!result.value || !questionText || reanswering.value) return;
	reanswering.value = true;
	try {
		let base64 = imageBase64Cache.value;
		if (!base64 && imagePath.value) {
			base64 = await readImageAsBase64(imagePath.value);
			imageBase64Cache.value = base64;
		}
		const updated = await reanswerQuestion({
			questionText,
			subject: result.value.subject || "",
			imageBase64: base64 || undefined,
		}, { timeout: 180000 });
		result.value = {
			...result.value,
			questionText,
			answerText: updated.answerText,
			analysis: updated.analysis,
			knowledgePoints: updated.knowledgePoints || [],
			wrongAnswerText: updated.wrongAnswerText || "",
			mistakeAnalysis: updated.mistakeAnalysis || "",
			mistakeStatus: (updated.wrongAnswerText || "").trim()
				? "wrong_attempt"
				: (updated.mistakeStatus || "unknown"),
		};
		editingQuestion.value = false;
		uni.showToast({ title: "已重新解答", icon: "success" });
	} catch (e: any) {
		uni.showToast({ title: e?.message || "重新解答失败，请重试", icon: "none" });
	} finally {
		reanswering.value = false;
	}
}

async function handleSave() {
	if (!result.value || !selectedNotebook.value) return;
	// 编辑态直接保存：采纳已修正的题目文本（答案/解析仍为当前识别结果）
	if (editingQuestion.value) {
		result.value.questionText = editedQuestionText.value;
		editingQuestion.value = false;
	}
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
.warn-box {
	display: flex;
	flex-direction: column;
	background: var(--warning-50);
	border: 1rpx solid var(--warning-600);
	border-radius: 16rpx;
	padding: 20rpx 24rpx;
	margin-bottom: 20rpx;
}
.warn-title {
	font-size: 26rpx;
	font-weight: 600;
	color: var(--warning-600);
	margin-bottom: 10rpx;
}
.warn-item {
	font-size: 24rpx;
	line-height: 1.7;
	color: var(--warning-600);
}
.warn-hint {
	font-size: 22rpx;
	color: var(--ink-400);
	margin-top: 10rpx;
}
.result-label-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 12rpx;
}
.result-label-row .result-label {
	margin-bottom: 0;
}
.edit-link {
	font-size: 24rpx;
	color: var(--brand-600);
	font-weight: 600;
}
.question-editor {
	width: 100%;
	min-height: 160rpx;
	font-size: 27rpx;
	line-height: 1.7;
	color: var(--ink-700);
	background: var(--bg-fill);
	border-radius: 12rpx;
	padding: 16rpx 20rpx;
	box-sizing: border-box;
}
.edit-actions {
	display: flex;
	gap: 20rpx;
	margin-top: 20rpx;
}
.edit-hint {
	display: block;
	font-size: 22rpx;
	color: var(--ink-400);
	margin-top: 14rpx;
}
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
