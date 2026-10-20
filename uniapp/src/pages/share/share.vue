<template>
	<view :class="['page', themeCls]">
		<!-- 品牌条：两类入口都保留统一标识，弱化「像私人页面」的观感 -->
		<view class="brand-bar">
			<view class="brand-logo">错</view>
			<view class="brand-text">
				<text class="brand-name">智能错题本</text>
				<text class="brand-sub">{{ singlePage ? "来自同学的朋友圈分享" : "同学分享的一道错题" }}</text>
			</view>
			<text v-if="singlePage" class="brand-flag">单页浏览</text>
		</view>

		<template v-if="loading">
			<view class="card">
				<view class="skel sk-line sk-lg" />
				<view class="skel sk-line sk-md" />
				<view class="skel sk-line sk-sm" />
			</view>
			<view class="card">
				<view class="skel sk-line sk-lg" />
				<view class="skel sk-line sk-md" />
			</view>
		</template>

		<view v-else-if="errorMsg" class="state-wrap">
			<text class="state-title">这个分享打不开了</text>
			<text class="state-desc">{{ errorMsg }}</text>
			<button v-if="!singlePage" class="btn-primary state-btn" hover-class="button-hover" @tap="goHome">
				打开智能错题本
			</button>
			<text v-else class="state-hint">可点击底部「前往小程序」进入完整小程序</text>
		</view>

		<template v-else-if="item">
			<view v-if="item.imageUrl" class="card image-card fade-up">
				<image class="origin-image" :src="item.imageUrl" mode="widthFix" @tap="previewImage" />
				<view class="image-hint">点击查看大图</view>
			</view>

			<view class="card fade-up">
				<view class="section-head">
					<text class="section-title">题目</text>
					<text v-if="item.subjectName" class="section-extra">{{ item.subjectName }}</text>
				</view>
				<MdRich v-if="item.questionText" :content="item.questionText" />
				<text v-else class="muted">这道题只保留了原图，可放大图片查看题干</text>

				<view class="answer-grid">
					<view v-if="item.wrongAnswerText" class="answer-box answer-wrong">
						<text class="answer-label">同学的答案</text>
						<MdRich :content="item.wrongAnswerText" />
					</view>
					<view v-if="item.answerText" class="answer-box answer-right">
						<text class="answer-label">正确答案</text>
						<MdRich :content="item.answerText" />
					</view>
				</view>
			</view>

			<view v-if="item.analysis" class="card fade-up">
				<view class="section-title">解析</view>
				<MdRich :content="item.analysis" />
			</view>

			<view v-if="item.tagNames?.length" class="card fade-up">
				<view class="section-title">考点标签</view>
				<view class="tag-row">
					<text v-for="tag in item.tagNames" :key="tag" class="tag">{{ tag }}</text>
				</view>
			</view>

			<!-- 单页模式下路由被禁用，只保留文案引导；普通模式给出真正可点的入口 -->
			<view v-if="singlePage" class="single-page-tip">
				点击底部「前往小程序」，可拍照整理自己的错题、查看完整解析与举一反三练习
			</view>
			<template v-else>
				<view class="cta-card">
					<text class="cta-title">整理错题，比多刷十套卷更有效</text>
					<text class="cta-sub">拍照 3 秒录入，AI 自动识别题目、答案与考点</text>
					<button class="btn-primary cta-btn" hover-class="button-hover" @tap="goHome">
						免费拍照整理我的错题
					</button>
					<button class="btn-ghost" open-type="share" hover-class="button-hover">
						转给同学
					</button>
					<!-- 朋友圈只能由右上角菜单发起：微信未开放「代码直接调起朋友圈」的能力，
					     这里只做路径告知，不做诱导 -->
					<text class="cta-hint">想发朋友圈？点右上角「···」→ 分享到朋友圈</text>
				</view>
				<view class="bottom-placeholder" />
			</template>
		</template>
	</view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad, onShow, onShareAppMessage, onShareTimeline } from "@dcloudio/uni-app";
import { getSharedErrorItem, type SharedErrorItem } from "@/api";
import MdRich from "@/components/MdRich.vue";
import { useThemeClass } from "@/utils/theme";
import {
	SHARE_COVER,
	SHARE_TIMELINE_TITLE,
	buildSharePath,
	buildTimelineQuery,
	enableShareMenu,
	isSinglePageMode,
	prepareShareImage,
	shareTitleFrom,
} from "@/utils/share";

const themeCls = useThemeClass();

const loading = ref(true);
const errorMsg = ref("");
const item = ref<SharedErrorItem | null>(null);
/** 朋友圈单页模式（scene 1154）：无登录态、禁止路由跳转 */
const singlePage = ref(false);
const shareImage = ref(SHARE_COVER);
const shareTitle = ref(SHARE_TIMELINE_TITLE);

let shareItemId = "";
let shareToken = "";

onLoad(async (query) => {
	singlePage.value = isSinglePageMode();
	shareItemId = String(query?.id || "");
	shareToken = String(query?.t || "");

	if (!shareItemId || !shareToken) {
		errorMsg.value = "分享参数不完整，请让对方在小程序内重新分享";
		loading.value = false;
		return;
	}

	try {
		const data = await getSharedErrorItem(shareItemId, shareToken);
		item.value = data;
		// 分享卡优先用题干摘要，便于在会话/朋友圈里辨认
		shareTitle.value = shareTitleFrom(data.questionText, SHARE_TIMELINE_TITLE);
		prepareShareImage(data.imageUrl).then((path) => {
			shareImage.value = path;
		});
	} catch (e: any) {
		errorMsg.value = e?.message || "分享内容加载失败，请稍后重试";
	} finally {
		loading.value = false;
	}
});

