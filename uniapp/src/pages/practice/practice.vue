<template>
	<view class="page">
		<!-- 出题面板：先选难度，点按钮才出题（不自动生成、不默认出题） -->
		<template v-if="phase === 'setup'">
			<view class="card setup-card fade-up">
				<view class="setup-head">
					<text class="setup-title">{{ setupTitle }}</text>
					<text class="setup-sub">{{ setupSub }}</text>
				</view>

				<view class="setup-block">
					<text class="setup-label">{{ sessionMode ? "会话难度（5 题一组）" : "选择难度" }}</text>
					<view class="diff-row">
						<view
							v-for="d in setupDifficulties"
							:key="d.value"
							class="diff-chip"
							:class="{ 'diff-chip-active': setupDifficulty === d.value }"
							hover-class="hv"
							@tap="setupDifficulty = d.value"
						>
							{{ d.label }}
						</view>
					</view>
					<text v-if="!setupDifficulty" class="setup-hint">先选一个难度（自适应模式按你的能力值实时调难度）</text>
				</view>

				<view class="setup-actions">
					<button
						class="btn-primary setup-btn"
						:disabled="!setupDifficulty || setupLoading"
						hover-class="button-hover"
						@tap="startPractice(false)"
					>
						{{ setupLoading ? "正在出题…" : sessionMode ? "开始会话" : "开始练习" }}
					</button>
					<button
						v-if="setupDifficulty"
						class="btn-outline setup-btn"
						:disabled="setupLoading"
						hover-class="button-hover"
						@tap="startPractice(true)"
					>
						{{ setupLoading ? "正在生成…" : "跳过存题，生成新题" }}
					</button>
				</view>
				<text class="setup-note">生成的题会自动存入待做题库，做不做都不丢；有存题时优先做存题，不花生成费</text>
			</view>
		</template>

		<view v-else-if="loading" class="card loading-card">
			<view class="ai-indicator">
				<view class="ai-dot" />
				<view class="ai-dot ai-dot-2" />
				<view class="ai-dot ai-dot-3" />
			</view>
			<text class="loading-title">{{ sessionBatching ? "AI 正在一次性生成整组专项题" : fromPool ? "正在取出待做题" : smartMode ? "AI 正在针对薄弱点出题" : "AI 正在出题" }}</text>
			<text class="loading-sub">{{ sessionBatching ? "批量生成更快，完成后自动开始答题" : fromPool ? "题库里有没做完的题，直接取用" : smartMode ? "结合你的错题与错因，定向生成" : "根据你的错题定制同类练习" }}</text>
			<view v-if="sessionMode && !sessionBatching" class="session-progress">
				<text class="session-progress-text num">{{ Math.min(sessionIndex + 1, sessionTotal) }} / {{ sessionTotal }}</text>
			</view>
			<view class="skel sk-line sk-lg" />
			<view class="skel sk-line sk-md" />
			<view class="skel sk-line sk-sm" />
		</view>
		<view v-else-if="errorMsg" class="card error-card">
			<view class="error-glyph">!</view>
			<text class="error-msg">{{ errorMsg }}</text>
			<button class="btn-outline retry-btn" hover-class="button-hover" @tap="retry">重新出题</button>
		</view>

		<!-- 会话小结 -->
		<template v-else-if="sessionDone">
			<view class="card summary-card fade-up">
				<view class="summary-ring" :class="sessionAllCorrect ? 'summary-ring-good' : ''">
					<text class="summary-ring-num num">{{ sessionCorrectCount }}<text class="summary-ring-unit">/{{ sessionTotal }}</text></text>
				</view>
				<text class="summary-title">{{ summaryTitle }}</text>
				<text class="summary-sub">{{ summarySub }}</text>
				<view class="summary-stats">
					<view class="summary-stat">
						<text class="summary-stat-num num">{{ firstRating }}</text>
						<text class="summary-stat-label">初始能力值</text>
					</view>
					<view class="summary-stat-divider" />
					<view class="summary-stat">
						<text class="summary-stat-num" :class="lastRating > firstRating ? 'stat-up' : 'stat-down'">{{ lastRating }}</text>
						<text class="summary-stat-label">当前能力值</text>
					</view>
				</view>
				<view class="summary-actions">
					<button class="btn-outline summary-btn" hover-class="button-hover" @tap="restartSession">再来一组</button>
					<button class="btn-primary summary-btn" hover-class="button-hover" @tap="finishSession">完成</button>
				</view>
			</view>
		</template>

		<template v-else-if="question">
			<view class="card fade-up">
				<view class="section-head">
					<text class="section-title">练习题</text>
					<text class="section-extra" :class="{ 'smart-tag': smartMode }">
						{{ sessionMode ? `第 ${sessionIndex} / ${sessionTotal} 题 · ${question.meta?.difficulty || "medium"}` : smartMode ? "薄弱点专项 · " + subjectName : subjectName }}
					</text>
				</view>
				<text class="content-text">{{ choice ? choice.stem : (question.questionText || "—") }}</text>
			</view>

			<!-- 选择题：选项按钮作答 -->
			<view v-if="choice" class="card fade-up">
				<view class="section-head">
					<text class="section-title">选择答案</text>
				</view>
				<view class="option-list">
					<view
						v-for="(opt, idx) in choice.options"
						:key="opt.label"
						class="option-item"
						:class="{
							'option-selected': !revealed && selectedOption === idx,
							'option-correct': revealed && autoResult !== null && opt.label === correctLabel,
							'option-wrong': revealed && autoResult !== null && selectedOption === idx && !autoResult,
						}"
						hover-class="hv"
						@tap="selectOption(idx)"
					>
						<text class="option-label num">{{ opt.label }}</text>
						<text class="option-text">{{ opt.text }}</text>
					</view>
				</view>
			</view>

			<!-- 非选择题：自由文本作答 -->
			<view v-else class="card fade-up">
				<view class="section-head">
					<text class="section-title">我的作答</text>
					<text class="section-extra">{{ answer.length }}/2000</text>
				</view>
				<textarea
					v-model="answer"
					class="answer-input"
					placeholder="写下你的答案和解题过程..."
					placeholder-class="ph"
					:maxlength="2000"
					auto-height
				/>
			</view>

			<template v-if="revealed">
				<view class="card fade-up">
					<view class="section-head">
						<text class="section-title">参考答案</text>
					</view>
					<text class="content-text answer-reveal">{{ question.answerText || "—" }}</text>
					<view v-if="question.analysis" class="block">
						<view class="section-title">解析</view>
						<MdView :content="question.analysis" />
					</view>
				</view>

				<!-- 选择题已自动判分：展示结果 -->
				<view v-if="autoResult !== null" class="result-banner" :class="autoResult ? 'result-good' : 'result-bad'">
					<text class="result-banner-text">{{ autoResult ? "回答正确 ✓" : "回答错误 ✗" }}</text>
				</view>

				<!-- 会话模式：记录后自动进入下一题 / 小结 -->
				<template v-if="sessionMode">
					<button
						v-if="autoResult !== null"
						class="btn-primary reveal-btn"
						hover-class="button-hover"
						@tap="finishResult"
					>
						{{ sessionResults.length + 1 >= sessionTotal ? "查看小结" : "下一题" }}
					</button>
					<view v-else class="judge-row">
						<button class="btn-outline judge-btn judge-wrong" hover-class="button-hover" @tap="record(false)">
							答错了
						</button>
						<button class="btn-primary judge-btn" hover-class="button-hover" @tap="record(true)">
							答对了
						</button>
					</view>
				</template>

				<!-- 非会话模式：记录完成后给「再来一题 / 完成」选择，不再自动退出 -->
				<template v-else>
					<view v-if="finished" class="judge-row">
						<button class="btn-outline judge-btn" hover-class="button-hover" @tap="practiceAgain">
							再来一题
						</button>
						<button class="btn-primary judge-btn" hover-class="button-hover" @tap="finishPractice">
							完成
						</button>
					</view>
					<button
						v-else-if="autoResult !== null"
						class="btn-primary reveal-btn"
						hover-class="button-hover"
						@tap="finishResult"
					>
						提交记录
					</button>
					<view v-else class="judge-row">
						<button class="btn-outline judge-btn judge-wrong" hover-class="button-hover" @tap="record(false)">
							答错了
						</button>
						<button class="btn-primary judge-btn" hover-class="button-hover" @tap="record(true)">
							答对了
						</button>
					</view>
				</template>
			</template>

			<button
				v-else
				class="btn-primary reveal-btn"
				:disabled="choice ? selectedOption === null : !answer.trim()"
				hover-class="button-hover"
				@tap="onSubmit"
			>
				提交并查看答案
			</button>
		</template>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import {
	generatePractice,
	recordPractice,
	smartGenerate,
	listPracticeQuestions,
	getPracticeQuestion,
	type ParsedQuestion,
	type SmartQuestion,
} from "@/api";
import { parseChoiceOptions, parseCorrectOption } from "@/utils/practice-choice";
import MdView from "@/components/MdView.vue";

