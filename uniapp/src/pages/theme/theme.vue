<script setup lang="ts">
import { ref } from "vue";
import { THEMES, getThemeKey, setTheme, themeClassOf, type ThemeMeta } from "../../utils/theme";

const current = ref(getThemeKey());

function pick(t: ThemeMeta) {
  if (t.key === current.value) return;
  setTheme(t.key);
  current.value = t.key;
}
</script>

<template>
  <view class="page theme-page" :class="themeClassOf()">
    <view
      v-for="t in THEMES"
      :key="t.key"
      class="card theme-card"
      :class="{ active: current === t.key }"
      hover-class="card-hover"
      @tap="pick(t)"
    >
      <view class="theme-dots">
        <view
          v-for="(d, i) in t.dots"
          :key="i"
          class="dot"
          :style="{ background: d }"
        />
      </view>
      <view class="theme-info">
        <text class="theme-name">{{ t.name }}</text>
        <text class="theme-desc">{{ t.desc }}</text>
      </view>
      <view v-if="current === t.key" class="theme-check" />
    </view>
  </view>
</template>

<style scoped>
.theme-page {
  padding: 24rpx 0 60rpx;
}
.theme-card {
  display: flex;
  align-items: center;
  gap: 28rpx;
  padding: 36rpx 32rpx;
  transition: border-color 0.15s ease;
}
.theme-card.active {
  border: 2rpx solid var(--brand-600);
  background: var(--brand-50);
}
.theme-dots {
  display: flex;
  gap: 10rpx;
  flex-shrink: 0;
}
.dot {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1rpx rgba(0, 0, 0, 0.06);
}
.theme-info {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  flex: 1;
}
.theme-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--ink-900);
}
.theme-desc {
  font-size: 24rpx;
  color: var(--ink-400);
}
.theme-check {
  width: 26rpx;
  height: 14rpx;
  border-left: 5rpx solid var(--brand-600);
  border-bottom: 5rpx solid var(--brand-600);
  transform: rotate(-45deg);
  margin-right: 8rpx;
  flex-shrink: 0;
}
</style>
