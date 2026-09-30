<template>
	<view class="page">
		<view class="card profile-card">
			<view class="avatar">{{ (session?.user?.name || "未")[0] }}</view>
			<view class="profile-info">
				<text class="profile-name">{{ session?.user?.name || "未登录" }}</text>
				<text class="profile-email">{{ session?.user?.email || "" }}</text>
			</view>
		</view>

		<view class="card">
			<view class="menu-item" @tap="goNotebooks">
				<text>我的错题本</text>
				<text class="menu-arrow">›</text>
			</view>
			<view class="menu-item" @tap="goStats">
				<text>数据统计</text>
				<text class="menu-arrow">›</text>
			</view>
		</view>

		<button class="btn-outline logout-btn" @tap="handleLogout">退出登录</button>
	</view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { getSession, logout, type Session } from "@/utils/auth";

const session = ref<Session | null>(null);

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
		success: (res) => {
			if (res.confirm) {
				logout();
			}
		},
	});
}
</script>

<style scoped>
.profile-card {
	display: flex;
	align-items: center;
}
.avatar {
	width: 100rpx;
	height: 100rpx;
	border-radius: 50%;
	background: #f97316;
	color: #ffffff;
	font-size: 44rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 24rpx;
}
.profile-info {
	display: flex;
	flex-direction: column;
}
.profile-name {
	font-size: 32rpx;
	font-weight: 600;
}
.profile-email {
	font-size: 24rpx;
	color: #9ca3af;
	margin-top: 6rpx;
}
.menu-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 24rpx 0;
	font-size: 30rpx;
}
.menu-item + .menu-item {
	border-top: 1rpx solid #f3f4f6;
}
.menu-arrow {
	color: #d1d5db;
	font-size: 36rpx;
}
.logout-btn {
	margin: 40rpx 24rpx;
	color: #ef4444;
	border-color: #fecaca;
}
</style>