function goHome() {
	// 单页模式下 reLaunch 被微信禁用，调用会弹「请前往小程序使用完整服务」
	if (singlePage.value) return;
	uni.reLaunch({ url: "/pages/index/index" });
}

// 本页是朋友圈分享的主载体：每次显示都确保菜单里有「分享到朋友圈」
onShow(() => {
	enableShareMenu();
});

function previewImage() {
	if (item.value?.imageUrl) {
		uni.previewImage({ urls: [item.value.imageUrl] });
	}
}

onShareAppMessage(() => ({
	title: shareTitle.value,
	path: buildSharePath(shareItemId, shareToken),
	imageUrl: shareImage.value,
}));

onShareTimeline(() => ({
	title: shareTitle.value,
	query: buildTimelineQuery(shareItemId, shareToken),
	imageUrl: shareImage.value,
}));
</script>

<style scoped>
/* ---------- 品牌条 ---------- */
.brand-bar {
	display: flex;
	align-items: center;
	gap: 20rpx;
	padding: 32rpx 32rpx 8rpx;
}
.brand-logo {
	width: 64rpx;
	height: 64rpx;
	border-radius: 18rpx;
	background: linear-gradient(135deg, var(--brand-500), var(--brand-600));
	color: #ffffff;
	font-size: 30rpx;
	font-weight: 700;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: var(--shadow-primary);
}
.brand-text {
	flex: 1;
	display: flex;
	flex-direction: column;
}
.brand-name {
	font-size: 28rpx;
	font-weight: 600;
	color: var(--ink-900);
	letter-spacing: 1rpx;
}
.brand-sub {
	font-size: 22rpx;
	color: var(--ink-400);
	margin-top: 4rpx;
}
.brand-flag {
	font-size: 20rpx;
	color: var(--gold-600);
	background: var(--gold-50);
	border: 1rpx solid var(--gold-100);
	border-radius: 999rpx;
	padding: 4rpx 14rpx;
}

/* ---------- 骨架 ---------- */
.sk-line {
	height: 28rpx;
	border-radius: 8rpx;
}
.sk-lg {
	width: 94%;
}
.sk-md {
	width: 70%;
	margin-top: 20rpx;
}
.sk-sm {
	width: 46%;
	margin-top: 20rpx;
}

/* ---------- 图片 ---------- */
.origin-image {
	width: 100%;
	border-radius: 16rpx;
	display: block;
}
.image-hint {
	font-size: 22rpx;
	color: var(--ink-300);
	text-align: center;
	margin-top: 16rpx;
}

/* ---------- 答案对比 ---------- */
.answer-grid {
	margin-top: 28rpx;
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}
.answer-box {
	border-radius: 16rpx;
	padding: 22rpx 24rpx;
	font-size: 27rpx;
	line-height: 1.7;
}
.answer-wrong {
	background: var(--danger-50);
}
.answer-right {
	background: var(--success-50);
}
.answer-label {
	display: block;
	font-size: 22rpx;
	font-weight: 600;
	margin-bottom: 10rpx;
}
.answer-wrong .answer-label {
	color: var(--danger-600);
}
.answer-right .answer-label {
	color: var(--success-600);
}

.tag-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-top: 16rpx;
}
.muted {
	font-size: 26rpx;
	color: var(--ink-400);
	line-height: 1.7;
}

/* ---------- 引导 ---------- */
.cta-card {
	margin: 8rpx 24rpx 0;
	background: linear-gradient(160deg, var(--brand-800) 0%, var(--brand-900) 100%);
	border-radius: 24rpx;
	padding: 40rpx 32rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.cta-title {
	color: #ffffff;
	font-size: 30rpx;
	font-weight: 600;
	letter-spacing: 1rpx;
}
.cta-sub {
	color: rgba(255, 255, 255, 0.62);
	font-size: 23rpx;
	margin-top: 12rpx;
	text-align: center;
	line-height: 1.6;
}
.cta-btn {
	width: 100%;
	margin-top: 32rpx;
}
.btn-ghost {
	margin-top: 16rpx;
	width: 100%;
	height: 76rpx;
	line-height: 76rpx;
	font-size: 26rpx;
	color: rgba(255, 255, 255, 0.82);
	background: transparent;
	border: 2rpx solid rgba(255, 255, 255, 0.22);
	border-radius: 18rpx;
}
.btn-ghost::after {
	border: none;
}
.cta-hint {
	margin-top: 22rpx;
	font-size: 21rpx;
	color: rgba(255, 255, 255, 0.45);
	text-align: center;
	line-height: 1.6;
}
.single-page-tip {
	margin: 8rpx 24rpx 48rpx;
	padding: 28rpx 32rpx;
	border-radius: 18rpx;
	background: var(--gold-50);
	border: 1rpx solid var(--gold-100);
	color: var(--gold-600);
	font-size: 24rpx;
	line-height: 1.7;
}
.bottom-placeholder {
	height: calc(40rpx + env(safe-area-inset-bottom));
}

/* ---------- 空态 ---------- */
.state-wrap {
	padding: 160rpx 60rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.state-title {
	font-size: 32rpx;
	font-weight: 600;
	color: var(--ink-600);
}
.state-desc {
	font-size: 25rpx;
	color: var(--ink-400);
	margin-top: 18rpx;
	text-align: center;
	line-height: 1.7;
}
.state-btn {
	width: 100%;
	margin-top: 48rpx;
}
.state-hint {
	font-size: 23rpx;
	color: var(--ink-300);
	margin-top: 32rpx;
}
</style>
