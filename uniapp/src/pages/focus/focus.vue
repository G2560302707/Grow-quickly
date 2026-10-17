<template>
	<view :class="['page', themeCls]">
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

			<button class="btn-primary start-btn" hover-class="button-hover" @tap="start">开始专注</button>
		</view>

		<!-- 计时中 / 暂停 -->
		<template v-else-if="phase === 'running' || phase === 'paused'">
			<view class="card timer-card fade-up">
				<text class="timer-mode">{{ modeLabel }}</text>
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
				<!-- 成长物陪伴 -->
				<view class="grow-wrap">
					<view class="grow-track-label">
						<text class="grow-emoji">{{ growEmoji }}</text>
						<text class="grow-label">{{ growLabel }}</text>
					</view>
					<view class="grow-track"><view class="grow-fill" :style="{ width: growPct + '%' }" /></view>
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
				<text class="done-sub">{{ lastModeLabel }}</text>
				<view v-if="lastCompleted && mode === 'pomodoro'" class="break-tip">
					<text class="break-tip-text">休息 5 分钟，看看窗外——下一组更稳</text>
				</view>
				<view v-if="lastCompleted" class="done-celebrate">
					<text class="done-celebrate-emoji">{{ mode === 'mock' ? '📄' : '🌸' }}</text>
					<text class="done-celebrate-text">{{ mode === 'mock' ? '整套卷子搞定，牛！' : '这组专注开花结果 · 规则 × 坚持' }}</text>
				</view>
				<view class="judge-row">
					<button class="btn-outline judge-btn" hover-class="button-hover" @tap="restart">再来一组</button>
					<button class="btn-primary judge-btn" hover-class="button-hover" @tap="backToIdle">完成</button>
				</view>
			</view>
		</template>

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
			<picker class="stat-item" mode="date" :value="examTarget || todayStr" @change="onExamDateChange">
				<view class="stat-item-inner" hover-class="hv">
					<text class="stat-num num">{{ examDaysLeft === null ? "—" : examDaysLeft }}</text>
					<text class="stat-label">{{ examDaysLeft === null ? "设置考试日" : "距考试(天)" }}</text>
				</view>
			</picker>
		</view>

		<!-- 今日目标 -->
		<view v-if="phase === 'idle'" class="card goal-card fade-up">
			<view class="goal-head">
				<text class="goal-title">今日目标</text>
				<text class="goal-progress num">{{ fmtMinutes(stats.todaySeconds) }}<text class="goal-total">/{{ dailyGoalMin }}</text></text>
			</view>
			<view class="goal-track">
				<view class="goal-fill" :class="{ 'goal-fill-done': todayGoalDone }" :style="{ width: todayGoalPct + '%' }" />
			</view>
			<view class="goal-foot">
				<text class="goal-tip" :class="{ 'goal-tip-done': todayGoalDone }">{{ todayGoalDone ? '🎉 今日目标达成' : `再专注 ${Math.max(0, dailyGoalMin - fmtMinutes(stats.todaySeconds))} 分钟即达标` }}</text>
				<view class="goal-options">
					<view v-for="g in DAILY_GOAL_OPTIONS" :key="g" class="opt-chip" :class="{ 'opt-chip-active': dailyGoalMin === g }" hover-class="hv" @tap="setDailyGoal(g)">{{ g }}分</view>
				</view>
			</view>
		</view>

		<!-- 数据洞察 -->
		<view v-if="phase === 'idle'" class="card insight-card fade-up">
			<view class="insight-head">
				<text class="insight-title">数据洞察</text>
				<text class="insight-sub">累计完成 {{ weekCompletionPct }}%</text>
			</view>
			<template v-if="hasInsights">
				<view class="insight-bars">
					<view v-for="(d, i) in weekBars" :key="d.date" class="insight-col">
						<text v-if="d.minutes > 0" class="insight-col-val num">{{ d.minutes }}</text>
						<view class="insight-bar-track">
							<view class="insight-bar" :class="{ 'insight-bar-on': d.minutes > 0 }" :style="{ height: (d.minutes > 0 ? Math.max(18, d.pct) : 6) + '%' }" />
						</view>
						<text class="insight-col-label" :class="{ 'insight-col-now': i === weekBars.length - 1 }">{{ d.date }}</text>
					</view>
				</view>
				<view v-if="modeRows.length" class="insight-modes">
					<view v-for="m in modeRows" :key="m.key" class="insight-mode-row">
						<text class="insight-mode-name">{{ m.emoji }} {{ m.name }}</text>
						<view class="insight-mode-track">
							<view class="insight-mode-fill" :style="{ width: m.pct + '%' }" />
						</view>
						<text class="insight-mode-val num">{{ fmtMinutes(m.seconds) }}分</text>
					</view>
				</view>
			</template>
			<view v-else class="insight-empty">
				<text class="insight-empty-text">还没有专注记录，完成第一组就会点亮这里 🌱</text>
			</view>
		</view>

		<!-- 专注徽章 -->
		<view v-if="phase === 'idle'" class="card badge-card fade-up">
			<view class="badge-head">
				<text class="badge-title">专注徽章</text>
				<text class="badge-sub">{{ earnedCount }}/{{ BADGES.length }} 已达成</text>
			</view>
			<view class="badge-row">
				<view v-for="b in BADGES" :key="b.key" class="badge-item" :class="{ 'badge-locked': !b.check(stats) }">
					<view class="badge-icon-wrap">
						<image class="badge-icon" :src="b.icon" mode="aspectFit" />
					</view>
					<text class="badge-name">{{ b.name }}</text>
				</view>
			</view>
		</view>

		<!-- 勋章仪式感：解锁新徽章时全屏庆祝（Phase 1.9） -->
		<view v-if="currentBadge" class="badge-fest" @tap="dismissBadge">
			<view class="badge-fest-mask" />
			<view class="badge-fest-body">
				<view class="fest-particles">
					<text v-for="i in FEST_PARTICLES.length" :key="i" class="fest-dot" :style="festDotStyle(i)" />
				</view>
				<view class="fest-icon-wrap">
					<view class="fest-halo" />
					<image class="fest-icon" :src="currentBadge.icon" mode="aspectFit" />
				</view>
				<text class="fest-title">解锁新徽章</text>
				<text class="fest-name">{{ currentBadge.name }}</text>
				<text class="fest-hint">轻触任意处继续</text>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { useThemeClass } from "@/utils/theme";

