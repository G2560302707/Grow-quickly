<template>
	<view class="login-page">
		<!-- 装饰背景 -->
		<view class="deco deco-1" />
		<view class="deco deco-2" />

		<view class="brand">
			<view class="brand-mark">错</view>
			<text class="brand-name">智能错题本</text>
			<text class="brand-slogan">拍照识别 · AI 解析 · 举一反三</text>
		</view>

		<view class="form-card">
			<view class="field">
				<text class="field-label">邮箱</text>
				<input v-model="email" class="field-input" type="text" placeholder="请输入邮箱" placeholder-class="ph" />
			</view>
			<view class="field">
				<text class="field-label">密码</text>
				<input v-model="password" class="field-input" type="password" password placeholder="请输入密码" placeholder-class="ph" />
			</view>
			<view v-if="errorMsg" class="error-tip">{{ errorMsg }}</view>
			<button class="btn-primary submit-btn" :disabled="loading" hover-class="button-hover" @tap="handleLogin">
				{{ loading ? "登录中..." : "登 录" }}
			</button>
		</view>

		<text class="login-footer">— 考公备考，从每一道错题开始 —</text>
	</view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { login } from "@/utils/auth";

const email = ref("");
const password = ref("");
const loading = ref(false);
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
</script>

<style scoped>
.login-page {
	min-height: 100vh;
	background: linear-gradient(160deg, #fb923c 0%, #f97316 45%, #ea580c 100%);
	padding: 0 48rpx;
	display: flex;
	flex-direction: column;
	position: relative;
	overflow: hidden;
}
.deco {
	position: absolute;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.08);
}
.deco-1 {
	width: 420rpx;
	height: 420rpx;
	top: -160rpx;
	right: -140rpx;
}
.deco-2 {
	width: 280rpx;
	height: 280rpx;
	top: 160rpx;
	left: -120rpx;
}

.brand {
	padding-top: calc(var(--status-bar-height) + 140rpx);
	display: flex;
	flex-direction: column;
	align-items: center;
	position: relative;
}
.brand-mark {
	width: 128rpx;
	height: 128rpx;
	background: rgba(255, 255, 255, 0.2);
	border: 2rpx solid rgba(255, 255, 255, 0.5);
	border-radius: 36rpx;
	color: #ffffff;
	font-size: 64rpx;
	font-weight: 700;
	display: flex;
	align-items: center;
	justify-content: center;
	backdrop-filter: blur(8rpx);
}
.brand-name {
	color: #ffffff;
	font-size: 44rpx;
	font-weight: 700;
	margin-top: 28rpx;
	letter-spacing: 4rpx;
}
.brand-slogan {
	color: rgba(255, 255, 255, 0.85);
	font-size: 24rpx;
	margin-top: 10rpx;
	letter-spacing: 2rpx;
}

.form-card {
	background: #ffffff;
	border-radius: 32rpx;
	padding: 48rpx 40rpx;
	margin-top: 80rpx;
	box-shadow: 0 16rpx 40rpx rgba(120, 53, 15, 0.18);
	position: relative;
}
.field {
	margin-bottom: 32rpx;
}
.field-label {
	font-size: 26rpx;
	color: #6b7280;
	font-weight: 500;
	display: block;
	margin-bottom: 12rpx;
}
.ph {
	color: #c4c9d4;
}
.submit-btn {
	margin-top: 16rpx;
}
.login-footer {
	text-align: center;
	color: rgba(255, 255, 255, 0.75);
	font-size: 22rpx;
	padding: 56rpx 0 calc(env(safe-area-inset-bottom) + 48rpx);
	letter-spacing: 1rpx;
}
</style>