/** 全部难度档位（与网页端对齐，多了"挑战"）；自适应仅在会话模式作为附加选项 */
const difficulties = [
	{ value: "easy", label: "简单" },
	{ value: "medium", label: "中等" },
	{ value: "hard", label: "困难" },
	{ value: "harder", label: "挑战" },
] as const;

const SESSION_TOTAL = 5;

const errorItemId = ref("");
const subjectName = ref("其他");
const question = ref<SmartQuestion | null>(null);
const answer = ref("");
const revealed = ref(false);
const loading = ref(false);
const errorMsg = ref("");
const difficulty = ref<"easy" | "medium" | "hard" | "harder">("medium");

// 选择题：解析出的选项与作答状态
const selectedOption = ref<number | null>(null);
const autoResult = ref<boolean | null>(null);
// 记录已上报（非会话模式完成后给出「再来一题 / 完成」选择）
const finished = ref(false);
const lastSavedErrorItemId = ref<string | null>(null);
const choice = computed(() => (question.value ? parseChoiceOptions(question.value.questionText) : null));
const correctLabel = computed(() => parseCorrectOption(question.value?.answerText));

// ---------- 出题面板状态 ----------
// phase=setup：先选难度再出题（不自动生成）；phase=answering：答题流程
const phase = ref<"setup" | "answering">("setup");
const setupDifficulty = ref<"easy" | "medium" | "hard" | "harder" | "adaptive" | "">("");
const setupLoading = ref(false);
/** 当前题是否取自待做题库（用于提示与重试语义） */
const fromPool = ref(false);
/** 会话中每题的取题偏好：固定难度时池优先，自适应时直接生成 */
const sessionAdaptive = computed(() => sessionMode.value && setupDifficulty.value === "adaptive");

