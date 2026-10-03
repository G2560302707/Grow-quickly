<template>
	<view class="page">
		<!-- 快速上手 -->
		<view class="card fade-up">
			<view class="section-head">
				<text class="section-title">快速上手</text>
			</view>
			<view v-for="(s, i) in guides" :key="s.title" class="guide-row">
				<text class="guide-no num">{{ i + 1 }}</text>
				<view class="guide-info">
					<text class="guide-title">{{ s.title }}</text>
					<text class="guide-desc">{{ s.desc }}</text>
				</view>
			</view>
		</view>

		<!-- 常见问题 -->
		<view class="card fade-up">
			<view class="section-head">
				<text class="section-title">常见问题</text>
			</view>
			<view v-for="(f, i) in faqs" :key="f.q" class="faq-item">
				<view class="faq-head" hover-class="hv" @tap="toggleFaq(i)">
					<text class="faq-q">{{ f.q }}</text>
					<text class="faq-arrow" :class="{ 'faq-arrow-open': expanded === i }">›</text>
				</view>
				<view v-if="expanded === i" class="faq-body">
					<text class="faq-a">{{ f.a }}</text>
				</view>
			</view>
		</view>

		<!-- 薄弱点算法说明 -->
		<view class="card fade-up">
			<view class="section-head">
				<text class="section-title">薄弱点是怎么算出来的？</text>
				<text class="section-extra">算法透明</text>
			</view>
			<text class="algo-lead">系统能自动告诉你哪一块薄弱——靠的不是拍脑袋，是三层证据打分：</text>
			<view class="algo-step" v-for="(st, i) in algoSteps" :key="i">
				<text class="algo-no num">{{ i + 1 }}</text>
				<view class="algo-body">
					<text class="algo-t">{{ st.t }}</text>
					<text class="algo-d">{{ st.d }}</text>
				</view>
			</view>
			<text class="algo-note">一句话：最近反复错、还没掌握的知识点，就是你最该练的地方。在「学习统计 → 薄弱点诊断」查看排名，点「专项练习」直接定向出题；练错的题会自动收进错题本，让诊断越来越准。</text>
		</view>

		<!-- 意见反馈 -->
		<view class="card fade-up">
			<view class="section-head">
				<text class="section-title">意见反馈</text>
				<text class="section-extra">反馈直达管理员</text>
			</view>

			<view class="fb-types">
				<view
					v-for="t in fbTypes"
					:key="t.value"
					class="chip"
					:class="{ 'chip-active': fbType === t.value }"
					hover-class="hv"
					@tap="fbType = t.value"
				>
					{{ t.label }}
				</view>
			</view>

			<view class="fb-content-wrap">
				<textarea
					v-model="fbContent"
					class="fb-textarea"
					placeholder="说说你的建议或遇到的问题（至少 5 个字）..."
					placeholder-class="ph"
					:maxlength="500"
					auto-height
				/>
				<text class="fb-counter num">{{ fbContent.length }}/500</text>
			</view>

			<view class="fb-contact-row">
				<input
					v-model="fbContact"
					class="fb-contact-input"
					type="text"
					placeholder="联系方式（选填，方便回复你）"
					placeholder-class="ph"
					:maxlength="100"
				/>
			</view>

			<button class="btn-primary fb-submit" :disabled="submitting || fbContent.trim().length < 5" hover-class="button-hover" @tap="handleSubmit">
				{{ submitting ? "提交中..." : "提交反馈" }}
			</button>
			<text v-if="fbDone" class="fb-done">已收到你的反馈，感谢支持！</text>
		</view>

		<view class="version-row">
			<text class="version-text">智能错题本 · v1.0.0 · 数据与网页端实时同步</text>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { submitFeedback, type FeedbackType } from "@/api";

const guides = [
	{ title: "拍照识题", desc: "在「识别」页拍摄或选择题目截图，AI 自动提取题目、答案与解析" },
	{ title: "错题归档", desc: "识别结果保存到对应错题本，可补充个人笔记与掌握度标记" },
	{ title: "举一反三", desc: "在错题详情页生成同难度练习题，检验是否真正掌握" },
];

const algoSteps = [
	{
		t: "每道错题都带知识点标签",
		d: "AI 识别时自动打标（如「削弱论证」），练习答错的题也会带着来源自动收进错题本。",
	},
	{
		t: "按「新鲜度 × 掌握程度」折算失败证据",
		d: "45 天前的错题权重减半，已掌握的错题几乎不再计入——系统只关心你现在还错什么。",
	},
	{
		t: "三个信号合成虚弱分排名",
		d: "失败多少（60%）+ 是否反复错（20%）+ 还没学会的比例（20%），合成 0~100 分，另附恶化/改善趋势。",
	},
];

const faqs = [
	{
		q: "小程序和网页端数据互通吗？",
		a: "互通。两端使用同一账号体系与数据库，网页端录入的错题会实时出现在小程序中，掌握度、笔记等操作也双向同步。",
	},
	{
		q: "AI 识别失败怎么办？",
		a: "先检查照片是否清晰、光线是否充足、单次只拍一道题。若提示 AI_UNKNOWN_ERROR 等系统级错误，多为 AI 服务配置或余额问题，请联系管理员检查服务端 AI 设置。",
	},
	{
		q: "如何提高识别准确率？",
		a: "尽量使用相机直接拍摄印刷体题目，保持题目端正、占满画面；截图识别时选择文字清晰的图片，避免包含大片无关内容。",
	},
	{
		q: "掌握度是怎么计算的？",
		a: "每道错题有未掌握、复习中、已掌握三档，可在错题详情页手动标记；做错的练习也会作为复习参考。掌握率 = 已掌握错题 / 总错题数。",
	},
	{
		q: "忘记密码怎么办？",
		a: "请联系管理员在后台重置密码，重置后使用新密码登录，小程序与网页端即时生效。",
	},
];