const themeCls = useThemeClass();
import { ref, computed, onUnmounted } from "vue";
import { onLoad, onShow, onHide } from "@dcloudio/uni-app";
import { recordFocusSession, getFocusStats, setFocusDailyGoal, type FocusStats } from "@/api";

const MODES = [
	{ value: "pomodoro", label: "番茄专注" },
	{ value: "mock", label: "模考掐表" },
	{ value: "custom", label: "自定义" },
] as const;
type Mode = (typeof MODES)[number]["value"];

const POMODORO_OPTIONS = [25, 45, 60];
const MOCK_OPTIONS = [90, 120, 150, 180];
const MOCK_TOTAL_CAP = 240; // 服务端单次上限 4 小时
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
// 成长物陪伴：按本次会话进度分阶段（生动化）
const GROW_STAGES = [
	{ emoji: "🌱", label: "刚播下种子" },
	{ emoji: "🌱", label: "悄悄破土" },
	{ emoji: "🌿", label: "长出嫩叶" },
	{ emoji: "🌳", label: "枝繁叶茂" },
	{ emoji: "🌸", label: "含苞待放" },
];
// 专注徽章：由现有统计派生，无需额外后台字段
// 图标来自 Microsoft Fluent Emoji (3D 风格, MIT 协议), 本地渲染为透明底 PNG
const BADGES: { key: string; name: string; icon: string; check: (s: FocusStats) => boolean }[] = [
	{ key: "first", name: "初次专注", icon: "/static/badges/first.png", check: s => s.totalSessions >= 1 },
	{ key: "streak3", name: "三日连击", icon: "/static/badges/streak3.png", check: s => s.streakDays >= 3 },
	{ key: "streak7", name: "一周坚持", icon: "/static/badges/streak7.png", check: s => s.streakDays >= 7 },
	{ key: "hour10", name: "十小时", icon: "/static/badges/hour10.png", check: s => s.totalSeconds >= 36000 },
	{ key: "hour50", name: "五十小时", icon: "/static/badges/hour50.png", check: s => s.totalSeconds >= 180000 },
	{ key: "sessions50", name: "五十组", icon: "/static/badges/sessions50.png", check: s => s.totalSessions >= 50 },
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
const DAILY_GOAL_KEY = "focus_daily_goal_min";
const DAILY_GOAL_OPTIONS = [60, 120, 180, 240];

const mode = ref<Mode>("pomodoro");
const targetMinutes = ref(25);
const phase = ref<"idle" | "running" | "paused" | "done">("idle");
const elapsed = ref(0); // 已专注秒数（展示用，由墙钟推算）
/** 暂停时冻结的累计秒数；运行中 = baseElapsed + (now - runningSince) */
const baseElapsed = ref(0);
/** 本次进入 running 的墙钟起点（ms）；暂停时为 null */
const runningSince = ref<number | null>(null);
const timer = ref<ReturnType<typeof setInterval> | null>(null);
const quoteIndex = ref(0);
const quoteTimer = ref<ReturnType<typeof setInterval> | null>(null);

const stats = ref<FocusStats>({ todaySeconds: 0, weekSeconds: 0, streakDays: 0, totalSessions: 0, totalSeconds: 0, last7Days: [] });
const examTarget = ref(uni.getStorageSync(EXAM_DATE_KEY) || "");
const dailyGoalMin = ref<number>(Number(uni.getStorageSync(DAILY_GOAL_KEY)) || 120);

const lastCompleted = ref(false);
const lastElapsed = ref(0);
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
// 成长物：本次会话进度 → 阶段
const growPct = computed(() => (targetSeconds.value > 0 ? Math.min(100, (elapsed.value / targetSeconds.value) * 100) : 0));
const growStage = computed(() => {
	const g = growPct.value;
	if (g <= 0) return 0;
	if (g < 25) return 1;
	if (g < 50) return 2;
	if (g < 75) return 3;
	return 4;
});
const growEmoji = computed(() => GROW_STAGES[growStage.value].emoji);
const growLabel = computed(() => GROW_STAGES[growStage.value].label);
// 今日目标
const todayGoalPct = computed(() => (dailyGoalMin.value > 0 ? Math.min(100, (stats.value.todaySeconds / (dailyGoalMin.value * 60)) * 100) : 0));
const todayGoalDone = computed(() => stats.value.todaySeconds >= dailyGoalMin.value * 60);
// 徽章（统计派生）
const earnedCount = computed(() => BADGES.filter(b => b.check(stats.value)).length);

// 勋章仪式感（Phase 1.9）：完成专注后对比前后徽章状态，新解锁的全屏庆祝
const FEST_PARTICLES = Array.from({ length: 14 }, (_, i) => {
	const angle = (i / 14) * Math.PI * 2 + (i % 3) * 0.22;
	const dist = 96 + (i % 4) * 26;
	return {
		x: Math.round(Math.cos(angle) * dist),
		y: Math.round(Math.sin(angle) * dist),
		delay: (i % 5) * 0.09,
		size: 6 + (i % 3) * 3,
		alt: i % 2 === 1,
	};
});
function festDotStyle(i: number) {
	const p = FEST_PARTICLES[i - 1];
	return {
		width: p.size + "px",
		height: p.size + "px",
		animationDelay: p.delay + "s",
		"--px": p.x + "px",
		"--py": p.y + "px",
	};
}
const celebrateQueue = ref<{ key: string; name: string; icon: string }[]>([]);
const currentBadge = computed(() => celebrateQueue.value[0] ?? null);
let celebrateTimer: ReturnType<typeof setTimeout> | null = null;

function snapshotEarnedKeys(): string[] {
	return BADGES.filter(b => b.check(stats.value)).map(b => b.key);
}

function detectNewBadges(beforeKeys: string[]) {
	const before = new Set(beforeKeys);
	const fresh = BADGES.filter(b => b.check(stats.value) && !before.has(b.key));
	if (!fresh.length) return;
	const wasEmpty = celebrateQueue.value.length === 0;
	celebrateQueue.value = [...celebrateQueue.value, ...fresh];
	uni.vibrateLong?.();
	if (wasEmpty) armAutoDismiss();
}

function dismissBadge() {
	if (celebrateTimer) {
		clearTimeout(celebrateTimer);
		celebrateTimer = null;
	}
	celebrateQueue.value = celebrateQueue.value.slice(1);
	if (celebrateQueue.value.length) armAutoDismiss();
}

function armAutoDismiss() {
	if (celebrateTimer) clearTimeout(celebrateTimer);
	celebrateTimer = setTimeout(dismissBadge, 4200);
}
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

// ---------- 计时（墙钟：息屏/后台 JS 定时器会停，用 Date.now 补算） ----------
function syncElapsedFromWallClock() {
	if (phase.value === "running" && runningSince.value != null) {
		const added = Math.max(0, Math.floor((Date.now() - runningSince.value) / 1000));
		elapsed.value = baseElapsed.value + added;
	} else {
		elapsed.value = baseElapsed.value;
	}
}

function tick() {
	syncElapsedFromWallClock();
	if (elapsed.value % 5 === 0) persistRunning();
	if (elapsed.value >= targetSeconds.value) {
		complete(true);
	}
}

function start() {
	phase.value = "running";
	baseElapsed.value = 0;
	runningSince.value = Date.now();
	elapsed.value = 0;
	quoteIndex.value = Math.floor(Math.random() * QUOTES.length);
	startTimers();
	persistRunning();
}

function startTimers() {
	stopTimers();
	// 定时器只负责 UI 刷新；真实进度靠墙钟，避免息屏后丢秒
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
	syncElapsedFromWallClock();
	baseElapsed.value = elapsed.value;
	runningSince.value = null;
	phase.value = "paused";
	stopTimers();
	persistRunning();
}

function resume() {
	baseElapsed.value = elapsed.value;
	runningSince.value = Date.now();
	phase.value = "running";
	startTimers();
	persistRunning();
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
			syncElapsedFromWallClock();
			stopTimers();
			runningSince.value = null;
			baseElapsed.value = elapsed.value;
			submit(false).finally(() => {
				uni.removeStorageSync(STORAGE_KEY);
				lastCompleted.value = false;
				lastElapsed.value = elapsed.value;
				lastModeLabel.value = modeLabel.value;
				phase.value = "done";
				loadStats();
			});
		},
	});
}