const setupDifficulties = computed(() =>
	sessionMode.value ? [...difficulties, { value: "adaptive" as const, label: "自适应" }] : difficulties
);

const setupTitle = computed(() =>
	smartMode.value ? `薄弱点专项 · ${subjectName.value}` : errorItemId.value ? `举一反三 · ${subjectName.value}` : "自由练习"
);
const setupSub = computed(() =>
	sessionMode.value
		? "连续 5 题，作答后自动进入下一题"
		: smartMode.value
			? "针对这个考点定向出题，先把难度选好"
			: "先把难度选好，再点开始练习"
);

function selectOption(idx: number) {
	if (revealed.value) return;
	selectedOption.value = idx;
}

/** 提交作答：选择题自动判分，非选择题仅翻开答案等自评 */
function onSubmit() {
	if (revealed.value) return;
	if (choice.value) {
		if (selectedOption.value === null) return;
		const picked = choice.value.options[selectedOption.value];
		answer.value = picked.label;
		autoResult.value = correctLabel.value === null ? null : picked.label === correctLabel.value;
	} else if (!answer.value.trim()) {
		return;
	}
	revealed.value = true;
}

/** 自动判分后点击「下一题/完成」，沿用原有记录与跳转逻辑 */
function finishResult() {
	if (autoResult.value === null) return;
	record(autoResult.value);
}

// 薄弱点专项模式（mode=smart：单题；mode=session：连续一组）
const smartMode = ref(false);
const sessionMode = ref(false);
const smartTagId = ref("");
const sessionIndex = ref(0); // 当前第几题（1 起）
const sessionResults = ref<boolean[]>([]);
const sessionRatings = ref<number[]>([]);
const sessionQueue = ref<any[]>([]);       // 批量生成的一组题，答题时本地依次弹出
const sessionTotal = ref(SESSION_TOTAL);   // 会话实际题数（批量去重后可能少于 5）
const sessionBatching = ref(false);        // 正在批量生成（加载层切换文案）

