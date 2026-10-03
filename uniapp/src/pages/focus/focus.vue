<template>
	<view class="page">
		<!-- 模式选择 -->
		<view v-if="phase === 'idle'" class="card fade-up">
			<view class="seg">
				<view
					v-for="m in MODES"
					:key="m.value"
					class="seg-item"
					:class="{ 'seg-item-active': mode === m.value }"
					hover-class="hv"
					@tap="switchMode(m.value)"
				>
					{{ m.label }}
				</view>
			</view>

			<!-- 番茄：时长 -->
			<view v-if="mode === 'pomodoro'" class="opt-row">
				<view
					v-for="opt in POMODORO_OPTIONS"
					:key="opt"
					class="opt-chip"
					:class="{ 'opt-chip-active': targetMinutes === opt }"
					hover-class="hv"
					@tap="targetMinutes = opt"
				>
					{{ opt }} 分钟
				</view>
			</view>
			<view v-if="mode === 'pomodoro'" class="hint">标准番茄钟 25 分钟 + 休息 5 分钟，适合单模块定向刷题</view>

			<!-- 模考：整卷 -->
			<template v-if="mode === 'mock'">
				<view class="opt-row">
					<view
						v-for="opt in MOCK_OPTIONS"
						:key="opt"
						class="opt-chip"
						:class="{ 'opt-chip-active': activePreset === opt }"
						hover-class="hv"
						@tap="applyPreset(opt)"
					>
						{{ opt }} 分钟
					</view>
					<view class="opt-chip" :class="{ 'opt-chip-active': activePreset === null }">
						共 {{ targetMinutes }} 分钟
					</view>
				</view>
				<view class="seg-timeline">
					<view
						v-for="(seg, i) in mockSegments"
						:key="seg.name"
						class="seg-block"
						:style="{ width: (seg.minutes / targetMinutes) * 100 + '%', background: SEG_COLORS[i % SEG_COLORS.length] }"
					>
						<text class="seg-block-name">{{ seg.name.slice(0, 2) }}</text>
						<text class="seg-block-min">{{ seg.minutes }}′</text>
					</view>
				</view>
				<view class="seg-edit-list">
					<view v-for="(seg, i) in mockSegments" :key="seg.name" class="seg-edit-row">
						<text class="seg-edit-name" :style="{ color: SEG_COLORS[i % SEG_COLORS.length] }">{{ seg.name }}</text>
						<view class="seg-edit-stepper">
							<view class="seg-step" hover-class="hv" @tap="editSegment(i, -1)">−</view>
							<text class="seg-edit-min num">{{ segMinutes[i] }}′</text>
							<view class="seg-step" hover-class="hv" @tap="editSegment(i, 1)">+</view>
						</view>
					</view>
				</view>
				<view class="hint">默认按国考建议用时分配；点 ± 自定义每模块用时，总时长随之变化，超段会提醒切换模块</view>
			</template>

			<!-- 自定义 -->
			<view v-if="mode === 'custom'" class="custom-row">
				<button class="step-btn" hover-class="hv" @tap="stepMinutes(-5)">−</button>
				<text class="custom-min num">{{ targetMinutes }}</text>
				<text class="custom-unit">分钟</text>
				<button class="step-btn" hover-class="hv" @tap="stepMinutes(5)">+</button>
			</view>

			<!-- 模块绑定 -->
			<view class="bind-head">本次专注绑定模块（可选）</view>
			<view class="opt-row">
				<view
					v-for="name in BIND_NAMES"
					:key="name"
					class="opt-chip"
					:class="{ 'opt-chip-active': moduleName === name }"
					hover-class="hv"
					@tap="moduleName = moduleName === name ? '' : name"
				>
					{{ name }}
				</view>
			</view>

			<button class="btn-primary start-btn" hover-class="button-hover" @tap="start">开始专注</button>
		</view>

		<!-- 计时中 / 暂停 -->
		<template v-else-if="phase === 'running' || phase === 'paused'">
			<view class="card timer-card fade-up">
				<text class="timer-mode">{{ modeLabel }}<template v-if="moduleName"> · {{ moduleName }}</template></text>
				<view
					class="timer-ring"
					:style="{
						background: `conic-gradient(var(--brand-600) ${progressDeg}deg, var(--brand-50) ${progressDeg}deg)`,
					}"
				>
					<view class="timer-inner">
						<text class="timer-time num">{{ remainText }}</text>
						<text class="timer-elapsed num">已专注 {{ fmtMinutes(elapsed) }}</text>
					</view>
				</view>
				<!-- 模考分段进度 -->
				<view v-if="mode === 'mock'" class="mock-status">
					<text class="mock-current">当前建议模块：<text class="mock-current-name">{{ currentSegment.name }}</text></text>
					<text v-if="segmentOvertime" class="mock-overtime">已超时 {{ fmtMinutes(segmentOvertime) }}，建议进入「{{ nextSegmentName }}」</text>
				</view>
				<text class="quote">"{{ quote }}"</text>
				<view class="ctrl-row">
					<template v-if="phase === 'running'">
						<button class="btn-outline ctrl-btn" hover-class="button-hover" @tap="pause">暂停</button>
						<button class="btn-primary ctrl-btn" hover-class="button-hover" @tap="finishEarly">提前收卷</button>
					</template>
					<template v-else>
						<button class="btn-primary ctrl-btn" hover-class="button-hover" @tap="resume">继续</button>
						<button class="btn-outline ctrl-btn ctrl-giveup" hover-class="button-hover" @tap="giveUp">放弃</button>
					</template>
				</view>
			</view>
		</template>

		<!-- 完成 / 放弃小结 -->
		<template v-else-if="phase === 'done'">
			<view class="card done-card fade-up">
				<view class="done-ring" :class="{ 'done-ring-good': lastCompleted }">
					<text class="done-num num">{{ fmtMinutes(lastElapsed) }}</text>
					<text class="done-unit">分钟专注</text>
				</view>
				<text class="done-title">{{ doneTitle }}</text>
				<text class="done-sub">{{ lastModuleName ? `「${lastModuleName}」· ` : "" }}{{ lastModeLabel }}</text>
				<view v-if="lastCompleted && mode === 'pomodoro'" class="break-tip">
					<text class="break-tip-text">休息 5 分钟，看看窗外——下一组更稳</text>
				</view>
				<view class="judge-row">
					<button class="btn-outline judge-btn" hover-class="button-hover" @tap="backToIdle">再来一组</button>
					<button class="btn-primary judge-btn" hover-class="button-hover" @tap="goHome">完成</button>
				</view>
			</view>
		</template>

		<!-- 练习记录入口 -->
		<view class="card entry-card fade-up" hover-class="hv" @tap="goHistory">
			<view class="entry-text">
				<text class="entry-title">练习记录</text>
				<text class="entry-sub">练过的每道题、对错与来源都在这里</text>
			</view>
			<text class="entry-arrow">›</text>
		</view>

		<!-- 统计条 -->
		<view class="card stats-card fade-up">
			<view class="stat-item">
				<text class="stat-num num">{{ fmtMinutes(stats.todaySeconds) }}</text>
				<text class="stat-label">今日专注(分)</text>
			</view>
			<view class="stat-divider" />
			<view class="stat-item">
				<text class="stat-num num">{{ stats.streakDays }}</text>
				<text class="stat-label">连续打卡(天)</text>
			</view>
			<view class="stat-divider" />
			<view class="stat-item stat-item-tap" hover-class="hv" @tap="pickExamDate">
				<text class="stat-num num">{{ examDaysLeft === null ? "—" : examDaysLeft }}</text>
				<text class="stat-label">{{ examDaysLeft === null ? "设置考试日" : "距考试(天)" }}</text>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { onLoad, onShow, onHide } from "@dcloudio/uni-app";
