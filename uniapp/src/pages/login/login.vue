<template>
	<view class="login-page">
		<!-- 装饰：同心环 + 光晕 -->
		<view class="deco-ring deco-ring-1" />
		<view class="deco-ring deco-ring-2" />
		<view class="deco-glow" />
		<view class="deco-grid" />

		<view class="brand">
			<view class="brand-mark">
				<text class="brand-mark-char">错</text>
				<view class="brand-mark-dot" />
			</view>
			<text class="brand-name">智能错题本</text>
			<text class="brand-slogan">AI 驱动的错题管理与提分系统</text>
			<view class="feature-row">
				<view class="feature-chip"><text class="feature-chip-text">拍照识题</text></view>
				<view class="feature-chip"><text class="feature-chip-text">AI 解析</text></view>
				<view class="feature-chip"><text class="feature-chip-text">举一反三</text></view>
			</view>
		</view>

		<view class="form-card">
			<text class="form-title">账号登录</text>
			<text class="form-sub">使用注册邮箱登录，同步网页端全部数据</text>
			<view class="field">
				<text class="field-label">邮箱</text>
				<view class="field-box">
					<text v-if="!email" class="field-ph">请输入邮箱</text>
					<input v-model="email" class="field-core" type="text" />
				</view>
			</view>
			<view class="field">
				<text class="field-label">密码</text>
				<view class="field-box">
					<text v-if="!password" class="field-ph">请输入密码</text>
					<input v-model="password" class="field-core" type="password" password />
				</view>
			</view>
			<view v-if="errorMsg" class="error-tip login-error">{{ errorMsg }}</view>
			<button class="btn-primary submit-btn" :disabled="loading" hover-class="button-hover" @tap="handleLogin">
				{{ loading ? "登录中..." : "登 录" }}
			</button>
			<!-- #ifdef MP-WEIXIN -->
			<view class="wx-divider">
				<view class="wx-divider-line" />
				<text class="wx-divider-text">或</text>
				<view class="wx-divider-line" />
			</view>
			<button class="wx-btn" :disabled="wxLoading" hover-class="button-hover" @tap="handleWeChatLogin">
				{{ wxLoading ? "微信登录中..." : "微信一键登录" }}
			</button>
			<!-- #endif -->
			<view class="to-register">
				<text class="to-register-tip">没有账号？</text>
				<text class="to-register-link" @tap="goRegister">立即注册</text>
			</view>
		</view>

		<view class="login-footer">
			<text class="footer-slogan">考公备考 · 从每一道错题开始</text>
			<text class="footer-copy">© 2026 智能错题本</text>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { login, loginWithWeChat } from "@/utils/auth";

const email = ref("");
const password = ref("");
const loading = ref(false);
const wxLoading = ref(false);
const errorMsg = ref("");

async function handleLogin() {
	if (!email.value.trim() || !password.value) {
		errorMsg.value = "请输入邮箱和密码";
		return;
	}
	loading.value = true;
	errorMsg.value = "";
	try {
		await login(email.value.trim(), password.value);
		uni.reLaunch({ url: "/pages/index/index" });
	} catch (e: any) {
		errorMsg.value = e?.message || "登录失败，请稍后重试";
	} finally {
		loading.value = false;
	}
}
function goRegister() {
	uni.redirectTo({ url: "/pages/register/register" });
}

async function handleWeChatLogin() {
	if (wxLoading.value) return;
	wxLoading.value = true;
	errorMsg.value = "";
	try {
		await loginWithWeChat();
		uni.reLaunch({ url: "/pages/index/index" });
	} catch (e: any) {
		errorMsg.value = e?.message || "微信登录失败，请稍后重试";
	} finally {
		wxLoading.value = false;
	}
}
</script>

<style scoped>
.login-page {
	min-height: 100vh;
	background: linear-gradient(172deg, #17224b 0%, #101a3c 52%, #0b1229 100%);
	padding: 0 48rpx;
	display: flex;
	flex-direction: column;
	position: relative;
	overflow: hidden;
}

/* ---------- 装饰 ---------- */
.deco-ring {
	position: absolute;
	border-radius: 50%;
	border: 1rpx solid rgba(255, 255, 255, 0.07);
}
.deco-ring-1 {
	width: 560rpx;
	height: 560rpx;
	top: -220rpx;
	right: -180rpx;
}
.deco-ring-2 {
	width: 380rpx;
	height: 380rpx;
	top: -140rpx;
	right: -80rpx;
	border-color: rgba(255, 255, 255, 0.1);
}
.deco-glow {
	position: absolute;
	width: 480rpx;
	height: 480rpx;
	border-radius: 50%;
	background: radial-gradient(circle, rgba(85, 104, 232, 0.32) 0%, rgba(85, 104, 232, 0) 68%);
	top: -120rpx;
	left: -160rpx;
}
.deco-grid {
	position: absolute;
	left: 0;
	right: 0;
	top: 0;
	height: 640rpx;
	background-image: linear-gradient(rgba(255, 255, 255, 0.035) 1rpx, transparent 1rpx),
		linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1rpx, transparent 1rpx);
	background-size: 64rpx 64rpx;
	mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.9), transparent);
	-webkit-mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.9), transparent);
}

