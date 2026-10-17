<script setup lang="ts">
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { createNotebook, updateNotebook } from "../../api";
import { NOTEBOOK_ICON_GROUPS, notebookIconSrc } from "../../utils/notebook-icons";
import { useThemeClass } from "../../utils/theme";

const themeCls = useThemeClass();

// 编辑模式参数
const editId = ref("");
const isEdit = computed(() => !!editId.value);

const name = ref("");
const iconKey = ref("other");
const submitting = ref(false);

const canSubmit = computed(() => name.value.trim().length > 0 && !submitting.value);
const pageTitle = computed(() => (isEdit.value ? "编辑错题本" : "新建错题本"));

onLoad((query) => {
  const q = (query ?? {}) as Record<string, string>;
  if (q.id) editId.value = q.id;
  if (q.name) name.value = decodeURIComponent(q.name);
  if (q.iconKey) iconKey.value = q.iconKey;
  uni.setNavigationBarTitle({ title: pageTitle.value });
});

function pickIcon(key: string) {
  iconKey.value = key;
  uni.vibrateShort?.();
}

async function submit() {
  const trimmed = name.value.trim();
  if (!trimmed || submitting.value) return;
  submitting.value = true;
  try {
    if (isEdit.value) {
      await updateNotebook(editId.value, trimmed, iconKey.value);
      uni.showToast({ title: "已保存", icon: "success" });
    } else {
      await createNotebook(trimmed, iconKey.value);
      uni.showToast({ title: "创建成功", icon: "success" });
    }
    setTimeout(() => uni.navigateBack(), 600);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "保存失败，请重试";
    uni.showToast({ title: msg, icon: "none" });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <view class="page nbe-page" :class="themeCls">
    <!-- 名称 + 图标预览 -->
    <view class="card nbe-name-card">
      <view class="nbe-icon-preview">
        <image class="nbe-icon-img" :src="notebookIconSrc(iconKey)" mode="aspectFit" />
      </view>
      <input
        v-model="name"
        class="nbe-name-input field-input"
        type="text"
        maxlength="20"
        placeholder="错题本名称"
        placeholder-class="ph"
      />
    </view>

    <!-- 图标分区 -->
    <view v-for="g in NOTEBOOK_ICON_GROUPS" :key="g.title" class="card nbe-group">
      <text class="nbe-group-title">{{ g.title }}</text>
      <view class="nbe-grid">
        <view
          v-for="ic in g.icons"
          :key="ic.key"
          class="nbe-cell"
          :class="{ selected: iconKey === ic.key }"
          @tap="pickIcon(ic.key)"
        >
          <view class="nbe-cell-icon">
            <image class="nbe-cell-img" :src="notebookIconSrc(ic.key)" mode="aspectFit" />
          </view>
          <text class="nbe-cell-label">{{ ic.label }}</text>
        </view>
      </view>
    </view>

    <button
      class="btn-primary nbe-submit"
      :disabled="!canSubmit"
      hover-class="button-hover"
      @tap="submit"
    >
      {{ isEdit ? "保存" : "创建" }}
    </button>
  </view>
</template>

<style scoped>
.nbe-page {
  padding: 24rpx 0 60rpx;
}
.nbe-name-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
}
.nbe-icon-preview {
  width: 88rpx;
  height: 88rpx;
  border-radius: 22rpx;
  background: var(--brand-50);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.nbe-icon-img {
  width: 56rpx;
  height: 56rpx;
}
.nbe-name-input {
  flex: 1;
}
.nbe-group-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--ink-600);
  margin-bottom: 24rpx;
}
.nbe-grid {
  display: flex;
  flex-wrap: wrap;
}
.nbe-cell {
  width: 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  padding: 16rpx 0;
  box-sizing: border-box;
}
.nbe-cell-icon {
  width: 92rpx;
  height: 92rpx;
  border-radius: 24rpx;
  background: var(--bg-fill);
  border: 3rpx solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.nbe-cell.selected .nbe-cell-icon {
  border-color: var(--brand-600);
  background: var(--brand-50);
}
.nbe-cell-img {
  width: 52rpx;
  height: 52rpx;
}
.nbe-cell-label {
  font-size: 24rpx;
  color: var(--ink-600);
}
.nbe-cell.selected .nbe-cell-label {
  color: var(--brand-600);
  font-weight: 600;
}
.nbe-submit {
  margin: 32rpx 24rpx 0;
}
</style>
