<template>
	<view class="reg-page">
		<!-- 装饰：与登录页一致 -->
		<view class="deco-ring deco-ring-1" />
		<view class="deco-ring deco-ring-2" />
		<view class="deco-glow" />
		<view class="deco-grid" />

		<view class="brand">
			<view class="brand-mark">
				<text class="brand-mark-char">错</text>
				<view class="brand-mark-dot" />
			</view>
			<text class="brand-name">创建账号</text>
			<text class="brand-slogan">注册后与网页端数据实时同步</text>
		</view>

		<view class="form-card">
			<view v-if="disabled" class="closed-tip">
				<text class="closed-tip-text">当前系统已关闭注册，请联系管理员开通账号</text>
			</view>
			<template v-else>
				<view class="field">
					<text class="field-label">昵称</text>
					<view class="field-box">
						<text v-if="!name" class="field-ph">怎么称呼你</text>
						<input v-model="name" class="field-core" type="text" :maxlength="30" />
					</view>
				</view>
				<view class="field">
					<text class="field-label">邮箱</text>
					<view class="field-box">
						<text v-if="!email" class="field-ph">用于登录（如 name@example.com）</text>
						<input v-model="email" class="field-core" type="text" />
					</view>
				</view>
				<view class="field">
					<text class="field-label">密码</text>
					<view class="field-box">
						<text v-if="!password" class="field-ph">至少 6 位</text>
						<input v-model="password" class="field-core" type="password" password />
					</view>
				</view>
				<view class="field">
					<text class="field-label">确认密码</text>
					<view class="field-box">
						<text v-if="!confirmPassword" class="field-ph">再输入一次密码</text>
						<input v-model="confirmPassword" class="field-core" type="password" password />
					</view>
				</view>
				<view v-if="errorMsg" class="error-tip reg-error">{{ errorMsg }}</view>
				<button class="btn-primary submit-btn" :disabled="loading" hover-class="button-hover" @tap="handleRegister">
					{{ loading ? "注册中..." : "注 册" }}
				</button>
			</template>
		</view>

		<view class="to-login">
			<text class="to-login-tip">已有账号？</text>
			<text class="to-login-link" @tap="goLogin">直接登录</text>
		</view>

		<view class="reg-footer">
			<text class="footer-copy">© 2026 智能错题本</text>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { registerAccount, getRegisterStatus } from "@/api";
import { login } from "@/utils/auth";

const name = ref("");
const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const loading = ref(false);
const errorMsg = ref("");
const disabled = ref(false);

onLoad(async () => {
	// 注册开关由后端配置控制，与网页端注册页一致
	try {
		const res = await getRegisterStatus();
		if (res && res.allowRegistration === false) disabled.value = true;
	} catch {
		// 状态获取失败不阻塞，提交时后端仍会兜底校验
	}
});

function validate(): string {
	if (!name.value.trim()) return "请输入昵称";
	if (!/^[^\s@]+@[^\s@]+$/.test(email.value.trim())) return "邮箱格式不正确";
	if (password.value.length < 6) return "密码至少 6 位";
	if (password.value !== confirmPassword.value) return "两次输入的密码不一致";
	return "";
}

async function handleRegister() {
	const err = validate();
	if (err) {
		errorMsg.value = err;
		return;
	}
	loading.value = true;
	errorMsg.value = "";
	try {
		await registerAccount({
			email: email.value.trim(),
			password: password.value,
			name: name.value.trim(),
		});
	} catch (e: any) {
		const msg = e?.message || "";
		if (msg.includes("exists") || msg.includes("already") || msg.includes("409")) {
			errorMsg.value = "该邮箱已注册，请直接登录";
		} else if (msg.includes("disabled") || msg.includes("403")) {
			errorMsg.value = "当前系统已关闭注册，请联系管理员";
		} else {
			errorMsg.value = msg || "注册失败，请稍后重试";
		}
		loading.value = false;
		return;
	}
	// 注册已成功。自动登录失败（如网络抖动）不掩盖成功事实，回登录页让用户手动登录
	try {
		await login(email.value.trim(), password.value);
		uni.showToast({ title: "欢迎加入", icon: "success" });
		uni.reLaunch({ url: "/pages/index/index" });
	} catch {
		uni.showToast({ title: "注册成功，请登录", icon: "none" });
		uni.redirectTo({ url: "/pages/login/login" });
	} finally {
		loading.value = false;
	}
}