import { recordFocusSession, getFocusStats, type FocusStats } from "@/api";

const MODES = [
	{ value: "pomodoro", label: "番茄专注" },
	{ value: "mock", label: "模考掐表" },
	{ value: "custom", label: "自定义" },
] as const;
type Mode = (typeof MODES)[number]["value"];

const POMODORO_OPTIONS = [25, 45, 60];
const MOCK_OPTIONS = [90, 120, 150, 180];
const MOCK_TOTAL_CAP = 240; // 服务端单次上限 4 小时
const BIND_NAMES = ["言语理解", "判断推理", "数量关系", "资料分析", "常识判断"];
const SEG_COLORS = ["#E8993C", "#5568E8", "#8B5CF6", "#0E9F8A", "#18A058"];
// 国考行测 120 分钟建议用时分配（常识→资料）
const MOCK_SEGMENTS_BASE = [
	{ name: "常识判断", minutes: 10 },
	{ name: "言语理解", minutes: 35 },
	{ name: "判断推理", minutes: 35 },
	{ name: "数量关系", minutes: 15 },
	{ name: "资料分析", minutes: 25 },
];
const QUOTES = [
	"你背不下来的书，总有人能背下来。",
	"对手此刻正在刷题。",
	"现在的每一分钟，都是考场上的底气。",
	"行测拼的不是天赋，是重复。",
	"上岸的人不是不累，是一直没停。",
	"今天偷的懒，都会变成考场上划掉的选项。",
	"岗位只招第一名，并列都不要。",
	"先做完，再做好——考场上没有完美，只有完成。",
];

