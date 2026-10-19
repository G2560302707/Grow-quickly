<template>
	<view :class="['page', themeCls]">
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
			<!-- 多图模式：一道题跨多张，按顺序拼接成完整题目 -->
			<template v-if="isMultiMode">
				<view class="multi-tip">
					已选 {{ multiImages.length }}/{{ MAX_MULTI }} 张，将按 1→{{ multiImages.length }} 顺序纵向拼接后整体识别。
				</view>
				<view class="multi-list">
					<view v-for="(img, idx) in multiImages" :key="img.path + '-' + idx" class="multi-item">
						<text class="multi-idx">{{ idx + 1 }}</text>
						<image :src="img.path" class="multi-thumb" mode="aspectFill" @tap="previewImageList(idx)" />
						<view class="multi-meta">
							<text class="multi-name">第 {{ idx + 1 }} 张</text>
						</view>
						<view class="multi-ctrls">
							<text
								class="multi-btn"
								:class="{ 'multi-btn-disabled': idx === 0 || analyzing }"
								@tap="moveMulti(idx, -1)"
							>↑</text>
							<text
								class="multi-btn"
								:class="{ 'multi-btn-disabled': idx === multiImages.length - 1 || analyzing }"
								@tap="moveMulti(idx, 1)"
							>↓</text>
							<text
								class="multi-btn multi-btn-danger"
								:class="{ 'multi-btn-disabled': analyzing }"
								@tap="removeMulti(idx)"
							>✕</text>
						</view>
					</view>
				</view>
				<view class="multi-actions">
					<button
						class="btn-outline small-btn"
						:disabled="analyzing || multiImages.length >= MAX_MULTI"
						hover-class="button-hover"
						@tap="addMoreImages"
					>添加更多{{ multiImages.length < MAX_MULTI ? `（还可加 ${MAX_MULTI - multiImages.length} 张）` : "" }}</button>
					<button class="btn-outline small-btn" :disabled="analyzing" hover-class="button-hover" @tap="resetMulti">清空重选</button>
				</view>
				<view class="alt-row">
					<text class="alt-link" @tap="addMoreImages">继续从相册选择 →</text>
				</view>
			</template>
			<!-- 单图模式：一张整页图，AI 定位/框选/裁剪 -->
			<template v-else>
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
			</template>
		</view>

		<!-- 步骤三：选择解析方式并识别 -->
		<view class="card fade-up">
			<view class="step-head">
				<text class="step-no num">3</text>
				<text class="step-title">选择解析方式并识别</text>
			</view>

			<!-- 解析方式二选一：AI 解析 / 上传解析图 -->
			<view class="mode-pills">
				<view class="mode-pill" :class="{ active: explainMode === 'ai' }" hover-class="hv" @tap="explainMode = 'ai'">
					<text>AI 解析</text>
				</view>
				<view class="mode-pill" :class="{ active: explainMode === 'upload' }" hover-class="hv" @tap="explainMode = 'upload'">
					<text>上传解析图</text>
				</view>
			</view>
			<text class="mode-hint">{{ explainMode === 'ai' ? "识别题干、答案与解析，均由 AI 生成" : "AI 只识别题干与答案；解析从你上传的解析图提取，可不上传" }}</text>

			<button
				class="btn-primary analyze-btn"
				:disabled="(!isMultiMode && !imagePath) || (isMultiMode && multiImages.length < 2) || !selectedNotebook || analyzing"
				hover-class="button-hover"
				@tap="handleAnalyze"
			>
				<text v-if="analyzing">{{ isMultiMode ? "正在拼接识别..." : "AI 识别中，约需 10-30 秒..." }}</text>
				<text v-else>{{ isMultiMode
					? (explainMode === 'upload' ? "合并并识别（随后上传解析图）" : "合并并识别")
					: (explainMode === 'upload' ? "识别题目（随后上传解析图）" : "开始 AI 识别") }}</text>
			</button>
			<view v-if="errorMsg" class="error-tip analyze-error">{{ errorMsg }}</view>
			<view v-if="analyzing" class="analyzing-hint">
				<view class="pulse-dot" />
				<text class="analyzing-text">{{ explainMode === 'upload' ? "正在识别题目与答案" : "正在识别题目、答案与解析" }}</text>
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
				<MdRich v-else :content="result.questionText" />
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
				<MdRich :content="result.wrongAnswerText" />
			</view>
			<view class="result-block result-right">
				<text class="result-label">正确答案</text>
				<MdRich :content="result.answerText" />
			</view>
			<view class="result-block">
				<view class="result-label-row">
					<text class="result-label">解析</text>
					<text v-if="explainMode === 'upload' && ocrText" class="edit-link" @tap="pickExplainImage">重新上传解析图</text>
				</view>
				<template v-if="explainMode === 'ai'">
					<MdRich v-if="result.analysis" :content="result.analysis" />
					<text v-else class="tag-hint">AI 未返回解析内容</text>
				</template>
				<template v-else>
					<view v-if="!ocrText && !ocrUploading" class="ocr-upload" hover-class="hv" @tap="pickExplainImage">
						<text class="ocr-upload-plus">＋</text>
						<text class="ocr-upload-text">拍摄或上传解析图</text>
						<text class="ocr-upload-hint">教材答案页、老师板书、解析册均可；解析可留空</text>
					</view>
					<view v-if="ocrUploading" class="analyzing-hint">
						<view class="pulse-dot" />
						<text class="analyzing-text">正在提取解析文字...</text>
					</view>
					<view v-if="ocrError" class="error-tip">{{ ocrError }}</view>
					<template v-if="ocrText">
						<textarea v-model="ocrText" class="ocr-edit" :maxlength="-1" auto-height disabled-color="#ffffff" />
						<text class="tag-hint">以上为解析图转录结果，可直接修改；不上传也能直接保存</text>
					</template>
				</template>
			</view>
			<view v-if="result.mistakeAnalysis" class="result-block">
				<text class="result-label">错因分析</text>
				<MdRich :content="result.mistakeAnalysis" />
			</view>
			<view class="result-block">
				<view class="result-label-row">
					<text class="result-label">考点标签</text>
					<text class="edit-link" @tap="goTagsManage">管理考点树</text>
				</view>
				<view v-if="needsTagImport" class="tag-import-tip">
					<text>尚未导入个人考点树，</text>
					<text class="alt-link" @tap="goTagsManage">去导入 →</text>
				</view>
				<template v-else>
					<text class="tag-hint">点选叶子考点（可多选）；已自动勾选与 AI 匹配的项</text>
					<view class="tag-row">
						<text
							v-for="leaf in leafTags"
							:key="leaf.id"
							class="tag tag-pick"
							:class="{ 'tag-picked': selectedTagNames.includes(leaf.name) }"
							@tap="toggleTag(leaf.name)"
						>{{ leaf.name }}</text>
					</view>
					<text v-if="!leafTags.length" class="tag-hint">考点树没有可选叶子，请先到考点管理添加</text>
				</template>
			</view>

			<button class="btn-primary save-btn" :disabled="saving || needsTagImport" hover-class="button-hover" @tap="handleSave">
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
import { useThemeClass } from "@/utils/theme";