const sessionCorrectCount = computed(() => sessionResults.value.filter(Boolean).length);
const sessionDone = computed(() => sessionMode.value && sessionResults.value.length >= sessionTotal.value);
const sessionAllCorrect = computed(() => sessionCorrectCount.value === sessionTotal.value);
const firstRating = computed(() => sessionRatings.value[0] ?? 1200);
const lastRating = computed(() => sessionRatings.value[sessionRatings.value.length - 1] ?? 1200);
const summaryTitle = computed(() =>
	sessionAllCorrect ? "全对！这个考点已经拿下" : sessionCorrectCount.value >= 3 ? "进步明显，继续保持" : "这个考点还需要多练"
);
const summarySub = computed(() =>
	`「${subjectName.value}」专项 ${sessionTotal.value} 题完成，难度已按你的作答自动调整`
);

onLoad((query) => {
	errorItemId.value = (query?.errorItemId as string) || "";
	subjectName.value = query?.subject ? decodeURIComponent(query.subject as string) : "其他";
	if (query?.tagId) {
		smartMode.value = true;
		smartTagId.value = query.tagId as string;
		if (query?.tagName) {
			subjectName.value = decodeURIComponent(query.tagName as string);
		}
		if (query?.mode === "session") {
			sessionMode.value = true;
			sessionIndex.value = 1;
		}
	}
	// 从待做题库「去做」直达答题：加载指定的题库题，不出题面板
	const pooledId = (query?.questionId as string) || "";
	if (pooledId) {
		phase.value = "answering";
		loading.value = true;
		getPracticeQuestion(pooledId)
			.then((q) => {
				if (q.tag?.name) subjectName.value = q.tag.name;
				else if (q.subject) subjectName.value = q.subject;
				// 带入难度上下文：之后「再来一题」取题/生成保持同一难度口径
				if (q.difficulty && q.difficulty !== "adaptive") {
					setupDifficulty.value = q.difficulty as typeof setupDifficulty.value;
					difficulty.value = q.difficulty as typeof difficulty.value;
				}
				applyPooledQuestion(q);
				fromPool.value = true;
			})
			.catch((e: any) => {
				errorMsg.value = e?.message || "题目加载失败";
			})
			.finally(() => {
				loading.value = false;
			});
		return;
	}
	// 不再自动出题：进入出题面板，由用户选难度后手动开始
	phase.value = "setup";
});

/** 出题面板 → 开始练习/会话。forceNew=true 跳过题库存题直接生成 */
async function startPractice(forceNew: boolean) {
	if (!setupDifficulty.value || setupLoading.value) return;
	phase.value = "answering";
	if (sessionMode.value) {
		// 会话模式：一次性批量生成整组题（一次 AI 调用），答题时本地翻页
		loading.value = true;
		errorMsg.value = "";
		sessionBatching.value = true;
		const ok = await prefillSession(forceNew);
		sessionBatching.value = false;
		loading.value = false;
		if (!ok) return;
		await nextQuestion(false);
		return;
	}
	loading.value = true;
	await nextQuestion(forceNew);
}

/** 题库题塑形为会话答题所需的 SmartQuestion 形状 */
function shapePooled(hit: any) {
	return {
		questionText: hit.questionText,
		answerText: hit.answerText || "",
		analysis: hit.analysis || "",
		subject: hit.subject || undefined,
		knowledgePoints: [] as string[],
		wrongAnswerText: "",
		mistakeAnalysis: "",
		mistakeStatus: "unknown",
		requiresImage: false,
		questionId: hit.id,
		meta: {
			mode: "weakness",
			tagId: hit.tagId || smartTagId.value,
			tagName: hit.tag?.name || subjectName.value,
			primaryErrorItemId: hit.errorItemId || null,
			difficulty: hit.difficulty,
			elo: typeof hit.eloRating === "number" ? { rating: hit.eloRating, attempts: 0 } : undefined,
			source: "weakness",
		},
	};
}