// 模考各段用时(分钟),默认按国考建议分配;总时长 = 各段之和
const segMinutes = ref<number[]>(MOCK_SEGMENTS_BASE.map(s => s.minutes));
const activePreset = ref<number | null>(120);

function applyPreset(total: number) {
	const baseSum = MOCK_SEGMENTS_BASE.reduce((s, x) => s + x.minutes, 0);
	// 等比缩放 + 最大余数法,保证各段之和恰等于 total
	const raw = MOCK_SEGMENTS_BASE.map(s => (s.minutes / baseSum) * total);
	const floored = raw.map(x => Math.max(1, Math.floor(x)));
	let rest = total - floored.reduce((a, b) => a + b, 0);
	const order = raw
		.map((x, i) => ({ i, frac: x - Math.floor(x) }))
		.sort((a, b) => b.frac - a.frac);
	for (const { i } of order) {
		if (rest <= 0) break;
		floored[i] += 1;
		rest -= 1;
	}
	segMinutes.value = floored;
	activePreset.value = total;
	targetMinutes.value = total;
}

function editSegment(i: number, delta: number) {
	const next = [...segMinutes.value];
	const v = next[i] + delta;
	if (v < 1 || v > 90) return;
	if (delta > 0 && next.reduce((a, b) => a + b, 0) >= MOCK_TOTAL_CAP) return;
	next[i] = v;
	segMinutes.value = next;
	activePreset.value = null; // 手动编辑后脱离预设
	targetMinutes.value = next.reduce((a, b) => a + b, 0);
}

const STORAGE_KEY = "focus_running_v1";
const EXAM_DATE_KEY = "exam_target_date";

const mode = ref<Mode>("pomodoro");
const targetMinutes = ref(25);
const moduleName = ref("");
const phase = ref<"idle" | "running" | "paused" | "done">("idle");
const elapsed = ref(0); // 已专注秒数
const timer = ref<ReturnType<typeof setInterval> | null>(null);
const quoteIndex = ref(0);
const quoteTimer = ref<ReturnType<typeof setInterval> | null>(null);

