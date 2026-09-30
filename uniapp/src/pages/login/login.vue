<template>
	<view class="login-page">
		<view class="login-header">
			<text class="login-title">智能错题本</text>
			<text class="login-sub">AI 驱动的错题管理</text>
		</view>

		<view class="card login-form">
			<view class="field">
				<text class="label">邮箱</text>
				<input v-model="email" class="input" type="text" placeholder="请输入邮箱" />
			</view>
			<view class="field">
				<text class="label">密码</text>
				<input v-model="password" class="input" type="password" password placeholder="请输入密码" />
			</view>
			<view v-if="errorMsg" class="error-tip">{{ errorMsg }}</view>
			<button class="btn-primary login-btn" :disabled="loading" @tap="handleLogin">
				{{ loading ? "登录中..." : "登录" }}
			</button>
		</view>
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
	padding: 160rpx 0;
}
.login-header {
	display: flex;
	flex-direction: column;
	align-items: center;
	margin-bottom: 60rpx;
}
.login-title {
	font-size: 44rpx;
	font-weight: 700;
	color: #f97316;
}
.login-sub {
	font-size: 26rpx;
	color: #9ca3af;
	margin-top: 12rpx;
}
.login-form {
	margin: 0 40rpx;
}
.field {
	margin-bottom: 28rpx;
}
.label {
	font-size: 26rpx;
	color: #6b7280;
	display: block;
	margin-bottom: 10rpx;
}
.input {
	background: #f3f4f6;
	border-radius: 12rpx;
	padding: 20rpx 24rpx;
	font-size: 28rpx;
}
.login-btn {
	margin-top: 20rpx;
}
</style>