/** 会话开始前批量备齐整组题：先从待做题库凑数（零成本），不足的一次 AI 批量补齐 */
async function prefillSession(forceNew: boolean): Promise<boolean> {
	const fixed = setupDifficulty.value === "adaptive" ? null : (setupDifficulty.value as "easy" | "medium" | "hard" | "harder");
	const queue: any[] = [];
	try {
		if (!forceNew && fixed) {
			const pool = await listPracticeQuestions({
				status: "pending",
				channel: "smart",
				difficulty: fixed,
				...(smartTagId.value ? { tagId: smartTagId.value } : {}),
				pageSize: SESSION_TOTAL,
			});
			for (const hit of pool.questions.slice(0, SESSION_TOTAL)) {
				queue.push(shapePooled(hit));
			}
		}
		const need = SESSION_TOTAL - queue.length;
		if (need > 0) {
			// 一次 AI 调用补齐整组（批量出题），避免逐题串行等待
			const res: any = await smartGenerate(
				{ tagId: smartTagId.value, difficulty: fixed || undefined, count: need },
				{ timeout: 300000 }
			);
			const batch = Array.isArray(res?.questions) ? res.questions : [];
			for (const q of batch) {
				if (q?.questionText) queue.push(q);
			}
		}
	} catch (e: any) {
		errorMsg.value = e?.message || "题目生成失败";
		return false;
	}
	if (queue.length === 0) {
		errorMsg.value = errorMsg.value || "题目生成失败，请稍后重试";
		return false;
	}
	sessionQueue.value = queue;
	sessionTotal.value = queue.length;
	return true;
}

/** 重试：沿用上一次的取题偏好 */
function retry() {
	errorMsg.value = "";
	if (sessionMode.value) {
		loading.value = true;
		nextQuestion(false);
	} else {
		loading.value = true;
		fetchOrGenerate(false);
	}
}

/** 取一题：优先从待做题库取（同渠道+同难度+同上下文），池空或要求新题才调 AI 生成 */
async function fetchOrGenerate(forceNew: boolean): Promise<boolean> {
	const fixed = setupDifficulty.value === "adaptive" ? null : (setupDifficulty.value as "easy" | "medium" | "hard" | "harder");
	if (!forceNew && fixed) {
		try {
			const pool = await listPracticeQuestions({
				status: "pending",
				channel: smartMode.value ? "smart" : "similar",
				difficulty: fixed,
				...(smartMode.value && smartTagId.value ? { tagId: smartTagId.value } : {}),
				...(!smartMode.value && errorItemId.value ? { errorItemId: errorItemId.value } : {}),
				pageSize: 1,
			});
			const hit = pool.questions[0];
			if (hit) {
				const full = await getPracticeQuestion(hit.id);
				applyPooledQuestion(full);
				fromPool.value = true;
				uni.showToast({ title: "已从待做题库取题", icon: "none" });
				return true;
			}
		} catch (e) {
			// 题库查询失败不阻塞生成路径
		}
	}

	fromPool.value = false;
	try {
		if (smartMode.value) {
			if (sessionMode.value && sessionQueue.value.length > 0) {
				// 会话模式：批量题本地弹出（瞬时），不再逐题调 AI
				const res = sessionQueue.value.shift() as SmartQuestion;
				question.value = res;
				if (typeof res.meta?.difficulty === "string") {
					difficulty.value = res.meta.difficulty as typeof difficulty.value;
				}
				if (typeof res.meta?.elo?.rating === "number") {
					sessionRatings.value.push(res.meta.elo.rating);
				}
			} else {
				const res = await smartGenerate({
					tagId: smartTagId.value,
					difficulty: fixed || undefined,
				});
				question.value = res;
				if (typeof res.meta?.difficulty === "string") {
					difficulty.value = res.meta.difficulty as typeof difficulty.value;
				}
				if (sessionMode.value && typeof res.meta?.elo?.rating === "number") {
					sessionRatings.value.push(res.meta.elo.rating);
				}
			}
		} else {
			question.value = await generatePractice(errorItemId.value, fixed || "medium");
		}
		if (fixed) difficulty.value = fixed;
		return true;
	} catch (e: any) {
		errorMsg.value = e?.message || "生成练习题失败";
		return false;
	}
}