const stats = ref<FocusStats>({ todaySeconds: 0, weekSeconds: 0, streakDays: 0, totalSessions: 0, totalSeconds: 0, last7Days: [] });
const examTarget = ref(uni.getStorageSync(EXAM_DATE_KEY) || "");

const lastCompleted = ref(false);
const lastElapsed = ref(0);
const lastModuleName = ref("");
const lastModeLabel = ref("");

const modeLabel = computed(() => MODES.find(m => m.value === mode.value)?.label || "");
const targetSeconds = computed(() => targetMinutes.value * 60);
const remaining = computed(() => Math.max(0, targetSeconds.value - elapsed.value));
const remainText = computed(() => {
	const r = remaining.value;
	const h = Math.floor(r / 3600);
	const m = Math.floor((r % 3600) / 60);
	const s = r % 60;
	const pad = (n: number) => String(n).padStart(2, "0");
	return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
});
const progressDeg = computed(() => Math.min(360, (elapsed.value / targetSeconds.value) * 360));
const examDaysLeft = computed(() => {
	if (!examTarget.value) return null;
	const diff = Math.ceil((new Date(examTarget.value).getTime() - Date.now()) / 86_400_000);
	return diff;
});

// 模考分段:由 segMinutes 驱动(可自定义),名称固定
const mockSegments = computed(() =>
	MOCK_SEGMENTS_BASE.map((seg, i) => ({ name: seg.name, minutes: segMinutes.value[i] }))
);
const segmentOffsets = computed(() => {
	let acc = 0;
	return mockSegments.value.map(seg => {
		acc += seg.minutes * 60;
		return acc;
	});
});
const currentSegmentIndex = computed(() => {
	const e = elapsed.value;
	for (let i = 0; i < segmentOffsets.value.length; i++) {
		if (e < segmentOffsets.value[i]) return i;
	}
	return segmentOffsets.value.length - 1;
});
const currentSegment = computed(() => mockSegments.value[currentSegmentIndex.value] || mockSegments.value[0]);
const nextSegmentName = computed(() => mockSegments.value[currentSegmentIndex.value + 1]?.name || "检查涂卡");
const segmentOvertime = computed(() => {
	const prev = currentSegmentIndex.value > 0 ? segmentOffsets.value[currentSegmentIndex.value - 1] : 0;
	const segSeconds = mockSegments.value[currentSegmentIndex.value]?.minutes * 60 || 0;
	return Math.max(0, elapsed.value - prev - segSeconds);
});
const quote = computed(() => QUOTES[quoteIndex.value]);

function switchMode(m: Mode) {
	mode.value = m;
	if (m === "pomodoro") targetMinutes.value = 25;
	else if (m === "mock") applyPreset(120);
	else targetMinutes.value = 60;
}

function stepMinutes(delta: number) {
	targetMinutes.value = Math.min(180, Math.max(5, targetMinutes.value + delta));
}

const doneTitle = computed(() =>
	lastCompleted.value ? (mode.value === "mock" ? "收卷！这套卷子你扛下来了" : "这组专注拿下了") : "已记录本次专注"
);

// ---------- 计时 ----------
function tick() {
	elapsed.value += 1;
	if (elapsed.value % 5 === 0) persistRunning();
	if (elapsed.value >= targetSeconds.value) {
		complete(true);
	}
}

function start() {
	phase.value = "running";
	elapsed.value = 0;
	quoteIndex.value = Math.floor(Math.random() * QUOTES.length);
	startTimers();
	persistRunning();
}

function startTimers() {
	stopTimers();
	timer.value = setInterval(tick, 1000);
	quoteTimer.value = setInterval(() => {
		quoteIndex.value = (quoteIndex.value + 1) % QUOTES.length;
	}, 25_000);
}

function stopTimers() {
	if (timer.value) { clearInterval(timer.value); timer.value = null; }
	if (quoteTimer.value) { clearInterval(quoteTimer.value); quoteTimer.value = null; }
}

