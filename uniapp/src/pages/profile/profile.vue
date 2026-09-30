<template>
	<view class="page">
		<!-- 渐变头部 -->
		<view class="header">
			<view class="deco deco-1" />
			<view class="user-row">
				<view class="avatar">{{ avatarChar }}</view>
				<view class="user-info">
					<text class="user-name">{{ session?.user?.name || "未登录" }}</text>
					<text class="user-email">{{ session?.user?.email || "" }}</text>
				</view>
			</view>
		</view>

		<!-- 菜单 -->
		<view class="card menu-card">
			<view class="menu-item" hover-class="hv" @tap="goNotebooks">
				<view class="menu-icon" style="background: #fff7ed; color: #ea580c">📖</view>
				<text class="menu-text">我的错题本</text>
				<text class="menu-arrow">›</text>
			</view>
			<view class="menu-item" hover-class="hv" @tap="goStats">
				<view class="menu-icon" style="background: #eff6ff; color: #2563eb">📊</view>
				<text class="menu-text">数据统计</text>
				<text class="menu-tag">开发中</text>
				<text class="menu-arrow">›</text>
			</view>
		</view>

		<view class="card version-card">
			<text class="version-text">智能错题本 · v1.0.0</text>
		</view>

		<button class="btn-outline logout-btn" hover-class="button-hover" @tap="handleLogout">退出登录</button>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { getSession, logout, type Session } from "@/utils/auth";

const session = ref<Session | null>(null);

const avatarChar = computed(() => (session.value?.user?.name || "未")[0]);

onShow(async () => {
	session.value = await getSession();
});

function goNotebooks() {
	uni.switchTab({ url: "/pages/index/index" });
}

function goStats() {
	uni.showToast({ title: "统计功能开发中", icon: "none" });
}

function handleLogout() {
	uni.showModal({
		title: "提示",
		content: "确定退出登录吗？",
		confirmColor: "#f97316",
		success: (res) => {
			if (res.confirm) {
				logout();
			}
		},
	});
}
</script>

<style scoped>
.header {
	background: linear-gradient(160deg, #fb923c 0%, #f97316 60%, #ea580c 100%);
	padding: calc(var(--status-bar-height) + 100rpx) 40rpx 80rpx;
	position: relative;
	overflow: hidden;
}
.deco-1 {
	position: absolute;
	width: 320rpx;
	height: 320rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.1);
	top: -120rpx;
	right: -80rpx;
}
.user-row {
	display: flex;
	align-items: center;
	position: relative;
}
.avatar {
	width: 116rpx;
	height: 116rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.25);
	border: 3rpx solid rgba(255, 255, 255, 0.6);
	color: #ffffff;
	font-size: 52rpx;
	font-weight: 700;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 28rpx;
}
.user-info {
	display: flex;
	flex-direction: column;
}
.user-name {
	font-size: 38rpx;
	font-weight: 700;
	color: #ffffff;
}
.user-email {
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.8);
	margin-top: 8rpx;
}

.menu-card {
	margin-top: -48rpx;
	position: relative;
	padding: 12rpx 32rpx;
}
.menu-item {
	display: flex;
	align-items: center;
	padding: 28rpx 0;
}
.menu-item + .menu-item {
	border-top: 2rpx solid #f5f6fa;
}
.menu-icon {
	width: 72rpx;
	height: 72rpx;
	border-radius: 18rpx;
	font-size: 34rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 24rpx;
}
.menu-text {
	flex: 1;
	font-size: 30rpx;
	color: #374151;
}
.menu-tag {
	font-size: 20rpx;
	color: #9ca3af;
	background: #f5f6fa;
	padding: 4rpx 14rpx;
	border-radius: 999rpx;
	margin-right: 12rpx;
}
.menu-arrow {
	color: #d1d5db;
	font-size: 40rpx;
	font-weight: 300;
}
.version-card {
	padding: 24rpx;
	display: flex;
	justify-content: center;
}
.version-text {
	font-size: 22rpx;
	color: #c4c9d4;
}
.logout-btn {
	margin: 40rpx 24rpx calc(env(safe-area-inset-bottom) + 40rpx);
	color: #ef4444;
	border-color: #fecaca;
}
.hv {
	opacity: 0.7;
	background: #f9fafb;
}
</style>