const themeCls = useThemeClass();
import { ref, computed } from "vue";
import { isGuest, showLoginGuide } from "@/utils/guest";
import { onShow } from "@dcloudio/uni-app";
import {
	listNotebooks,
	analyzeImage,
	analyzeMultiImages,
	ocrExplainImage,
	createErrorItem,
	detectQuestions,
	reanswerQuestion,
	getUserTagTree,
	collectTagLeaves,
	type Notebook,
	type ParsedQuestion,
	type DetectedQuestionBox,
	type TagLeaf,
} from "@/api";
import MdRich from "@/components/MdRich.vue";
import CropOverlay from "@/components/crop-overlay.vue";
import { detectUncertainty } from "@/utils/uncertainty";

const notebooks = ref<Notebook[]>([]);
const selectedNotebookId = ref("");
const imagePath = ref("");
const analyzing = ref(false);
const saving = ref(false);
const errorMsg = ref("");
const result = ref<ParsedQuestion | null>(null);
const leafTags = ref<TagLeaf[]>([]);
const needsTagImport = ref(false);
const selectedTagNames = ref<string[]>([]);

// 题目校正与重新解答：识别结果可能转录错误（数字/选项），用户修正文本后按新题目重出答案
const editingQuestion = ref(false);
const editedQuestionText = ref("");
const reanswering = ref(false);
// 当前 imagePath 对应的 base64，识别后复用给重新解答（避免重复读文件）
const imageBase64Cache = ref("");

