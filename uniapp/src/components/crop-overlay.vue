<template>
	<view v-if="show" class="crop-mask">
		<view class="crop-toolbar">
			<text class="crop-title">{{ titleText }}</text>
			<text class="crop-close" hover-class="hv" @tap="onCancel">✕</text>
		</view>

		<view class="crop-stage" :style="{ width: stageW + 'px', height: stageH + 'px' }">
			<image
				class="crop-image"
				:src="src"
				:style="{ width: stageW + 'px', height: stageH + 'px' }"
				mode="scaleToFill"
			/>

			<!-- 题号框选模式：AI 已定位每道题，点框直接识别 -->
			<template v-if="mode === 'boxes'">
				<view
					v-for="(q, idx) in questions"
					:key="q.number + '-' + idx"
					class="pick-box"
					hover-class="pick-box-hover"
					:style="pickBoxStyle(q)"
					@tap="onPick(q)"
				>
					<text class="pick-label">{{ q.label || `第${q.number}题` }}</text>
				</view>
			</template>

			<!-- 自由裁剪模式：拖动/四角手柄调整选框 -->
			<template v-else-if="mode === 'free'">
				<view
					class="crop-box"
					:style="cropBoxStyle"
					@touchstart="onBoxTouchStart"
					@touchmove.stop.prevent="onBoxTouchMove"
					@touchend="onTouchEnd"
				>
					<view class="grid-line gl-h1" />
					<view class="grid-line gl-h2" />
					<view class="grid-line gl-v1" />
					<view class="grid-line gl-v2" />
					<view
						v-for="c in CORNERS"
						:key="c"
						:class="['corner', 'corner-' + c]"
						@touchstart.stop.prevent="onCornerTouchStart(c, $event)"
						@touchmove.stop.prevent="onCornerTouchMove"
						@touchend="onTouchEnd"
					/>
				</view>
			</template>

			<!-- AI 检测中 -->
			<template v-else>
				<view class="detect-hint">
					<view class="detect-spinner" />
					<text class="detect-text">AI 正在定位题目…</text>
				</view>
			</template>
		</view>

		<view class="crop-actions">
			<template v-if="mode === 'boxes'">
				<button class="ca-btn" hover-class="hv" @tap="switchToFree">自由框选</button>
				<button class="ca-btn" hover-class="hv" @tap="onCancel">取消</button>
			</template>
			<template v-else-if="mode === 'free'">
				<button class="ca-btn" hover-class="hv" @tap="onCancel">取消</button>
				<button v-if="questions.length" class="ca-btn" hover-class="hv" @tap="switchToBoxes">返回题号</button>
				<button class="ca-btn primary" :disabled="cropping" hover-class="hv" @tap="onFreeConfirm">
					{{ cropping ? "裁剪中…" : "确认裁剪" }}
				</button>
			</template>
			<template v-else>
				<button class="ca-btn" hover-class="hv" @tap="onCancel">取消</button>
				<button class="ca-btn" hover-class="hv" @tap="switchToFree">跳过，自由框选</button>
			</template>
		</view>
		<text class="crop-tip">{{ tipText }}</text>

		<canvas
			id="cropCanvas"
			canvas-id="cropCanvas"
			class="crop-canvas"
			:style="{ width: canvasW + 'px', height: canvasH + 'px' }"
		/>
	</view>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, getCurrentInstance } from "vue";
import type { DetectedQuestionBox } from "@/api";

const props = withDefaults(
	defineProps<{
		show: boolean;
		src: string;
		/** AI 定位到的题目框；为空时进入自由裁剪模式 */
		questions?: DetectedQuestionBox[];
		/** 题目定位请求进行中 */
		detecting?: boolean;
	}>(),
	{ questions: () => [], detecting: false }
);

const emit = defineEmits<{
	(e: "close"): void;
	/** autoStart: 点题号框直接识别；自由裁剪由用户手动点「开始 AI 识别」 */
	(e: "confirm", payload: { path: string; autoStart: boolean }): void;
}>();

const instance = getCurrentInstance();

type Mode = "loading" | "boxes" | "free";
const CORNERS = ["tl", "tr", "bl", "br"] as const;
const MIN_SIZE = 40; // 选框最小边长（px）