function goLogin() {
	uni.redirectTo({ url: "/pages/login/login" });
}
</script>

<style scoped>
.reg-page {
	min-height: 100vh;
	background: linear-gradient(172deg, #17224b 0%, #101a3c 52%, #0b1229 100%);
	padding: 0 48rpx;
	display: flex;
	flex-direction: column;
	position: relative;
	overflow: hidden;
}

/* ---------- 装饰（与登录页同款） ---------- */
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

.brand {
	padding-top: calc(var(--status-bar-height) + 90rpx);
	display: flex;
	flex-direction: column;
	align-items: center;
	position: relative;
	z-index: 1;
}
.brand-mark {
	width: 112rpx;
	height: 112rpx;
	background: linear-gradient(140deg, #5568e8 0%, #3d52d5 70%);
	border-radius: 34rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
	box-shadow: 0 20rpx 48rpx rgba(61, 82, 213, 0.45), inset 0 2rpx 6rpx rgba(255, 255, 255, 0.28);
}
.brand-mark-char {
	color: #ffffff;
	font-size: 54rpx;
	font-weight: 700;
}
.brand-mark-dot {
	position: absolute;
	right: 18rpx;
	bottom: 18rpx;
	width: 13rpx;
	height: 13rpx;
	border-radius: 50%;
	background: #c9973f;
	box-shadow: 0 0 12rpx rgba(201, 151, 63, 0.9);
}
.brand-name {
	color: #ffffff;
	font-size: 40rpx;
	font-weight: 700;
	margin-top: 28rpx;
	letter-spacing: 6rpx;
}
.brand-slogan {
	color: rgba(255, 255, 255, 0.6);
	font-size: 24rpx;
	margin-top: 12rpx;
	letter-spacing: 2rpx;
}

.form-card {
	background: #ffffff;
	border-radius: 36rpx;
	padding: 48rpx 44rpx 44rpx;
	margin-top: 56rpx;
	box-shadow: 0 24rpx 64rpx rgba(5, 10, 26, 0.4);
	position: relative;
	z-index: 1;
}
.closed-tip {
	background: var(--warning-50);
	border: 1rpx solid rgba(201, 106, 8, 0.25);
	border-radius: 16rpx;
	padding: 28rpx;
}
.closed-tip-text {
	color: var(--warning-600);
	font-size: 26rpx;
	line-height: 1.6;
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
.field-label {
	font-size: 24rpx;
	color: var(--ink-500);
	font-weight: 500;
	display: block;
	margin-bottom: 14rpx;
	letter-spacing: 1rpx;
}
.reg-error {
	margin: 0 0 24rpx;
}
.submit-btn {
	margin-top: 8rpx;
}

.to-login {
	display: flex;
	align-items: center;
	justify-content: center;
	margin-top: 36rpx;
	position: relative;
	z-index: 1;
}
.to-login-tip {
	color: rgba(255, 255, 255, 0.55);
	font-size: 26rpx;
}
.to-login-link {
	color: #8ea0ff;
	font-size: 26rpx;
	font-weight: 600;
	margin-left: 10rpx;
}

.reg-footer {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-end;
	padding-bottom: calc(env(safe-area-inset-bottom) + 36rpx);
	position: relative;
	z-index: 1;
}
.footer-copy {
	color: rgba(255, 255, 255, 0.26);
	font-size: 20rpx;
	letter-spacing: 1rpx;
}
</style>