// 解析方式二选一：ai=AI 生成解析（默认，全流程不变）；upload=AI 只识别题干答案，解析由用户上传解析图 OCR 提取
const explainMode = ref<"ai" | "upload">("ai");
const ocrText = ref(""); // 解析图转录文本（可编辑）
const ocrUploading = ref(false);
const ocrError = ref("");

// 多图拼接模式（单题跨多张）：待拼接图片列表与合并图缓存（保存原图用）
const MAX_MULTI = 5;
const multiImages = ref<{ path: string }[]>([]);
const mergedImageBase64Cache = ref("");
const isMultiMode = computed(() => multiImages.value.length >= 2);

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

async function loadTagTree() {
	try {
		const data = await getUserTagTree();
		const tags = data.tags || [];
		needsTagImport.value = !!data.needsImport || tags.length === 0;
		leafTags.value = collectTagLeaves(tags);
	} catch {
		needsTagImport.value = true;
		leafTags.value = [];
	}
}

function syncSelectedFromAi(aiPoints?: string[]) {
	const leaves = leafTags.value;
	if (!leaves.length) {
		selectedTagNames.value = [];
		return;
	}
	const leafSet = new Map(leaves.map((l) => [l.name.toLowerCase(), l.name]));
	const picked: string[] = [];
	for (const p of aiPoints || []) {
		const hit = leafSet.get(String(p).trim().toLowerCase());
		if (hit && !picked.includes(hit)) picked.push(hit);
	}
	selectedTagNames.value = picked;
}

function toggleTag(name: string) {
	const i = selectedTagNames.value.indexOf(name);
	if (i >= 0) selectedTagNames.value = selectedTagNames.value.filter((n) => n !== name);
	else selectedTagNames.value = [...selectedTagNames.value, name];
}

function goTagsManage() {
	uni.navigateTo({ url: "/pages/tags/tags" });
}

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
	await loadTagTree();
	if (result.value) syncSelectedFromAi(result.value.knowledgePoints);
});

function onNotebookChange(e: any) {
	const index = Number(e.detail.value);
	selectedNotebookId.value = notebooks.value[index]?.id || "";
}

/** 进入单图流程：1 张整页图 → 框选/裁剪 → 识别 */
function enterSingle(path: string) {
	multiImages.value = [];
	mergedImageBase64Cache.value = "";
	imagePath.value = path;
	originalPath.value = path;
	result.value = null;
	errorMsg.value = "";
	detected.value = [];
	editingQuestion.value = false;
	imageBase64Cache.value = "";
	// 打开裁剪浮层并同时请求 AI 题目定位
	showCropOverlay.value = true;
	startDetect();
}

/** 进入多图拼接流程：≥2 张按顺序纵向拼接成一道完整题目，跳过框选/裁剪 */
function enterMulti(paths: string[]) {
	imagePath.value = "";
	originalPath.value = "";
	showCropOverlay.value = false;
	detected.value = [];
	result.value = null;
	errorMsg.value = "";
	editingQuestion.value = false;
	imageBase64Cache.value = "";
	mergedImageBase64Cache.value = "";
	multiImages.value = paths.slice(0, MAX_MULTI).map(p => ({ path: p }));
}