/** 把题库题适配成答题界面需要的形状 */
function applyPooledQuestion(q: any) {
	const meta = q.channel === "smart"
		? {
			mode: "weakness",
			tagId: q.tagId || smartTagId.value,
			tagName: q.tag?.name || subjectName.value,
			primaryErrorItemId: q.errorItemId || null,
			difficulty: q.difficulty,
			elo: typeof q.eloRating === "number" ? { rating: q.eloRating, attempts: 0 } : undefined,
			source: "weakness",
		}
		: undefined;
	question.value = {
		questionText: q.questionText,
		answerText: q.answerText || undefined,
		analysis: q.analysis || undefined,
		subject: q.subject || undefined,
		questionId: q.id,
		meta,
	};
}

/** 会话推进 / 首题加载：记录上一题结果后取下一题 */
async function nextQuestion(forceNew: boolean) {
	loading.value = true;
	errorMsg.value = "";
	revealed.value = false;
	answer.value = "";
	selectedOption.value = null;
	autoResult.value = null;
	finished.value = false;
	lastSavedErrorItemId.value = null;
	const ok = await fetchOrGenerate(forceNew);
	loading.value = false;
	if (!ok) return;
	if (sessionMode.value) {
		sessionIndex.value = sessionResults.value.length + 1;
	}
}

async function record(isCorrect: boolean) {
	const ok = await doRecord(isCorrect);

	if (!sessionMode.value) {
		if (!ok) return; // 记录失败停留在本页，自评按钮仍可重试
		if (!isCorrect && lastSavedErrorItemId.value) {
			uni.showToast({ title: "错题已自动收录到错题本", icon: "none" });
		}
		finished.value = true; // 留在本页，由用户选择「再来一题 / 完成」
		return;
	}

	if (!ok) return; // 会话模式记录失败不推进，可重试

	// 会话模式：记录结果后自动进入下一题 / 小结
	sessionResults.value.push(isCorrect);
	if (sessionResults.value.length >= sessionTotal.value) {
		loading.value = false;
		question.value = null;
		return;
	}
	await nextQuestion(false);
}

/** 上报练习记录（题库题带 questionId 联动状态，答错时后端会自动收录错题本并返回错题 ID） */
async function doRecord(isCorrect: boolean): Promise<boolean> {
	const meta = question.value?.meta;
	try {
		const res = await recordPractice(subjectName.value, question.value?.meta?.difficulty || difficulty.value, isCorrect, {
			tagId: smartMode.value ? (meta?.tagId || smartTagId.value) : undefined,
			// 举一反三锚定入口带入的原错题；专项模式用后端返回的锚题
			errorItemId: smartMode.value
				? (meta?.primaryErrorItemId || undefined)
				: (errorItemId.value || undefined),
			questionId: question.value?.questionId || undefined,
			questionText: question.value?.questionText || undefined,
			answerText: question.value?.answerText || undefined,
			analysis: question.value?.analysis || undefined,
			knowledgePoints: question.value?.knowledgePoints || undefined,
		});
		lastSavedErrorItemId.value = res?.savedErrorItemId || null;
		return true;
	} catch (e: any) {
		// 记录失败不阻塞练习流程，仅提示
		uni.showToast({ title: e?.message || "记录失败", icon: "none" });
		return false;
	}
}

/** 再来一题：优先做待做题库里的存题（零成本），池空才生成新题 */
function practiceAgain() {
	loading.value = true;
	nextQuestion(false);
}

function finishPractice() {
	uni.navigateBack();
}

function restartSession() {
	sessionResults.value = [];
	sessionRatings.value = [];
	sessionIndex.value = 1;
	sessionQueue.value = [];
	sessionTotal.value = SESSION_TOTAL;
	loading.value = true;
	errorMsg.value = "";
	sessionBatching.value = true;
	prefillSession(false).then((ok) => {
		sessionBatching.value = false;
		loading.value = false;
		if (ok) nextQuestion(false);
	});
}

function finishSession() {
	uni.navigateBack();
}
</script>

