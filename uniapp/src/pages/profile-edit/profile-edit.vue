<template>
	<view :class="['page', themeCls]">
		<view class="card fade-up">
			<view v-if="profileLoading" class="loading-box">
				<view class="skel sk-line sk-lg" />
				<view class="skel sk-line sk-md" />
			</view>
			<template v-else>
				<!-- 邮箱（只读）；微信占位邮箱不展示 -->
				<view v-if="showEmailField" class="field">
					<view class="field-head">
						<text class="field-label">登录邮箱</text>
						<text class="field-hint">修改邮箱请到网页端</text>
					</view>
					<view class="field-input field-readonly">{{ profile.email || "—" }}</view>
				</view>
				<view class="field">
					<view class="field-head">
						<text class="field-label">昵称</text>
					</view>
					<view class="field-box">
						<text v-if="!name" class="field-ph">怎么称呼你</text>
						<input v-model="name" class="field-core" type="text" :maxlength="30" />
					</view>
				</view>

				<view class="divider" />

				<view class="field">
					<view class="field-head">
						<text class="field-label">新密码</text>
						<text class="field-hint">留空表示不修改密码</text>
					</view>
					<view class="field-box">
						<text v-if="!password" class="field-ph">至少 6 位</text>
						<input v-model="password" class="field-core" type="password" password />
					</view>
				</view>
				<view v-if="password" class="field">
					<view class="field-head">
						<text class="field-label">确认新密码</text>
					</view>
					<view class="field-box">
						<text v-if="!confirmPassword" class="field-ph">再输入一次新密码</text>
						<input v-model="confirmPassword" class="field-core" type="password" password />
					</view>
				</view>

				<view v-if="errorMsg" class="error-tip">{{ errorMsg }}</view>
				<button class="btn-primary save-btn" :disabled="saving" hover-class="button-hover" @tap="handleSave">
					{{ saving ? "保存中..." : "保存修改" }}
				</button>
			</template>
		</view>

		<view class="tip-row">
			<text class="tip-text">修改后小程序与网页端即时同步生效</text>
		</view>
	</view>
</template>

<script setup lang="ts">
import { useThemeClass } from "@/utils/theme";

const themeCls = useThemeClass();
import { ref, computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { getUserProfile, updateUserProfile, type UserProfile } from "@/api";

const profile = ref<UserProfile>({ name: "", email: "" });
const name = ref("");
const password = ref("");
const confirmPassword = ref("");
const profileLoading = ref(true);
const saving = ref(false);
const errorMsg = ref("");

const showEmailField = computed(() => {
	const email = profile.value.email || "";
	return !!email && !/@wechat\.local$/i.test(email);
});

onShow(async () => {
	profileLoading.value = true;
	try {
		const data = await getUserProfile();
		profile.value = data;
		name.value = data.name || "";
	} catch (e: any) {
		uni.showToast({ title: e?.message || "加载失败", icon: "none" });
	} finally {
		profileLoading.value = false;
	}
});

async function handleSave() {
	if (!name.value.trim()) {
		errorMsg.value = "昵称不能为空";
		return;
	}
	if (password.value && password.value.length < 6) {
		errorMsg.value = "新密码至少 6 位";
		return;
	}
	if (password.value && password.value !== confirmPassword.value) {
		errorMsg.value = "两次输入的密码不一致";
		return;
	}
	saving.value = true;
	errorMsg.value = "";
	try {
		const payload: { name?: string; password?: string } = { name: name.value.trim() };
		if (password.value) payload.password = password.value;
		await updateUserProfile(payload);
		password.value = "";
		confirmPassword.value = "";
		uni.showToast({ title: "资料已更新", icon: "success" });
		setTimeout(() => uni.navigateBack(), 900);
	} catch (e: any) {
		errorMsg.value = e?.message || "保存失败";
	} finally {
		saving.value = false;
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	padding-top: 24rpx;
}
.loading-box {
	padding: 20rpx 0;
}
.sk-line {
	height: 28rpx;
	border-radius: 8rpx;
	background: #edeef5;
}
.sk-lg {
	width: 94%;
}
.sk-md {
	width: 60%;
	margin-top: 20rpx;
}
.field {
	margin-bottom: 28rpx;
}
/* 自绘占位：绕开开发者工具原生 placeholder 镜像渲染 bug（同 login 页） */
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
.field-head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	margin-bottom: 14rpx;
}
.field-label {
	font-size: 24rpx;
	color: var(--ink-500);
	font-weight: 500;
	letter-spacing: 1rpx;
}
.field-hint {
	font-size: 20rpx;
	color: var(--ink-300);
}
.field-readonly {
	color: var(--ink-400);
}
.divider {
	height: 1rpx;
	background: var(--line-100);
	margin: 12rpx 0 32rpx;
}
.error-tip {
	margin: 0 0 24rpx;
}
.save-btn {
	margin-top: 8rpx;
}
.tip-row {
	display: flex;
	justify-content: center;
	padding: 24rpx 0 calc(env(safe-area-inset-bottom) + 24rpx);
}
.tip-text {
	font-size: 22rpx;
	color: var(--ink-300);
}
</style>