function chooseImage(sourceType: "camera" | "album") {
	// 相册支持一次多选（最多 5 张）；相机一次一张
	const isMultiPick = sourceType === "album";
	uni.chooseImage({
		count: isMultiPick ? MAX_MULTI : 1,
		sizeType: ["compressed"],
		sourceType: [sourceType],
		success: (res) => {
			const raw = res.tempFilePaths;
			const files = Array.isArray(raw) ? raw : raw != null ? [raw] : [] as string[];
			if (files.length >= 2) {
				enterMulti(files);
			} else if (files.length === 1) {
				enterSingle(files[0]);
			}
		},
	});
}

/** 多图模式：继续追加照片（最多 MAX_MULTI 张） */
function addMoreImages() {
	const remaining = MAX_MULTI - multiImages.value.length;
	if (remaining <= 0) return;
	uni.chooseImage({
		count: remaining,
		sizeType: ["compressed"],
		sourceType: ["album"],
		success: (res) => {
			const raw = res.tempFilePaths || [];
			const files = (Array.isArray(raw) ? raw : [raw] as string[]).slice(0, remaining);
			if (!files.length) return;
			multiImages.value = [
				...multiImages.value,
				...files.map(p => ({ path: p })),
			];
			mergedImageBase64Cache.value = ""; // 图片变了，旧的拼接图作废
		},
	});
}

function removeMulti(index: number) {
	if (analyzing.value) return;
	mergedImageBase64Cache.value = ""; // 图片变了，旧的拼接图作废
	multiImages.value = multiImages.value.filter((_, i) => i !== index);
	if (multiImages.value.length === 1) {
		// 只剩 1 张时退回单图流程，保留该图继续框选
		enterSingle(multiImages.value[0].path);
	}
}

function moveMulti(index: number, dir: -1 | 1) {
	if (analyzing.value) return;
	mergedImageBase64Cache.value = ""; // 顺序变了，旧图作废
	const target = index + dir;
	if (target < 0 || target >= multiImages.value.length) return;
	const next = [...multiImages.value];
	[next[index], next[target]] = [next[target], next[index]];
	multiImages.value = next;
}

function resetMulti() {
	multiImages.value = [];
	mergedImageBase64Cache.value = "";
	imagePath.value = "";
	originalPath.value = "";
	result.value = null;
	errorMsg.value = "";
	detected.value = [];
}