<style scoped>
/* ---------- 加载 ---------- */
.loading-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 72rpx 40rpx 48rpx;
}
.ai-indicator {
	display: flex;
	align-items: center;
	gap: 14rpx;
	margin-bottom: 28rpx;
}
.ai-dot {
	width: 16rpx;
	height: 16rpx;
	border-radius: 50%;
	background: var(--brand-600);
	animation: bounce 0.9s ease-in-out infinite;
}
.ai-dot-2 {
	animation-delay: 0.15s;
	background: var(--brand-500);
}
.ai-dot-3 {
	animation-delay: 0.3s;
	background: var(--gold-500);
}
@keyframes bounce {
	0%,
	100% {
		transform: translateY(0);
		opacity: 0.4;
	}
	50% {
		transform: translateY(-14rpx);
		opacity: 1;
	}
}
.loading-title {
	font-size: 32rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.smart-tag {
	color: var(--brand-600);
	font-weight: 600;
}
.session-progress {
	margin: 6rpx 0 24rpx;
	background: var(--brand-50);
	border: 1rpx solid var(--brand-100);
	border-radius: 999rpx;
	padding: 8rpx 28rpx;
}
.session-progress-text {
	font-size: 26rpx;
	font-weight: 700;
	color: var(--brand-600);
}
.loading-sub {
	font-size: 24rpx;
	color: var(--ink-400);
	margin: 10rpx 0 40rpx;
}
.sk-line {
	height: 28rpx;
	border-radius: 8rpx;
	width: 100%;
}
.sk-lg {
	width: 96%;
}
.sk-md {
	width: 78%;
	margin-top: 20rpx;
}
.sk-sm {
	width: 55%;
	margin-top: 20rpx;
}

/* ---------- 会话小结 ---------- */
.summary-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 64rpx 40rpx 48rpx;
}
.summary-ring {
	width: 176rpx;
	height: 176rpx;
	border-radius: 50%;
	background: var(--brand-50);
	border: 6rpx solid var(--brand-100);
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 28rpx;
}
.summary-ring-good {
	border-color: var(--success-600);
	background: var(--success-50);
}
.summary-ring-num {
	font-size: 56rpx;
	font-weight: 700;
	color: var(--brand-600);
}
.summary-ring-good .summary-ring-num {
	color: var(--success-600);
}
.summary-ring-unit {
	font-size: 28rpx;
	font-weight: 600;
}
.summary-title {
	font-size: 34rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.summary-sub {
	font-size: 24rpx;
	color: var(--ink-400);
	margin: 12rpx 0 36rpx;
	text-align: center;
}
.summary-stats {
	display: flex;
	align-items: stretch;
	width: 100%;
	background: var(--bg-fill);
	border-radius: 20rpx;
	padding: 28rpx 0;
	margin-bottom: 36rpx;
}
.summary-stat {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.summary-stat-num {
	font-size: 40rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.stat-up {
	color: var(--success-600);
}
.stat-down {
	color: var(--danger-600);
}
.summary-stat-label {
	font-size: 22rpx;
	color: var(--ink-400);
	margin-top: 8rpx;
}
.summary-stat-divider {
	width: 1rpx;
	background: var(--line-100);
}
.summary-actions {
	display: flex;
	gap: 20rpx;
	width: 100%;
}
.summary-btn {
	flex: 1;
	margin: 0;
}

/* ---------- 错误 ---------- */
.error-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 64rpx 40rpx;
}
.error-glyph {
	width: 96rpx;
	height: 96rpx;
	border-radius: 50%;
	background: var(--danger-50);
	color: var(--danger-600);
	font-size: 56rpx;
	font-weight: 700;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 24rpx;
}
.error-msg {
	font-size: 26rpx;
	color: var(--danger-600);
	text-align: center;
	line-height: 1.6;
	margin-bottom: 36rpx;
}
.retry-btn {
	padding: 0;
	height: 76rpx;
	line-height: 76rpx;
}
.hv {
	opacity: 0.85;
}

/* ---------- 难度分段选择 ---------- */
.seg-wrap {
	padding: 24rpx 24rpx 0;
}
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

/* ---------- 正文 ---------- */
.section-title {
	margin-bottom: 20rpx;
}
.content-text {
	font-size: 30rpx;
	line-height: 1.75;
	color: var(--ink-900);
	white-space: pre-wrap;
}
.answer-reveal {
	color: var(--success-600);
	font-weight: 600;
}
.block {
	margin-top: 32rpx;
}

.answer-input {
	background: var(--bg-fill);
	border-radius: 16rpx;
	padding: 24rpx;
	font-size: 28rpx;
	width: 100%;
	box-sizing: border-box;
	min-height: 160rpx;
	color: var(--ink-900);
}

/* ---------- 选择题选项 ---------- */
.option-list {
	display: flex;
	flex-direction: column;
	gap: 18rpx;
}
.option-item {
	display: flex;
	align-items: flex-start;
	gap: 20rpx;
	background: var(--bg-fill);
	border: 2rpx solid transparent;
	border-radius: 16rpx;
	padding: 24rpx;
	transition: all 0.15s ease;
}
.option-selected {
	background: var(--brand-50);
	border-color: var(--brand-500);
}
.option-correct {
	background: var(--success-50);
	border-color: var(--success-600);
}
.option-wrong {
	background: var(--danger-50);
	border-color: var(--danger-600);
}
.option-label {
	flex-shrink: 0;
	width: 48rpx;
	height: 48rpx;
	border-radius: 50%;
	background: #ffffff;
	border: 2rpx solid var(--line-100);
	color: var(--ink-600);
	font-size: 26rpx;
	font-weight: 700;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-top: 2rpx;
}
.option-selected .option-label {
	background: var(--brand-600);
	border-color: var(--brand-600);
	color: #ffffff;
}
.option-correct .option-label {
	background: var(--success-600);
	border-color: var(--success-600);
	color: #ffffff;
}
.option-wrong .option-label {
	background: var(--danger-600);
	border-color: var(--danger-600);
	color: #ffffff;
}
.option-text {
	flex: 1;
	font-size: 28rpx;
	line-height: 1.6;
	color: var(--ink-900);
}

/* ---------- 自动判分结果 ---------- */
.result-banner {
	margin: 30rpx 24rpx 0;
	border-radius: 16rpx;
	padding: 24rpx;
	text-align: center;
}
.result-banner-text {
	font-size: 30rpx;
	font-weight: 700;
}
.result-good {
	background: var(--success-50);
}
.result-good .result-banner-text {
	color: var(--success-600);
}
.result-bad {
	background: var(--danger-50);
}
.result-bad .result-banner-text {
	color: var(--danger-600);
}

.reveal-btn {
	margin: 30rpx 24rpx calc(env(safe-area-inset-bottom) + 40rpx);
}
.judge-row {
	display: flex;
	gap: 24rpx;
	margin: 30rpx 24rpx calc(env(safe-area-inset-bottom) + 40rpx);
}
.judge-btn {
	flex: 1;
	margin: 0;
}
.judge-wrong {
	color: var(--danger-600);
	border-color: rgba(217, 58, 69, 0.3);
}

/* ---------- 出题面板 ---------- */
.setup-card {
	display: flex;
	flex-direction: column;
	padding: 36rpx 32rpx;
	gap: 28rpx;
}
.setup-head {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 10rpx;
	text-align: center;
}
.setup-title {
	font-size: 34rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.setup-sub {
	font-size: 24rpx;
	color: var(--ink-400);
}
.setup-block {
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}
.setup-label {
	font-size: 26rpx;
	font-weight: 600;
	color: var(--ink-700);
}
.diff-row {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 16rpx;
}
.diff-chip {
	font-size: 26rpx;
	color: var(--ink-600);
	background: var(--bg-fill);
	border-radius: 999rpx;
	padding: 14rpx 34rpx;
	border: 2rpx solid transparent;
}
.diff-chip-active {
	color: var(--brand-600);
	background: var(--brand-50);
	border-color: var(--brand-600);
	font-weight: 600;
}
.setup-hint {
	font-size: 22rpx;
	color: var(--ink-400);
	text-align: center;
}
.setup-actions {
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}
.setup-btn {
	width: 100%;
}
.setup-note {
	font-size: 22rpx;
	color: var(--ink-400);
	line-height: 1.6;
}

</style>