function complete(natural: boolean) {
	syncElapsedFromWallClock();
	stopTimers();
	runningSince.value = null;
	baseElapsed.value = elapsed.value;
	uni.vibrateShort?.();
	const wasMock = mode.value === "mock";
	const beforeKeys = snapshotEarnedKeys();
	lastCompleted.value = natural;
	lastElapsed.value = elapsed.value;
	lastModeLabel.value = modeLabel.value;
	submit(natural).finally(() => {
		uni.removeStorageSync(STORAGE_KEY);
		phase.value = "done";
		loadStats().then(() => {
			// 仅自然完成才庆祝新徽章（放弃不算）
			if (natural) detectNewBadges(beforeKeys);
		});
	});
	if (natural) {
		uni.showToast({ title: wasMock ? "收卷！" : "专注完成！", icon: "none" });
	}
}

async function submit(completed: boolean) {
	try {
		await recordFocusSession({
			mode: mode.value,
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

// 再来一组：保留当前模式与时长，直接开跑下一组
function restart() {
	lastCompleted.value = false;
	start();
}

// ---------- 断点续计 ----------
function persistRunning() {
	if (phase.value !== "running" && phase.value !== "paused") return;
	// 运行中先同步一次，再落盘（含 runningSince，息屏期间也能按墙钟补算）
	if (phase.value === "running") syncElapsedFromWallClock();
	uni.setStorageSync(STORAGE_KEY, {
		mode: mode.value,
		targetMinutes: targetMinutes.value,
		segMinutes: mode.value === "mock" ? segMinutes.value : undefined,
		baseElapsed: baseElapsed.value,
		runningSince: runningSince.value,
		phase: phase.value,
		// 兼容旧字段
		elapsed: elapsed.value,
	});
}

function restoreRunning() {
	const saved = uni.getStorageSync(STORAGE_KEY);
	if (!saved || !saved.targetMinutes) return;
	mode.value = saved.mode;
	targetMinutes.value = saved.targetMinutes;
	if (mode.value === "mock" && Array.isArray(saved.segMinutes) && saved.segMinutes.length === MOCK_SEGMENTS_BASE.length) {
		segMinutes.value = saved.segMinutes;
	}

	const wasRunning = saved.phase === "running" || (saved.runningSince != null && saved.phase !== "paused");
	if (wasRunning && saved.runningSince) {
		baseElapsed.value = Number(saved.baseElapsed) || 0;
		runningSince.value = Number(saved.runningSince);
		phase.value = "running";
		syncElapsedFromWallClock();
		if (elapsed.value >= targetSeconds.value) {
			complete(true);
			return;
		}
		startTimers();
		uni.showToast({ title: "已按实际时间恢复专注", icon: "none" });
		return;
	}

	// 暂停态或旧数据：按已记录秒数恢复为暂停
	baseElapsed.value = Number(saved.baseElapsed ?? saved.elapsed) || 0;
	runningSince.value = null;
	elapsed.value = baseElapsed.value;
	if (elapsed.value >= targetSeconds.value) {
		complete(true);
		return;
	}
	phase.value = "paused";
	uni.showToast({ title: "已恢复上次专注（暂停中）", icon: "none" });
}

// ---------- 统计与考试倒计时 ----------
function loadStats() {
	return getFocusStats()
		.then(res => {
			stats.value = res;
			// 每日目标以后台为准（跨端同步）；老接口无字段时保留本地值
			if (typeof res.dailyGoalMin === "number" && res.dailyGoalMin > 0) {
				dailyGoalMin.value = res.dailyGoalMin;
				uni.setStorageSync(DAILY_GOAL_KEY, res.dailyGoalMin);
			}
		})
		.catch(() => {});
}

/** 原生日期选择器取值（YYYY-MM-DD），不再用文本弹窗手输日期 */
const todayStr = (() => {
	const d = new Date();
	const p = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

async function setDailyGoal(v: number) {
	dailyGoalMin.value = v;
	uni.setStorageSync(DAILY_GOAL_KEY, v);
	uni.showToast({ title: `今日目标 ${v} 分钟`, icon: "none" });
	try {
		await setFocusDailyGoal(v); // 同步到后台，换设备不丢
	} catch {
		// 失败保留本地值，下次 loadStats 会被服务端值校正
	}
}

// 数据洞察（wave-2）：近 7 天趋势 + 分模式时长分布
const MODE_META: Record<string, { name: string; emoji: string }> = {
	pomodoro: { name: "番茄钟", emoji: "🍅" },
	mock: { name: "整卷模考", emoji: "📄" },
	custom: { name: "自定义", emoji: "⏱️" },
};
const weekBars = computed(() => {
	const max = Math.max(1, ...stats.value.last7Days.map(d => d.seconds));
	return stats.value.last7Days.map(d => ({
		date: d.date,
		pct: Math.round((d.seconds / max) * 100),
		minutes: fmtMinutes(d.seconds),
	}));
});
const modeRows = computed(() => {
	const bm = stats.value.byMode || {};
	const rows = Object.entries(bm)
		.map(([k, v]) => ({ key: k, ...(MODE_META[k] || { name: k, emoji: "⏱️" }), ...v }))
		.filter(r => r.seconds > 0)
		.sort((a, b) => b.seconds - a.seconds);
	const max = Math.max(1, ...rows.map(r => r.seconds));
	return rows.map(r => ({ ...r, pct: Math.round((r.seconds / max) * 100) }));
});
const weekCompleted = computed(() => {
	const bm = stats.value.byMode || {};
	return Object.values(bm).reduce((s, m) => s + m.completed, 0);
});
const weekCompletionPct = computed(() =>
	stats.value.totalSessions > 0 ? Math.round((weekCompleted.value / stats.value.totalSessions) * 100) : 0
);
const hasInsights = computed(() => weekBars.value.some(b => b.minutes > 0) || modeRows.value.length > 0);

function onExamDateChange(e: any) {
	const v = (e?.detail?.value || "").trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
	examTarget.value = v;
	uni.setStorageSync(EXAM_DATE_KEY, v);
	uni.showToast({ title: "考试日已设置", icon: "none" });
}

function fmtMinutes(seconds: number): number {
	return Math.round(seconds / 60);
}

onLoad(() => {
	restoreRunning();
	loadStats();
});
onShow(() => {
	// 从息屏/后台回来：用墙钟补算，并重启 UI 定时器（后台时 interval 会被挂起）
	if (phase.value === "running") {
		syncElapsedFromWallClock();
		if (elapsed.value >= targetSeconds.value) {
			complete(true);
			return;
		}
		startTimers();
		persistRunning();
	}
});
onHide(() => {
	if (phase.value === "running") syncElapsedFromWallClock();
	persistRunning();
});
onUnmounted(() => {
	stopTimers();
	if (celebrateTimer) clearTimeout(celebrateTimer);
});
</script>

<style scoped>
.page {
	padding-bottom: calc(env(safe-area-inset-bottom) + 40rpx);
}

/* ---------- 模式分段 ---------- */
.seg {
	display: flex;
	background: var(--line-100);
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
.stat-item-inner {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8rpx;
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

/* ---------- 成长物陪伴 ---------- */
.grow-wrap {
	width: 100%;
	margin: 32rpx 0 4rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12rpx;
}
.grow-track-label {
	display: flex;
	align-items: center;
	gap: 12rpx;
	font-size: 25rpx;
	color: var(--ink-500);
}
.grow-emoji {
	font-size: 46rpx;
	line-height: 1;
}
.grow-label {
	font-weight: 600;
	color: var(--brand-600);
}
.grow-track {
	width: 360rpx;
	height: 10rpx;
	border-radius: 999rpx;
	background: var(--bg-fill);
	overflow: hidden;
}
.grow-fill {
	height: 100%;
	background: linear-gradient(90deg, #2dd4a7, #18a058);
	border-radius: 999rpx;
	transition: width 0.5s linear;
}

/* ---------- 完成庆祝 ---------- */
.done-celebrate {
	margin-top: 22rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6rpx;
	padding: 16rpx 30rpx;
	background: linear-gradient(135deg, #fff7ed, #fef3c7);
	border-radius: 16rpx;
	width: 100%;
	box-sizing: border-box;
}
.done-celebrate-emoji {
	font-size: 48rpx;
	line-height: 1;
}
.done-celebrate-text {
	font-size: 25rpx;
	font-weight: 600;
	color: #b45309;
}

/* ---------- 今日目标 ---------- */
.goal-card {
	margin-top: 24rpx;
	padding: 30rpx 32rpx;
}
.goal-head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	margin-bottom: 18rpx;
}
.goal-title {
	font-size: 28rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.goal-progress {
	font-size: 40rpx;
	font-weight: 700;
	color: var(--brand-600);
	margin: 0;
}
.goal-total {
	font-size: 24rpx;
	font-weight: 500;
	color: var(--ink-400);
}
.goal-track {
	height: 14rpx;
	border-radius: 999rpx;
	background: var(--bg-fill);
	overflow: hidden;
}
.goal-fill {
	height: 100%;
	background: linear-gradient(90deg, var(--brand-500), var(--brand-600));
	border-radius: 999rpx;
	transition: width 0.5s ease;
}
.goal-fill-done {
	background: linear-gradient(90deg, #18a058, #0e9f6e);
}
.goal-foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 16rpx;
}
.goal-tip {
	font-size: 23rpx;
	color: var(--ink-400);
}
.goal-tip-done {
	color: #16a34a;
	font-weight: 600;
}
.goal-options {
	display: flex;
	gap: 10rpx;
}
.goal-options .opt-chip {
	padding: 8rpx 20rpx;
	font-size: 23rpx;
	margin: 0;
}

/* ---------- 专注徽章 ---------- */
.badge-card {
	margin-top: 24rpx;
	padding: 30rpx 32rpx 34rpx;
}
.badge-head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	margin-bottom: 20rpx;
}
.badge-title {
	font-size: 28rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.badge-sub {
	font-size: 23rpx;
	color: var(--ink-400);
}
.badge-row {
	display: flex;
	flex-wrap: wrap;
	gap: 18rpx;
}
.badge-item {
	width: calc((100% - 36rpx) / 3);
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8rpx;
	padding: 20rpx 0;
	background: var(--bg-fill);
	border-radius: 14rpx;
}
.badge-icon-wrap {
	width: 96rpx;
	height: 96rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	/* 已达成勋章的金色光晕 */
	background: radial-gradient(circle, rgba(232, 168, 44, 0.18) 0%, rgba(232, 168, 44, 0) 72%);
}
.badge-icon {
	width: 78rpx;
	height: 78rpx;
	filter: drop-shadow(0 4rpx 10rpx rgba(21, 28, 48, 0.18));
}
.badge-name {
	font-size: 22rpx;
	font-weight: 600;
	color: var(--ink-700);
}
.badge-locked {
	opacity: 0.5;
}
.badge-locked .badge-icon-wrap {
	background: none;
}
.badge-locked .badge-icon {
	filter: grayscale(1);
	opacity: 0.75;
	width: 66rpx;
	height: 66rpx;
}
.badge-locked .badge-name {
	color: var(--ink-400);
	font-weight: 500;
}
.hv {
	opacity: 0.85;
}

/* ---------- 数据洞察 ---------- */
.insight-card {
	margin-top: 24rpx;
}
.insight-head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
}
.insight-title {
	font-size: 30rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.insight-sub {
	font-size: 24rpx;
	color: var(--ink-400);
}
.insight-bars {
	display: flex;
	align-items: flex-end;
	gap: 14rpx;
	margin-top: 28rpx;
}
.insight-col {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8rpx;
}
.insight-col-val {
	font-size: 20rpx;
	color: var(--ink-500);
}
.insight-bar-track {
	height: 120rpx;
	width: 100%;
	display: flex;
	align-items: flex-end;
}
.insight-bar {
	width: 100%;
	min-height: 8rpx;
	border-radius: 8rpx 8rpx 4rpx 4rpx;
	background: var(--line-100);
	transition: height 0.4s ease;
}
.insight-bar-on {
	background: linear-gradient(180deg, var(--brand-500), var(--brand-600));
}
.insight-col-label {
	font-size: 20rpx;
	color: var(--ink-400);
}
.insight-col-now {
	color: var(--brand-600);
	font-weight: 600;
}
.insight-modes {
	margin-top: 30rpx;
	border-top: 1rpx solid #eef0f6;
	padding-top: 24rpx;
	display: flex;
	flex-direction: column;
	gap: 18rpx;
}
.insight-mode-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
}
.insight-mode-name {
	width: 150rpx;
	font-size: 24rpx;
	color: var(--ink-600);
	flex-shrink: 0;
}
.insight-mode-track {
	flex: 1;
	height: 14rpx;
	border-radius: 999rpx;
	background: var(--line-100);
	overflow: hidden;
}
.insight-mode-fill {
	height: 100%;
	border-radius: 999rpx;
	background: linear-gradient(90deg, var(--brand-500), var(--brand-600));
	transition: width 0.4s ease;
}
.insight-mode-val {
	width: 90rpx;
	text-align: right;
	font-size: 22rpx;
	color: var(--ink-500);
	flex-shrink: 0;
}
.insight-empty {
	padding: 30rpx 0 6rpx;
}
.insight-empty-text {
	font-size: 24rpx;
	color: var(--ink-400);
}

/* ---------- 勋章仪式感（Phase 1.9） ---------- */
.badge-fest {
	position: fixed;
	inset: 0;
	z-index: 999;
	display: flex;
	align-items: center;
	justify-content: center;
}
.badge-fest-mask {
	position: absolute;
	inset: 0;
	background: rgba(8, 14, 30, 0.86);
	backdrop-filter: blur(8px);
	animation: fest-fade 0.3s ease both;
}
.badge-fest-body {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	animation: fest-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.fest-particles {
	position: absolute;
	left: 50%;
	top: 80px;
	width: 0;
	height: 0;
	pointer-events: none;
}
.fest-dot {
	position: absolute;
	left: 0;
	top: 0;
	border-radius: 50%;
	background: radial-gradient(circle at 35% 35%, #ffe9b0, #f5b942);
	box-shadow: 0 0 12rpx rgba(245, 185, 66, 0.9);
	opacity: 0;
	transform: translate(-50%, -50%) scale(0.4);
	animation: fest-fly 1.7s ease-out infinite;
}
.fest-icon-wrap {
	position: relative;
	width: 300rpx;
	height: 300rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.fest-icon {
	width: 260rpx;
	height: 260rpx;
	filter: drop-shadow(0 0 24px rgba(255, 200, 80, 0.65));
	animation: fest-breathe 2.4s ease-in-out 0.6s infinite;
}
.fest-halo {
	position: absolute;
	inset: -6rpx;
	border-radius: 50%;
	border: 2rpx dashed rgba(255, 205, 96, 0.55);
	animation: fest-spin 9s linear infinite;
}
.fest-title {
	margin-top: 56rpx;
	font-size: 28rpx;
	color: rgba(255, 255, 255, 0.65);
	letter-spacing: 8rpx;
}
.fest-name {
	margin-top: 18rpx;
	font-size: 52rpx;
	font-weight: 700;
	color: #ffd479;
	text-shadow: 0 2rpx 18rpx rgba(245, 185, 66, 0.45);
}
.fest-hint {
	margin-top: 72rpx;
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.4);
}
@keyframes fest-fly {
	0% {
		opacity: 0;
		transform: translate(-50%, -50%) scale(0.4);
	}
	15% {
		opacity: 1;
	}
	100% {
		opacity: 0;
		transform: translate(calc(-50% + var(--px)), calc(-50% + var(--py))) scale(1);
	}
}
@keyframes fest-pop {
	0% {
		transform: scale(0.2);
		opacity: 0;
	}
	60% {
		transform: scale(1.12);
	}
	100% {
		transform: scale(1);
		opacity: 1;
	}
}
@keyframes fest-fade {
	from {
		opacity: 0;
	}
	to {
		opacity: 1;
	}
}
@keyframes fest-spin {
	to {
		transform: rotate(360deg);
	}
}
@keyframes fest-breathe {
	0%,
	100% {
		transform: scale(1);
	}
	50% {
		transform: scale(1.06);
	}
}
</style>