function pause() {
	phase.value = "paused";
	stopTimers();
	persistRunning();
}

function resume() {
	phase.value = "running";
	startTimers();
}

function finishEarly() {
	// 提前收卷：不足 1 分钟的按 60 秒计，避免被服务端过滤
	complete(elapsed.value >= targetSeconds.value);
}

function giveUp() {
	uni.showModal({
		title: "放弃本次专注？",
		content: "会记为一次未完成，连续打卡不受影响，但别让它成为习惯。",
		confirmText: "放弃",
		cancelText: "继续专注",
		success: (res) => {
			if (!res.confirm) return;
			submit(false).finally(() => {
				uni.removeStorageSync(STORAGE_KEY);
				lastCompleted.value = false;
				lastElapsed.value = elapsed.value;
				lastModuleName.value = moduleName.value;
				lastModeLabel.value = modeLabel.value;
				phase.value = "done";
				loadStats();
			});
		},
	});
}

function complete(natural: boolean) {
	stopTimers();
	uni.vibrateShort?.();
	const wasMock = mode.value === "mock";
	lastCompleted.value = natural;
	lastElapsed.value = elapsed.value;
	lastModuleName.value = moduleName.value;
	lastModeLabel.value = modeLabel.value;
	submit(natural).finally(() => {
		uni.removeStorageSync(STORAGE_KEY);
		phase.value = "done";
		loadStats();
	});
	if (natural) {
		uni.showToast({ title: wasMock ? "收卷！" : "专注完成！", icon: "none" });
	}
}

async function submit(completed: boolean) {
	try {
		await recordFocusSession({
			mode: mode.value,
			moduleName: moduleName.value || undefined,
			targetSeconds: targetSeconds.value,
			durationSeconds: Math.max(60, elapsed.value),
			completed,
		});
	} catch (e: any) {
		uni.showToast({ title: e?.message || "记录失败", icon: "none" });
	}
}

function backToIdle() {
	phase.value = "idle";
}

function goHome() {
	uni.switchTab({ url: "/pages/index/index" });
}

function goHistory() {
	uni.navigateTo({ url: "/pages/practice/history" });
}

// ---------- 断点续计 ----------
function persistRunning() {
	if (phase.value !== "running" && phase.value !== "paused") return;
	uni.setStorageSync(STORAGE_KEY, {
		mode: mode.value,
		moduleName: moduleName.value,
		targetMinutes: targetMinutes.value,
		segMinutes: mode.value === "mock" ? segMinutes.value : undefined,
		elapsed: elapsed.value,
	});
}

function restoreRunning() {
	const saved = uni.getStorageSync(STORAGE_KEY);
	if (!saved || !saved.targetMinutes) return;
	mode.value = saved.mode;
	moduleName.value = saved.moduleName || "";
	targetMinutes.value = saved.targetMinutes;
	if (mode.value === "mock" && Array.isArray(saved.segMinutes) && saved.segMinutes.length === MOCK_SEGMENTS_BASE.length) {
		segMinutes.value = saved.segMinutes;
	}
	elapsed.value = saved.elapsed || 0;
	if (elapsed.value >= targetSeconds.value) {
		complete(true);
		return;
	}
	phase.value = "paused";
	uni.showToast({ title: "已恢复上次专注（暂停中）", icon: "none" });
}

// ---------- 统计与考试倒计时 ----------
function loadStats() {
	getFocusStats()
		.then(res => (stats.value = res))
		.catch(() => {});
}

function pickExamDate() {
	uni.showModal({
		title: "设置目标考试日",
		editable: true,
		placeholderText: "格式：2026-11-30（国考/省考笔试日）",
		content: examTarget.value,
		success: (res) => {
			if (!res.confirm) return;
			const v = (res.content || "").trim();
			if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
				if (v) uni.showToast({ title: "日期格式应为 2026-11-30", icon: "none" });
				return;
			}
			examTarget.value = v;
			uni.setStorageSync(EXAM_DATE_KEY, v);
		},
	});
}