const mode = ref<Mode>("free");
const stageW = ref(320);
const stageH = ref(420);
const canvasW = ref(1);
const canvasH = ref(1);
const cropping = ref(false);
const box = ref({ x: 32, y: 84, w: 256, h: 252 });

let naturalW = 1;
let naturalH = 1;
let userChoseFree = false;
let touchAction: "move" | "resize" | null = null;
let resizeDir = "tl";
let startTouch = { x: 0, y: 0 };
let startBox = { x: 0, y: 0, w: 0, h: 0 };

const titleText = computed(() =>
	mode.value === "boxes" ? "选择要识别的题" : "框选题目区域"
);
const tipText = computed(() => {
	if (mode.value === "boxes") return "点击题号框识别该题，也可自由框选";
	if (mode.value === "free") return "拖动选框或四角手柄调整区域";
	return "识别不到题号时可跳过，手动框选";
});

const cropBoxStyle = computed(() => ({
	left: box.value.x + "px",
	top: box.value.y + "px",
	width: box.value.w + "px",
	height: box.value.h + "px",
}));

function pickBoxStyle(q: DetectedQuestionBox) {
	const { x1, y1, x2, y2 } = q.bbox;
	return {
		left: (x1 / 100) * stageW.value + "px",
		top: (y1 / 100) * stageH.value + "px",
		width: ((x2 - x1) / 100) * stageW.value + "px",
		height: ((y2 - y1) / 100) * stageH.value + "px",
	};
}

watch(
	() => props.show,
	(val) => {
		if (!val) return;
		userChoseFree = false;
		cropping.value = false;
		mode.value = props.detecting ? "loading" : props.questions.length ? "boxes" : "free";
		initStage();
	}
);

// 检测请求返回后，若用户仍停留在等待态则自动切换模式
watch(
	() => props.detecting,
	(val, old) => {
		if (old && !val && mode.value === "loading" && !userChoseFree) {
			mode.value = props.questions.length ? "boxes" : "free";
		}
	}
);

function initStage() {
	uni.getImageInfo({
		src: props.src,
		success: (info) => {
			naturalW = info.width;
			naturalH = info.height;
			const sys = uni.getSystemInfoSync();
			const maxW = Math.max(sys.windowWidth - 32, 200);
			const maxH = Math.max(sys.windowHeight * 0.55, 240);
			let w = maxW;
			let h = w * (info.height / info.width);
			if (h > maxH) {
				h = maxH;
				w = h * (info.width / info.height);
			}
			stageW.value = Math.round(w);
			stageH.value = Math.round(h);
			box.value = {
				x: stageW.value * 0.1,
				y: stageH.value * 0.2,
				w: stageW.value * 0.8,
				h: stageH.value * 0.6,
			};
		},
		fail: () => {
			uni.showToast({ title: "读取图片信息失败", icon: "none" });
		},
	});
}

function switchToFree() {
	userChoseFree = true;
	mode.value = "free";
}

function switchToBoxes() {
	mode.value = "boxes";
}

function onCancel() {
	emit("close");
}

// ---------- 触摸交互 ----------

function getTouchPoint(e: any): { x: number; y: number } {
	const t = e?.touches?.[0] || e?.changedTouches?.[0] || e || {};
	return { x: t.clientX ?? 0, y: t.clientY ?? 0 };
}

function clamp(v: number, min: number, max: number) {
	return Math.min(Math.max(v, min), max);
}

function onBoxTouchStart(e: any) {
	touchAction = "move";
	startTouch = getTouchPoint(e);
	startBox = { ...box.value };
}

function onBoxTouchMove(e: any) {
	if (touchAction !== "move") return;
	const p = getTouchPoint(e);
	box.value = {
		...box.value,
		x: clamp(startBox.x + (p.x - startTouch.x), 0, stageW.value - box.value.w),
		y: clamp(startBox.y + (p.y - startTouch.y), 0, stageH.value - box.value.h),
	};
}

function onCornerTouchStart(dir: string, e: any) {
	touchAction = "resize";
	resizeDir = dir;
	startTouch = getTouchPoint(e);
	startBox = { ...box.value };
}