/* ---------- 品牌 ---------- */
.brand {
	padding-top: calc(var(--status-bar-height) + 110rpx);
	display: flex;
	flex-direction: column;
	align-items: center;
	position: relative;
	z-index: 1;
}
.brand-mark {
	width: 132rpx;
	height: 132rpx;
	background: linear-gradient(140deg, #5568e8 0%, #3d52d5 70%);
	border-radius: 40rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
	box-shadow: 0 20rpx 48rpx rgba(61, 82, 213, 0.45), inset 0 2rpx 6rpx rgba(255, 255, 255, 0.28);
}
.brand-mark-char {
	color: #ffffff;
	font-size: 64rpx;
	font-weight: 700;
}
.brand-mark-dot {
	position: absolute;
	right: 22rpx;
	bottom: 22rpx;
	width: 14rpx;
	height: 14rpx;
	border-radius: 50%;
	background: #c9973f;
	box-shadow: 0 0 12rpx rgba(201, 151, 63, 0.9);
}
.brand-name {
	color: #ffffff;
	font-size: 44rpx;
	font-weight: 700;
	margin-top: 32rpx;
	letter-spacing: 8rpx;
}
.brand-slogan {
	color: rgba(255, 255, 255, 0.62);
	font-size: 24rpx;
	margin-top: 14rpx;
	letter-spacing: 2rpx;
}
.feature-row {
	display: flex;
	gap: 16rpx;
	margin-top: 36rpx;
}
.feature-chip {
	background: rgba(255, 255, 255, 0.08);
	border: 1rpx solid rgba(255, 255, 255, 0.14);
	border-radius: 999rpx;
	padding: 10rpx 28rpx;
}
.feature-chip-text {
	color: rgba(255, 255, 255, 0.85);
	font-size: 22rpx;
	letter-spacing: 2rpx;
}

/* ---------- 表单 ---------- */
.form-card {
	background: #ffffff;
	border-radius: 36rpx;
	padding: 52rpx 44rpx 48rpx;
	margin-top: 72rpx;
	box-shadow: 0 24rpx 64rpx rgba(5, 10, 26, 0.4);
	position: relative;
	z-index: 1;
}
.form-title {
	display: block;
	font-size: 38rpx;
	font-weight: 700;
	color: var(--ink-900);
	letter-spacing: 2rpx;
}
.form-sub {
	display: block;
	font-size: 24rpx;
	color: var(--ink-400);
	margin-top: 10rpx;
	margin-bottom: 40rpx;
}
.field {
	margin-bottom: 32rpx;
}
/* 输入框采用「外壳 + 透明内核 + 自绘占位」结构：
   微信开发者工具（部分 Windows 环境）渲染原生 placeholder 会镜像/裁切，自绘文字不受影响 */
.field-box {
	position: relative;
	background: var(--bg-fill);
	border-radius: 16rpx;
}
.field-ph {
	position: absolute;
	left: 28rpx;
	top: 0;
	height: 88rpx;
	line-height: 88rpx;
	font-size: 28rpx;
	color: var(--ink-300);
}
.field-core {
	position: relative;
	width: 100%;
	height: 88rpx;
	padding: 0 28rpx;
	box-sizing: border-box;
	font-size: 28rpx;
	color: var(--ink-900);
	background: transparent;
}
.field-label {
	font-size: 24rpx;
	color: var(--ink-500);
	font-weight: 500;
	display: block;
	margin-bottom: 14rpx;
	letter-spacing: 1rpx;
}
.login-error {
	margin: 0 0 24rpx;
}
.submit-btn {
	margin-top: 8rpx;
}

/* ---------- 微信一键登录 ---------- */
.wx-divider {
	display: flex;
	align-items: center;
	margin: 32rpx 0 28rpx;
}
.wx-divider-line {
	flex: 1;
	height: 1rpx;
	background: var(--ink-100, #e5e7eb);
}
.wx-divider-text {
	font-size: 22rpx;
	color: var(--ink-300);
	padding: 0 20rpx;
}
.wx-btn {
	width: 100%;
	height: 88rpx;
	line-height: 88rpx;
	border-radius: 20rpx;
	background: #07c160;
	color: #ffffff;
	font-size: 30rpx;
	font-weight: 600;
	border: none;
}
.wx-btn::after {
	border: none;
}
.wx-btn[disabled] {
	opacity: 0.6;
	color: #ffffff;
	background: #07c160;
}
.to-register {
	display: flex;
	align-items: center;
	justify-content: center;
	margin-top: 28rpx;
}
.to-register-tip {
	font-size: 24rpx;
	color: var(--ink-400);
}
.to-register-link {
	font-size: 24rpx;
	color: var(--brand-600);
	font-weight: 600;
	margin-left: 8rpx;
}

/* ---------- 页脚 ---------- */
.login-footer {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-end;
	padding-bottom: calc(env(safe-area-inset-bottom) + 40rpx);
	position: relative;
	z-index: 1;
}
.footer-slogan {
	color: rgba(255, 255, 255, 0.42);
	font-size: 22rpx;
	letter-spacing: 3rpx;
}
.footer-copy {
	color: rgba(255, 255, 255, 0.26);
	font-size: 20rpx;
	margin-top: 12rpx;
	letter-spacing: 1rpx;
}
</style>