function fmtMinutes(seconds: number): number {
	return Math.round(seconds / 60);
}

onLoad(() => {
	restoreRunning();
	loadStats();
});
onShow(() => {
	if (phase.value === "running") return; // 计时中回到页面继续走
});
onHide(() => {
	persistRunning();
});
onUnmounted(stopTimers);
</script>

<style scoped>
.page {
	padding-bottom: calc(env(safe-area-inset-bottom) + 40rpx);
}

/* ---------- 模式分段 ---------- */
.seg {
	display: flex;
	background: #eceef5;
	border-radius: 999rpx;
	padding: 6rpx;
}
.seg-item {
	flex: 1;
	text-align: center;
	color: var(--ink-500);
	font-size: 26rpx;
	font-weight: 500;
	padding: 16rpx 0;
	border-radius: 999rpx;
	transition: all 0.2s ease;
}
.seg-item-active {
	background: #ffffff;
	color: var(--brand-600);
	font-weight: 600;
	box-shadow: 0 4rpx 14rpx rgba(16, 26, 60, 0.12);
}

/* ---------- 时长/模块选择 ---------- */
.opt-row {
	display: flex;
	flex-wrap: wrap;
	gap: 16rpx;
	margin-top: 28rpx;
}
.opt-chip {
	font-size: 26rpx;
	color: var(--ink-500);
	background: var(--bg-fill);
	border: 2rpx solid transparent;
	border-radius: 999rpx;
	padding: 14rpx 30rpx;
	transition: all 0.15s ease;
}
.opt-chip-active {
	background: var(--brand-50);
	border-color: var(--brand-500);
	color: var(--brand-600);
	font-weight: 600;
}
.hint {
	margin-top: 18rpx;
	font-size: 23rpx;
	color: var(--ink-400);
	line-height: 1.6;
}
.bind-head {
	margin: 34rpx 0 6rpx;
	font-size: 26rpx;
	font-weight: 600;
	color: var(--ink-900);
}

/* ---------- 模考分段时间轴 ---------- */
.seg-timeline {
	display: flex;
	margin-top: 28rpx;
	border-radius: 14rpx;
	overflow: hidden;
}
.seg-block {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 14rpx 4rpx;
}
.seg-block-name {
	color: #ffffff;
	font-size: 22rpx;
	font-weight: 600;
}
.seg-block-min {
	color: rgba(255, 255, 255, 0.85);
	font-size: 20rpx;
	margin-top: 2rpx;
}

/* ---------- 自定义 ---------- */
.custom-row {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 30rpx;
	margin-top: 30rpx;
}
.step-btn {
	width: 72rpx;
	height: 72rpx;
	line-height: 72rpx;
	padding: 0;
	margin: 0;
	font-size: 40rpx;
	border-radius: 50%;
	background: var(--bg-fill);
	color: var(--ink-900);
}
.custom-min {
	font-size: 64rpx;
	font-weight: 700;
	color: var(--brand-600);
}
.custom-unit {
	font-size: 26rpx;
	color: var(--ink-400);
}

.start-btn {
	margin-top: 40rpx;
}

