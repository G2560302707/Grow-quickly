<script setup lang="ts">
import { onLaunch } from "@dcloudio/uni-app";
import { resolveGuest } from "./utils/guest";
import { enableShareMenu } from "./utils/share";

onLaunch(async () => {
  // 分享能力：启动时先打开菜单项；「发送给朋友 / 分享到朋友圈」的具体内容
  // 必须由各页面的 onShareAppMessage / onShareTimeline 提供（写在 App.vue 无效）
  enableShareMenu();
  // 合规整改：未登录不再强制跳登录页，允许先浏览（读接口返回演示数据），
  // 仅预热会话判定，写操作时再按需引导登录
  await resolveGuest();
});
</script>

<style>
/* ============================================================
   智能错题本 · 「墨蓝靛金」设计系统
   深墨蓝（权威/专注）+ 靛蓝（交互）+ 点缀金（高级感）
   令牌通过 CSS 自定义属性下发，H5 与小程序双端通用
   ============================================================ */
page {
  /* 品牌色 */
  --brand-900: #101a3c;
  --brand-800: #17224b;
  --brand-700: #233172;
  --brand-600: #3d52d5;
  --brand-500: #5568e8;
  --brand-100: #e3e7fb;
  --brand-50: #f0f3fd;

  /* 点缀金（克制使用） */
  --gold-600: #b8862f;
  --gold-500: #c9973f;
  --gold-100: #f4ead3;
  --gold-50: #faf5ea;

  /* 语义色 */
  --success-600: #12855b;
  --success-50: #e8f7f0;
  --warning-600: #c96a08;
  --warning-50: #fdf3e7;
  --danger-600: #d93a45;
  --danger-50: #fcebed;

  /* 中性色 */
  --ink-900: #151c30;
  --ink-600: #4a5568;
  --ink-500: #6b7590;
  --ink-400: #9aa3b8;
  --ink-300: #c3c9d8;
  --line-100: #eaecf4;
  --line-50: #f1f3f9;
  --bg-page: #f4f5fa;
  --bg-card: #ffffff;
  --bg-fill: #f3f4f9;

  /* 阴影 */
  --shadow-card: 0 1rpx 2rpx rgba(16, 26, 60, 0.04), 0 10rpx 28rpx rgba(16, 26, 60, 0.05);
  --shadow-float: 0 16rpx 40rpx rgba(10, 16, 34, 0.14);
  --shadow-primary: 0 8rpx 22rpx rgba(61, 82, 213, 0.26);

  /* 深色页头光晕（随主题换色） */
  --glow-primary: rgba(85, 104, 232, 0.25);
  /* 首页自定义导航毛玻璃底色（随主题 hero 顶色调配） */
  --nav-glass: rgba(23, 34, 75, 0.42);

  background-color: var(--bg-page);
  color: var(--ink-900);
  font-size: 28rpx;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* ---------- 数字排版 ---------- */
.num {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}

/* ---------- 页面容器 ---------- */
.page {
  min-height: 100vh;
  background-color: var(--bg-page);
}

/* ============================================================
   外观主题（变量覆盖组）：默认=书房墨蓝（即上方 page 令牌原值）。
   页面根 view 挂 .page.t-xxx 后整页换肤；子元素通过 var() 继承。
   ============================================================ */

/* 冷灰精密：近白画布 · 钢青为主 · 仪器琥珀点睛 */
.page.t-cool-steel {
  --brand-900: #16181d;
  --brand-800: #1d2025;
  --brand-700: #1e4e60;
  --brand-600: #1f6e8c;
  --brand-500: #2f7f9e;
  --brand-100: #d9e8ee;
  --brand-50: #ecf3f6;
  --gold-600: #c07f2d;
  --gold-500: #cd9146;
  --gold-100: #f3e5d3;
  --gold-50: #f8f1e6;
  --ink-900: #1a1d21;
  --ink-600: #4a5058;
  --ink-500: #6b727c;
  --ink-400: #9aa1ab;
  --ink-300: #c6ccd2;
  --line-100: #e2e7e9;
  --line-50: #eff2f3;
  --bg-page: #f4f6f7;
  --bg-fill: #edf0f2;
  --shadow-primary: 0 10rpx 26rpx rgba(31, 110, 140, 0.18);
  --glow-primary: rgba(47, 127, 158, 0.22);
  --nav-glass: rgba(29, 32, 37, 0.42);
}

/* ---------- 卡片 ---------- */
.card {
  background: var(--bg-card);
  border-radius: 24rpx;
  padding: 32rpx;
  margin: 24rpx;
  border: 1rpx solid rgba(16, 26, 60, 0.05);
  box-shadow: var(--shadow-card);
  box-sizing: border-box;
}
.card-hover {
  transform: scale(0.985);
  box-shadow: 0 2rpx 8rpx rgba(16, 26, 60, 0.04);
}

/* ---------- 区块标题 ---------- */
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}
.section-title {
  font-size: 30rpx;
  color: var(--ink-900);
  font-weight: 600;
  letter-spacing: 1rpx;
  display: flex;
  align-items: center;
}
.section-title::before {
  content: "";
  width: 8rpx;
  height: 26rpx;
  border-radius: 4rpx;
  background: linear-gradient(180deg, var(--brand-500), var(--brand-600));
  margin-right: 14rpx;
}
.section-extra {
  font-size: 24rpx;
  color: var(--ink-400);
}

