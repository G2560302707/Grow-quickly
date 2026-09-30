<script setup lang="ts">
import { onLaunch } from "@dcloudio/uni-app";
import { getSession } from "./utils/auth";

onLaunch(async () => {
  // 启动即校验会话，未登录统一跳登录页
  const session = await getSession();
  if (!session?.user) {
    uni.reLaunch({ url: "/pages/login/login" });
  }
});
</script>

<style>
page {
  background-color: #f5f6fa;
  font-size: 28rpx;
  color: #1f2937;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
}

/* ---------- 通用卡片 ---------- */
.card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 32rpx;
  margin: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(31, 41, 55, 0.05);
}
.card-hover {
  opacity: 0.88;
  transform: scale(0.995);
}

/* ---------- 标题 ---------- */
.section-title {
  font-size: 24rpx;
  color: #9ca3af;
  font-weight: 500;
  letter-spacing: 2rpx;
  margin-bottom: 16rpx;
  display: flex;
  align-items: center;
}
.section-title::before {
  content: "";
  width: 6rpx;
  height: 22rpx;
  border-radius: 3rpx;
  background: #f97316;
  margin-right: 12rpx;
}

/* ---------- 按钮 ---------- */
.btn-primary {
  background: linear-gradient(135deg, #fb923c 0%, #f97316 100%);
  color: #ffffff;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
  box-shadow: 0 6rpx 16rpx rgba(249, 115, 22, 0.3);
}
.btn-primary[disabled] {
  opacity: 0.5;
  box-shadow: none;
}
.btn-outline {
  background: #ffffff;
  color: #374151;
  border: 2rpx solid #e5e7eb;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 500;
}
.btn-outline[disabled] {
  opacity: 0.5;
}
.button-hover {
  opacity: 0.85;
}

/* ---------- 标签 ---------- */
.tag {
  background: #fff7ed;
  color: #ea580c;
  font-size: 22rpx;
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  line-height: 1.5;
}

/* ---------- 状态色块 ---------- */
.badge {
  font-size: 22rpx;
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  font-weight: 500;
}
.badge-new {
  background: #fef2f2;
  color: #ef4444;
}
.badge-doing {
  background: #fffbeb;
  color: #d97706;
}
.badge-done {
  background: #f0fdf4;
  color: #16a34a;
}

/* ---------- 反馈 ---------- */
.empty-tip {
  text-align: center;
  color: #9ca3af;
  padding: 140rpx 60rpx;
  font-size: 28rpx;
  line-height: 1.8;
}
.error-tip {
  text-align: center;
  color: #ef4444;
  padding: 24rpx 32rpx;
  font-size: 26rpx;
  line-height: 1.6;
}

/* ---------- 输入 ---------- */
.field-input {
  background: #f5f6fa;
  border-radius: 14rpx;
  padding: 22rpx 26rpx;
  font-size: 28rpx;
  width: 100%;
  box-sizing: border-box;
}
/* uni-app H5 中 uni-input/uni-textarea 的内部原生元素默认高度塌陷，需手动撑开 */
uni-input {
  display: flex;
}
uni-input .uni-input-input {
  flex: 1;
  width: 100%;
  height: 44rpx;
  line-height: 44rpx;
  font-size: inherit;
}
uni-textarea {
  display: flex;
}
uni-textarea .uni-textarea-textarea {
  flex: 1;
  width: 100%;
  height: 100%;
  font-size: inherit;
}
</style>