function onCornerTouchMove(e: any) {
	if (touchAction !== "resize") return;
	const p = getTouchPoint(e);
	const dx = p.x - startTouch.x;
	const dy = p.y - startTouch.y;
	let x1 = startBox.x;
	let y1 = startBox.y;
	let x2 = startBox.x + startBox.w;
	let y2 = startBox.y + startBox.h;
	if (resizeDir.includes("l")) x1 = clamp(x1 + dx, 0, x2 - MIN_SIZE);
	if (resizeDir.includes("t")) y1 = clamp(y1 + dy, 0, y2 - MIN_SIZE);
	if (resizeDir.includes("r")) x2 = clamp(x2 + dx, x1 + MIN_SIZE, stageW.value);
	if (resizeDir.includes("b")) y2 = clamp(y2 + dy, y1 + MIN_SIZE, stageH.value);
	box.value = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function onTouchEnd() {
	touchAction = null;
}

// ---------- 裁剪导出 ----------

async function onPick(q: DetectedQuestionBox) {
	if (cropping.value) return;
	cropping.value = true;
	uni.showLoading({ title: "裁剪中…", mask: true });
	try {
		const path = await doCrop(q.bbox);
		emit("confirm", { path, autoStart: true });
	} catch (e: any) {
		uni.showToast({ title: e?.message || "裁剪失败", icon: "none" });
	} finally {
		cropping.value = false;
		uni.hideLoading();
	}
}

async function onFreeConfirm() {
	if (cropping.value) return;
	const b = box.value;
	const percent = {
		x1: (b.x / stageW.value) * 100,
		y1: (b.y / stageH.value) * 100,
		x2: ((b.x + b.w) / stageW.value) * 100,
		y2: ((b.y + b.h) / stageH.value) * 100,
	};
	cropping.value = true;
	uni.showLoading({ title: "裁剪中…", mask: true });
	try {
		const path = await doCrop(percent);
		emit("confirm", { path, autoStart: false });
	} catch (e: any) {
		uni.showToast({ title: e?.message || "裁剪失败", icon: "none" });
	} finally {
		cropping.value = false;
		uni.hideLoading();
	}
}

/** 按百分比包围盒从原图裁出区域，经离屏 canvas 导出为临时文件 */
function doCrop(percent: { x1: number; y1: number; x2: number; y2: number }): Promise<string> {
	const sx = (naturalW * percent.x1) / 100;
	const sy = (naturalH * percent.y1) / 100;
	const sw = (naturalW * (percent.x2 - percent.x1)) / 100;
	const sh = (naturalH * (percent.y2 - percent.y1)) / 100;
	const scale = Math.min(1, 1600 / Math.max(sw, sh));
	const cw = Math.max(1, Math.round(sw * scale));
	const ch = Math.max(1, Math.round(sh * scale));
	canvasW.value = cw;
	canvasH.value = ch;

	return new Promise((resolve, reject) => {
		nextTick(() => {
			try {
				const ctx = uni.createCanvasContext("cropCanvas", instance?.proxy as any);
				ctx.drawImage(props.src, sx, sy, sw, sh, 0, 0, cw, ch);
				ctx.draw(false, () => {
					uni.canvasToTempFilePath(
						{
							canvasId: "cropCanvas",
							width: cw,
							height: ch,
							destWidth: cw,
							destHeight: ch,
							fileType: "jpg",
							quality: 0.92,
							success: (res: { tempFilePath: string }) => resolve(res.tempFilePath),
							fail: (err: any) => reject(new Error(err?.errMsg || "裁剪失败")),
						} as any,
						instance?.proxy as any
					);
				});
			} catch (e: any) {
				reject(new Error(e?.message || "裁剪失败"));
			}
		});
	});
}
</script>

<style scoped>
.crop-mask {
	position: fixed;
	inset: 0;
	z-index: 999;
	background: rgba(0, 0, 0, 0.88);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}
.crop-toolbar {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: calc(env(safe-area-inset-top) + 20rpx) 28rpx 20rpx;
}
.crop-title {
	color: #fff;
	font-size: 30rpx;
	font-weight: 600;
}
.crop-close {
	color: rgba(255, 255, 255, 0.85);
	font-size: 40rpx;
	line-height: 1;
	padding: 8rpx 12rpx;
}
.hv {
	opacity: 0.7;
}

.crop-stage {
	position: relative;
	overflow: hidden;
	border-radius: 8rpx;
}
.crop-image {
	display: block;
}

/* ---------- 题号框 ---------- */
.pick-box {
	position: absolute;
	border: 3rpx dashed rgba(255, 255, 255, 0.9);
	background: rgba(255, 255, 255, 0.12);
	border-radius: 8rpx;
	display: flex;
	align-items: flex-start;
	justify-content: flex-start;
}
.pick-box-hover {
	background: rgba(255, 255, 255, 0.3);
	border-style: solid;
}
.pick-label {
	background: rgba(0, 0, 0, 0.65);
	color: #fff;
	font-size: 22rpx;
	line-height: 1;
	padding: 8rpx 12rpx;
	border-radius: 8rpx 0 8rpx 0;
}

/* ---------- 自由选框 ---------- */
.crop-box {
	position: absolute;
	border: 3rpx solid #fff;
	border-radius: 4rpx;
	box-shadow: 0 0 0 2000px rgba(0, 0, 0, 0.45);
	box-sizing: border-box;
}
.grid-line {
	position: absolute;
	background: rgba(255, 255, 255, 0.35);
}
.gl-h1 {
	left: 0;
	right: 0;
	top: 33.3%;
	height: 1rpx;
}
.gl-h2 {
	left: 0;
	right: 0;
	top: 66.6%;
	height: 1rpx;
}
.gl-v1 {
	top: 0;
	bottom: 0;
	left: 33.3%;
	width: 1rpx;
}
.gl-v2 {
	top: 0;
	bottom: 0;
	left: 66.6%;
	width: 1rpx;
}
.corner {
	position: absolute;
	width: 44rpx;
	height: 44rpx;
}
.corner-tl {
	left: -8rpx;
	top: -8rpx;
	border-left: 6rpx solid #fff;
	border-top: 6rpx solid #fff;
	border-top-left-radius: 8rpx;
}
.corner-tr {
	right: -8rpx;
	top: -8rpx;
	border-right: 6rpx solid #fff;
	border-top: 6rpx solid #fff;
	border-top-right-radius: 8rpx;
}
.corner-bl {
	left: -8rpx;
	bottom: -8rpx;
	border-left: 6rpx solid #fff;
	border-bottom: 6rpx solid #fff;
	border-bottom-left-radius: 8rpx;
}
.corner-br {
	right: -8rpx;
	bottom: -8rpx;
	border-right: 6rpx solid #fff;
	border-bottom: 6rpx solid #fff;
	border-bottom-right-radius: 8rpx;
}

/* ---------- 检测中 ---------- */
.detect-hint {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 24rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.detect-spinner {
	width: 36rpx;
	height: 36rpx;
	border: 4rpx solid rgba(255, 255, 255, 0.35);
	border-top-color: #fff;
	border-radius: 50%;
	animation: crop-spin 0.9s linear infinite;
	margin-bottom: 14rpx;
}
@keyframes crop-spin {
	to {
		transform: rotate(360deg);
	}
}
.detect-text {
	color: #fff;
	font-size: 26rpx;
	text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}

/* ---------- 底部操作 ---------- */
.crop-actions {
	display: flex;
	gap: 20rpx;
	margin-top: 32rpx;
	padding: 0 32rpx;
	width: 100%;
	box-sizing: border-box;
}
.ca-btn {
	flex: 1;
	height: 80rpx;
	line-height: 80rpx;
	font-size: 28rpx;
	color: #fff;
	background: rgba(255, 255, 255, 0.15);
	border-radius: 16rpx;
	padding: 0;
	margin: 0;
}
.ca-btn.primary {
	background: var(--brand-600, #2f6bff);
	font-weight: 600;
}
.ca-btn::after {
	border: none;
}
.crop-tip {
	margin-top: 20rpx;
	color: rgba(255, 255, 255, 0.65);
	font-size: 24rpx;
}

/* 离屏导出画布 */
.crop-canvas {
	position: fixed;
	left: -9999px;
	top: 0;
}
</style>