/* ---------- 计时环 ---------- */
.timer-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 48rpx 32rpx 40rpx;
}
.timer-mode {
	font-size: 27rpx;
	color: var(--ink-500);
	margin-bottom: 30rpx;
}
.timer-ring {
	width: 420rpx;
	height: 420rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: background 0.5s linear;
}
.timer-inner {
	width: 372rpx;
	height: 372rpx;
	border-radius: 50%;
	background: #ffffff;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 10rpx;
}
.timer-time {
	font-size: 76rpx;
	font-weight: 700;
	color: var(--ink-900);
	letter-spacing: 2rpx;
}
.timer-elapsed {
	font-size: 24rpx;
	color: var(--ink-400);
}
.seg-edit-list {
	width: 100%;
	margin-top: 22rpx;
	display: flex;
	flex-direction: column;
	gap: 10rpx;
}
.seg-edit-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	background: var(--bg-fill);
	border-radius: 12rpx;
	padding: 12rpx 22rpx;
}
.seg-edit-name {
	font-size: 25rpx;
	font-weight: 600;
}
.seg-edit-stepper {
	display: flex;
	align-items: center;
	gap: 22rpx;
}
.seg-step {
	width: 52rpx;
	height: 52rpx;
	line-height: 50rpx;
	text-align: center;
	border-radius: 50%;
	background: #ffffff;
	border: 2rpx solid var(--line-100);
	color: var(--ink-900);
	font-size: 32rpx;
}
.seg-edit-min {
	font-size: 26rpx;
	font-weight: 700;
	color: var(--ink-900);
	min-width: 60rpx;
	text-align: center;
}
.mock-status {
	margin-top: 28rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8rpx;
}
.mock-current {
	font-size: 26rpx;
	color: var(--ink-500);
}
.mock-current-name {
	color: var(--brand-600);
	font-weight: 700;
}
.mock-overtime {
	font-size: 24rpx;
	color: var(--danger-600);
	font-weight: 600;
}
.quote {
	margin: 30rpx 0 34rpx;
	font-size: 25rpx;
	color: var(--ink-400);
	text-align: center;
	line-height: 1.7;
	padding: 0 30rpx;
}
.ctrl-row {
	display: flex;
	gap: 24rpx;
	width: 100%;
}
.ctrl-btn {
	flex: 1;
	margin: 0;
}
.ctrl-giveup {
	color: var(--danger-600);
	border-color: rgba(217, 58, 69, 0.3);
}

/* ---------- 完成小结 ---------- */
.done-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 56rpx 32rpx 40rpx;
}
.done-ring {
	width: 200rpx;
	height: 200rpx;
	border-radius: 50%;
	background: var(--bg-fill);
	border: 6rpx solid var(--line-100);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	margin-bottom: 24rpx;
}
.done-ring-good {
	background: var(--success-50);
	border-color: var(--success-600);
}
.done-num {
	font-size: 52rpx;
	font-weight: 700;
	color: var(--brand-600);
}
.done-ring-good .done-num {
	color: var(--success-600);
}
.done-unit {
	font-size: 22rpx;
	color: var(--ink-400);
}
.done-title {
	font-size: 32rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.done-sub {
	font-size: 24rpx;
	color: var(--ink-400);
	margin-top: 10rpx;
}
.break-tip {
	margin-top: 24rpx;
	background: var(--brand-50);
	border-radius: 12rpx;
	padding: 16rpx 28rpx;
}
.break-tip-text {
	font-size: 24rpx;
	color: var(--brand-600);
}
.judge-row {
	display: flex;
	gap: 24rpx;
	width: 100%;
	margin-top: 40rpx;
}
.judge-btn {
	flex: 1;
	margin: 0;
}

/* ---------- 统计条 ---------- */
.entry-card {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 30rpx 32rpx;
	margin-bottom: 24rpx;
}
.entry-text {
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}
.entry-title {
	font-size: 30rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.entry-sub {
	font-size: 24rpx;
	color: var(--ink-400);
}
.entry-arrow {
	font-size: 44rpx;
	color: var(--ink-300);
	line-height: 1;
}
.stats-card {
	display: flex;
	align-items: stretch;
	margin-top: 24rpx;
	padding: 30rpx 0;
}
.stat-item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8rpx;
}
.stat-item-tap {
	position: relative;
}
.stat-num {
	font-size: 40rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.stat-label {
	font-size: 22rpx;
	color: var(--ink-400);
}
.stat-divider {
	width: 1rpx;
	background: var(--line-100);
}
.hv {
	opacity: 0.85;
}
</style>
