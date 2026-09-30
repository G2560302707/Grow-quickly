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
  background-color: #f5f5f5;
  font-size: 28rpx;
  color: #1f2937;
}
.card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin: 20rpx 24rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.05);
}
.section-title {
  font-size: 26rpx;
  color: #6b7280;
  margin-bottom: 12rpx;
}
.btn-primary {
  background: #f97316;
  color: #ffffff;
  border-radius: 12rpx;
  font-size: 30rpx;
}
.btn-primary[disabled] {
  opacity: 0.6;
}
.btn-outline {
  background: #ffffff;
  color: #374151;
  border: 1rpx solid #d1d5db;
  border-radius: 12rpx;
  font-size: 30rpx;
}
.empty-tip {
  text-align: center;
  color: #9ca3af;
  padding: 120rpx 0;
  font-size: 26rpx;
}
.error-tip {
  text-align: center;
  color: #ef4444;
  padding: 24rpx 0;
  font-size: 26rpx;
}
</style>