/* ---------- 按钮 ---------- */
.btn-primary {
  background: linear-gradient(135deg, var(--brand-500) 0%, var(--brand-600) 100%);
  color: #ffffff;
  border-radius: 18rpx;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 30rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
  border: none;
  box-shadow: var(--shadow-primary);
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.btn-primary::after {
  border: none;
}
.btn-primary[disabled] {
  opacity: 0.45;
  box-shadow: none;
  color: #ffffff;
}
.btn-outline {
  background: var(--bg-card);
  color: var(--ink-600);
  border: 2rpx solid var(--line-100);
  border-radius: 18rpx;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 30rpx;
  font-weight: 500;
}
.btn-outline::after {
  border: none;
}
.btn-outline[disabled] {
  opacity: 0.45;
}
.button-hover {
  opacity: 0.86;
  transform: translateY(2rpx);
}

/* ---------- 筛选胶囊 ---------- */
.chip {
  background: var(--bg-card);
  color: var(--ink-500);
  font-size: 24rpx;
  font-weight: 500;
  padding: 12rpx 30rpx;
  border-radius: 999rpx;
  border: 1rpx solid var(--line-100);
  transition: all 0.15s ease;
}
.chip-active {
  background: var(--brand-600);
  border-color: var(--brand-600);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 6rpx 16rpx rgba(61, 82, 213, 0.24);
}

/* ---------- 知识点标签 ---------- */
.tag {
  background: var(--brand-50);
  color: var(--brand-600);
  font-size: 22rpx;
  padding: 6rpx 20rpx;
  border-radius: 999rpx;
  line-height: 1.6;
}

/* ---------- 掌握度徽标 ---------- */
.badge {
  font-size: 22rpx;
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  line-height: 1.6;
}
.badge::before {
  content: "";
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  margin-right: 10rpx;
}
.badge-new {
  background: var(--danger-50);
  color: var(--danger-600);
}
.badge-new::before {
  background: var(--danger-600);
}
.badge-doing {
  background: var(--warning-50);
  color: var(--warning-600);
}
.badge-doing::before {
  background: var(--warning-600);
}
.badge-done {
  background: var(--success-50);
  color: var(--success-600);
}
.badge-done::before {
  background: var(--success-600);
}

/* ---------- 空态 / 错误 ---------- */
.empty-tip {
  text-align: center;
  color: var(--ink-400);
  padding: 140rpx 60rpx;
  font-size: 28rpx;
  line-height: 1.8;
}
.empty-main {
  display: block;
  font-size: 32rpx;
  color: var(--ink-600);
  font-weight: 600;
}
.empty-sub {
  display: block;
  font-size: 24rpx;
  color: var(--ink-300);
  margin-top: 12rpx;
}
.error-tip {
  text-align: center;
  color: var(--danger-600);
  background: var(--danger-50);
  border-radius: 16rpx;
  padding: 24rpx 32rpx;
  font-size: 26rpx;
  line-height: 1.6;
  margin: 24rpx;
}

/* ---------- 输入 ---------- */
.field-input {
  background: var(--bg-fill);
  border-radius: 16rpx;
  padding: 24rpx 28rpx;
  font-size: 28rpx;
  width: 100%;
  box-sizing: border-box;
  color: var(--ink-900);
}
.ph {
  color: var(--ink-300);
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

/* ---------- 骨架屏 ---------- */
.skel {
  position: relative;
  overflow: hidden;
  background: #edeef5;
}
.skel::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.65), transparent);
  animation: skel-shimmer 1.4s ease infinite;
}
@keyframes skel-shimmer {
  100% {
    transform: translateX(100%);
  }
}

/* ---------- 入场动效 ---------- */
.fade-up {
  animation: fade-up 0.4s ease both;
}
@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(24rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