function previewImageList(index: number) {
	uni.previewImage({ urls: multiImages.value.map(i => i.path), current: index });
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

/**
 * 「上传解析图」模式：拍摄/相册选一张解析图 → /api/ocr-explain 逐字转录 → 可编辑文本。
 * 不上传也允许保存（解析留空）。
 */
function pickExplainImage() {
	if (isGuest()) {
		showLoginGuide("解析图识别");
		return;
	}
	uni.showActionSheet({
		itemList: ["拍照", "从相册选择"],
		success: res => {
			const sourceType = res.tapIndex === 0 ? "camera" : "album";
			uni.chooseImage({
				count: 1,
				sizeType: ["compressed"],
				sourceType: [sourceType],
				success: async r => {
					const path = (r.tempFilePaths || [])[0];
					if (!path) return;
					ocrError.value = "";
					ocrUploading.value = true;
					try {
						const base64 = await readImageAsBase64(path);
						const data = await ocrExplainImage(base64);
						ocrText.value = (data.text || "").trim();
						if (!ocrText.value) {
							ocrError.value = "未能从图片提取到文字，请换一张更清晰的图片";
						}
					} catch (e: any) {
						ocrError.value = e?.message || "解析图识别失败，请重试";
					} finally {
						ocrUploading.value = false;
					}
				},
			});
		},
	});
}

async function handleAnalyze() {
	if (isGuest()) {
		showLoginGuide("AI 识别");
		return;
	}
	if (isMultiMode.value) {
		return handleMultiAnalyze();
	}
	if (!imagePath.value || !selectedNotebook.value) return;
	analyzing.value = true;
	errorMsg.value = "";
	result.value = null;
	editingQuestion.value = false;
	ocrText.value = "";
	ocrError.value = "";
	try {
		const base64 = await readImageAsBase64(imagePath.value);
		imageBase64Cache.value = base64;
		result.value = await analyzeImage(base64, selectedNotebook.value.id, explainMode.value === "upload" ? "skip" : "ai");
		syncSelectedFromAi(result.value?.knowledgePoints);
	} catch (e: any) {
		errorMsg.value = e?.message || "AI 识别失败，请重试";
	} finally {
		analyzing.value = false;
	}
}

/** 多图拼接识别：每张转 base64 → 后端 images[] 拼接成完整题目 → 整体识别；合并图作为原图 */
async function handleMultiAnalyze() {
	if (isGuest()) {
		showLoginGuide("AI 识别");
		return;
	}
	if (multiImages.value.length < 2 || !selectedNotebook.value) return;
	analyzing.value = true;
	errorMsg.value = "";
	result.value = null;
	editingQuestion.value = false;
	ocrText.value = "";
	ocrError.value = "";
	try {
		const imagesPayload: { base64: string; mimeType: string }[] = [];
		for (const img of multiImages.value) {
			const base64 = await readImageAsBase64(img.path);
			imagesPayload.push({ base64, mimeType: "image/jpeg" });
		}
		const data = await analyzeMultiImages(imagesPayload, selectedNotebook.value.id, explainMode.value === "upload" ? "skip" : "ai");
		// 以拼接后的完整图为原图（重新解答与保存都复用）
		mergedImageBase64Cache.value = data.mergedImageBase64 || "";
		imageBase64Cache.value = mergedImageBase64Cache.value;
		result.value = data;
		syncSelectedFromAi(result.value?.knowledgePoints);
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
	if (isGuest()) {
		showLoginGuide("重新解答");
		return;
	}
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
		syncSelectedFromAi(updated.knowledgePoints);
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
	if (needsTagImport.value) {
		uni.showToast({ title: "请先导入考点树", icon: "none" });
		return;
	}
	// 编辑态直接保存：采纳已修正的题目文本（答案/解析仍为当前识别结果）
	if (editingQuestion.value) {
		result.value.questionText = editedQuestionText.value;
		editingQuestion.value = false;
	}
	if (!result.value.questionText) {
		uni.showToast({ title: "未识别到题目内容", icon: "none" });
		return;
	}
	if (!selectedTagNames.value.length) {
		uni.showToast({ title: "请至少选择一个考点", icon: "none" });
		return;
	}
	saving.value = true;
	try {
		// 原图：多图模式用拼接后的完整图；单图模式用当前图 base64
		let base64: string;
		if (isMultiMode.value) {
			if (!mergedImageBase64Cache.value) {
				uni.showToast({ title: "缺少拼接图，请重新识别", icon: "none" });
				saving.value = false;
				return;
			}
			base64 = mergedImageBase64Cache.value;
		} else {
			base64 = await readImageAsBase64(imagePath.value);
		}
		// 解析：AI 模式取 AI 结果；上传模式取 OCR 转录文本（可空，允许不上传直接保存）
		const analysisFinal = explainMode.value === "upload"
			? ocrText.value.trim()
			: (result.value.analysis || "");
		const item = await createErrorItem({
			questionText: result.value.questionText || "",
			answerText: result.value.answerText || "",
			analysis: analysisFinal,
			wrongAnswerText: result.value.wrongAnswerText || "",
			mistakeAnalysis: result.value.mistakeAnalysis || "",
			mistakeStatus: result.value.mistakeStatus,
			knowledgePoints: selectedTagNames.value,
			originalImageUrl: base64,
			subjectId: selectedNotebook.value.id,
			explanationSource: explainMode.value === "upload" ? (analysisFinal ? "ocr" : null) : "ai",
		});
		uni.showToast({ title: "已保存", icon: "success" });
		result.value = null;
		selectedTagNames.value = [];
		imageBase64Cache.value = "";
		if (isMultiMode.value) {
			// 多图模式没有可复用的单张原图，直接回详情
			multiImages.value = [];
			mergedImageBase64Cache.value = "";
			uni.navigateTo({ url: `/pages/detail/detail?id=${item.id}` });
			return;
		}
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

/* ---------- 多图拼接 ---------- */
.multi-tip {
	font-size: 24rpx;
	color: var(--ink-400);
	line-height: 1.5;
	margin-bottom: 16rpx;
}
.multi-list {
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}
.multi-item {
	display: flex;
	align-items: center;
	gap: 16rpx;
	background: var(--bg-fill);
	border-radius: 16rpx;
	padding: 16rpx;
}
.multi-idx {
	width: 44rpx;
	height: 44rpx;
	border-radius: 50%;
	background: var(--brand-600);
	color: #ffffff;
	font-size: 24rpx;
	font-weight: 600;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}
.multi-thumb {
	width: 96rpx;
	height: 128rpx;
	border-radius: 8rpx;
	background: #eef0f3;
	flex-shrink: 0;
}
.multi-meta {
	flex: 1;
	min-width: 0;
}
.multi-name {
	font-size: 24rpx;
	color: var(--ink-700);
}
.multi-ctrls {
	display: flex;
	gap: 12rpx;
	flex-shrink: 0;
}
.multi-btn {
	width: 56rpx;
	height: 56rpx;
	line-height: 56rpx;
	text-align: center;
	border-radius: 12rpx;
	background: var(--bg-fill);
	border: 1rpx solid var(--brand-100);
	color: var(--brand-600);
	font-size: 28rpx;
}
.multi-btn-danger {
	color: var(--danger-600, #ff4d4f);
	border-color: var(--danger-100, #ffd6d6);
}
.multi-btn-disabled {
	opacity: 0.4;
}
.multi-actions {
	display: flex;
	gap: 20rpx;
	margin-top: 20rpx;
}

/* ---------- 解析方式二选一 ---------- */
.mode-pills {
	display: flex;
	gap: 16rpx;
	margin-top: 20rpx;
}
.mode-pill {
	flex: 1;
	text-align: center;
	padding: 18rpx 0;
	border-radius: 14rpx;
	border: 1rpx solid var(--line-100);
	background: var(--bg-fill);
	font-size: 27rpx;
	color: var(--ink-500);
}
.mode-pill.active {
	background: var(--brand-50);
	border-color: var(--brand-600);
	color: var(--brand-600);
	font-weight: 600;
}
.mode-hint {
	display: block;
	margin-top: 14rpx;
	font-size: 22rpx;
	line-height: 1.6;
	color: var(--ink-400);
}

/* ---------- 识别 ---------- */
.analyze-btn {
	margin-top: 24rpx;
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

/* ---------- 上传解析图 ---------- */
.ocr-upload {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 44rpx 24rpx;
	border: 2rpx dashed var(--line-100);
	border-radius: 16rpx;
	background: var(--bg-fill);
}
.ocr-upload-plus {
	font-size: 52rpx;
	line-height: 1;
	color: var(--brand-600);
	margin-bottom: 14rpx;
}
.ocr-upload-text {
	font-size: 28rpx;
	font-weight: 600;
	color: var(--ink-600);
	margin-bottom: 8rpx;
}
.ocr-upload-hint {
	font-size: 22rpx;
	color: var(--ink-400);
}
.ocr-edit {
	width: 100%;
	min-height: 200rpx;
	box-sizing: border-box;
	padding: 20rpx 24rpx;
	font-size: 26rpx;
	line-height: 1.7;
	color: var(--ink-600);
	background: var(--bg-fill);
	border-radius: 12rpx;
	border: 1rpx solid var(--line-100);
	margin-bottom: 12rpx;
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
.tag-hint {
	display: block;
	font-size: 22rpx;
	color: var(--ink-400);
	margin-bottom: 16rpx;
	line-height: 1.5;
}
.tag-import-tip {
	font-size: 26rpx;
	color: var(--ink-400);
	line-height: 1.6;
}
.tag-pick {
	border: 1rpx solid var(--brand-100);
}
.tag-picked {
	background: var(--brand-600) !important;
	color: #ffffff !important;
	border-color: var(--brand-600);
	font-weight: 600;
}
.save-btn {
	margin-top: 12rpx;
}
</style>