const fbTypes = [
	{ value: "feature" as FeedbackType, label: "功能建议" },
	{ value: "bug" as FeedbackType, label: "问题反馈" },
	{ value: "other" as FeedbackType, label: "其他" },
];

const expanded = ref<number | null>(null);
const fbType = ref<FeedbackType>("feature");
const fbContent = ref("");
const fbContact = ref("");
const submitting = ref(false);
const fbDone = ref(false);

function toggleFaq(i: number) {
	expanded.value = expanded.value === i ? null : i;
}

async function handleSubmit() {
	const content = fbContent.value.trim();
	if (content.length < 5) {
		uni.showToast({ title: "反馈内容至少 5 个字", icon: "none" });
		return;
	}
	submitting.value = true;
	fbDone.value = false;
	try {
		await submitFeedback({
			type: fbType.value,
			content,
			contact: fbContact.value.trim() || undefined,
		});
		fbContent.value = "";
		fbContact.value = "";
		fbDone.value = true;
		uni.showToast({ title: "反馈已提交", icon: "success" });
	} catch (e: any) {
		uni.showToast({ title: e?.message || "提交失败，请稍后重试", icon: "none" });
	} finally {
		submitting.value = false;
	}
}
</script>

<style scoped>
/* ---------- 快速上手 ---------- */
.guide-row {
	display: flex;
	align-items: flex-start;
	padding: 18rpx 0;
}
.guide-no {
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
	margin-right: 20rpx;
	flex-shrink: 0;
	margin-top: 2rpx;
}
.guide-info {
	display: flex;
	flex-direction: column;
	flex: 1;
}
.guide-title {
	font-size: 29rpx;
	font-weight: 600;
	color: var(--ink-900);
}
.guide-desc {
	font-size: 24rpx;
	color: var(--ink-500);
	line-height: 1.7;
	margin-top: 6rpx;
}

/* ---------- FAQ ---------- */
.faq-item + .faq-item {
	border-top: 1rpx solid var(--line-50);
}
.faq-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 26rpx 0;
}
.faq-q {
	font-size: 28rpx;
	color: var(--ink-900);
	font-weight: 500;
	flex: 1;
}
.faq-arrow {
	font-size: 36rpx;
	color: var(--ink-300);
	font-weight: 300;
	transform: rotate(90deg);
	transition: transform 0.2s ease;
}
.faq-arrow-open {
	transform: rotate(270deg);
}
.faq-body {
	padding: 0 0 26rpx;
}
.faq-a {
	font-size: 26rpx;
	color: var(--ink-500);
	line-height: 1.75;
}
.hv {
	opacity: 0.8;
}

/* ---------- 反馈表单 ---------- */
.fb-types {
	display: flex;
	gap: 16rpx;
	margin-bottom: 24rpx;
}
.fb-content-wrap {
	position: relative;
	background: var(--bg-fill);
	border-radius: 16rpx;
	padding: 24rpx;
}
.fb-textarea {
	width: 100%;
	min-height: 180rpx;
	font-size: 28rpx;
	color: var(--ink-900);
	line-height: 1.7;
	box-sizing: border-box;
}
.fb-counter {
	position: absolute;
	right: 24rpx;
	bottom: 16rpx;
	font-size: 20rpx;
	color: var(--ink-300);
}
.fb-contact-row {
	margin-top: 20rpx;
}
.fb-contact-input {
	background: var(--bg-fill);
	border-radius: 16rpx;
	padding: 22rpx 24rpx;
	font-size: 26rpx;
	color: var(--ink-900);
	width: 100%;
	box-sizing: border-box;
}
.fb-submit {
	margin-top: 28rpx;
}
.fb-done {
	display: block;
	text-align: center;
	font-size: 24rpx;
	color: var(--success-600);
	margin-top: 20rpx;
}

/* ---------- 页脚 ---------- */
.version-row {
	display: flex;
	justify-content: center;
	padding: 20rpx 0 calc(env(safe-area-inset-bottom) + 32rpx);
}
.version-text {
	font-size: 22rpx;
	color: var(--ink-300);
}
.algo-lead {
	display: block;
	font-size: 26rpx;
	color: var(--ink-700, #4a5568);
	line-height: 1.7;
	margin-bottom: 20rpx;
}
.algo-step {
	display: flex;
	align-items: flex-start;
	gap: 18rpx;
	padding: 18rpx 0;
	border-bottom: 1rpx solid var(--line-100);
}
.algo-no {
	flex-shrink: 0;
	width: 40rpx;
	height: 40rpx;
	border-radius: 50%;
	background: var(--brand-50);
	color: var(--brand-600);
	font-size: 22rpx;
	font-weight: 700;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-top: 2rpx;
}
.algo-body {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}
.algo-t {
	font-size: 27rpx;
	font-weight: 600;
	color: var(--ink-900);
}
.algo-d {
	font-size: 24rpx;
	color: var(--ink-400);
	line-height: 1.6;
}
.algo-note {
	display: block;
	margin-top: 20rpx;
	font-size: 24rpx;
	color: var(--ink-400);
	line-height: 1.7;
}
</style>
