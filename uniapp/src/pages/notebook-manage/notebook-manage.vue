<script setup lang="ts">
import { ref, computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { listNotebooks, deleteNotebook, type Notebook } from "../../api";
import { notebookIconSrc } from "../../utils/notebook-icons";
import { useThemeClass } from "../../utils/theme";

const themeCls = useThemeClass();
const notebooks = ref<Notebook[]>([]);
const loading = ref(true);

const totalCount = computed(() => notebooks.value.length);

async function load() {
  loading.value = true;
  try {
    const list = await listNotebooks();
    notebooks.value = Array.isArray(list) ? list : [];
  } catch {
    uni.showToast({ title: "加载失败，请重试", icon: "none" });
  } finally {
    loading.value = false;
  }
}

onShow(load);

function openCreate() {
  uni.navigateTo({ url: "/pages/notebook-edit/notebook-edit" });
}

function goItems(nb: Notebook) {
  uni.navigateTo({
    url: `/pages/items/items?subjectId=${nb.id}&name=${encodeURIComponent(nb.name)}`,
  });
}

/** 「···」弹出操作面板：打开 / 编辑 / 删除 / 取消 */
function nbActions(nb: Notebook) {
  uni.showActionSheet({
    itemList: ["打开", "编辑", "删除", "取消"],
    success: (r) => {
      if (r.tapIndex === 0) {
        goItems(nb);
      } else if (r.tapIndex === 1) {
        uni.navigateTo({
          url: `/pages/notebook-edit/notebook-edit?id=${nb.id}&name=${encodeURIComponent(nb.name)}&iconKey=${nb.iconKey ?? "other"}`,
        });
      } else if (r.tapIndex === 2) {
        confirmDelete(nb);
      }
    },
  });
}

function confirmDelete(nb: Notebook) {
  if (nb.isDefault) {
    uni.showToast({ title: "默认错题本不可删除", icon: "none" });
    return;
  }
  const count = nb._count?.errorItems ?? 0;
  uni.showModal({
    title: "删除错题本",
    content: count > 0
      ? `「${nb.name}」里的 ${count} 道错题将迁入默认本，确定删除？`
      : `确定删除「${nb.name}」？`,
    confirmColor: "#d93a45",
    success: (r) => r.confirm && doDelete(nb),
  });
}

async function doDelete(nb: Notebook) {
  try {
    await deleteNotebook(nb.id);
    uni.showToast({ title: "已删除", icon: "success" });
    load();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "删除失败";
    uni.showToast({ title: msg, icon: "none" });
  }
}
</script>

<template>
  <view class="page nbm-page" :class="themeCls">
    <!-- 头卡 -->
    <view class="card nbm-head">
      <view class="nbm-head-info">
        <text class="nbm-title">错题本管理</text>
        <text class="nbm-sub">共 {{ totalCount }} 本 · 点开查看 · ··· 编辑 · 默认本不可删</text>
      </view>
      <button class="nbm-new-btn" hover-class="button-hover" @tap="openCreate">＋ 新建</button>
    </view>

    <!-- 本列表 -->
    <view v-if="loading" class="card">
      <view class="skel nbm-skel" />
    </view>
    <view v-else class="card nbm-list">
      <view
        v-for="(nb, idx) in notebooks"
        :key="nb.id"
        class="nbm-row"
        :class="{ divided: idx > 0 }"
      >
        <view class="nbm-row-main" hover-class="nbm-row-hover" @tap="goItems(nb)">
          <view class="nbm-icon">
            <image class="nbm-icon-img" :src="notebookIconSrc(nb.iconKey)" mode="aspectFit" />
          </view>
          <view class="nbm-row-info">
            <view class="nbm-name-row">
              <text class="nbm-name">{{ nb.name }}</text>
              <text v-if="nb.isDefault" class="nbm-default-tag">默认</text>
            </view>
            <text class="nbm-count">{{ nb._count?.errorItems ?? 0 }} 道错题<template v-if="nb.isDefault"> · 删其它本时题目会迁入此处</template></text>
          </view>
        </view>
        <view class="nbm-more" hover-class="nbm-more-hover" @tap.stop="nbActions(nb)">···</view>
      </view>
    </view>

    <text class="nbm-tip">提示：在错题详情可点错题本名称，将题目移到其它本。</text>
  </view>
</template>

<style scoped>
.nbm-page {
  padding: 24rpx 0 60rpx;
}
.nbm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
}
.nbm-head-info {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-width: 0;
}
.nbm-title {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--ink-900);
}
.nbm-sub {
  font-size: 23rpx;
  color: var(--ink-400);
  line-height: 1.5;
}
.nbm-new-btn {
  flex-shrink: 0;
  background: linear-gradient(135deg, var(--brand-500), var(--brand-600));
  color: #fff;
  font-size: 26rpx;
  font-weight: 600;
  border-radius: 999rpx;
  padding: 0 34rpx;
  height: 68rpx;
  line-height: 68rpx;
  border: none;
  box-shadow: var(--shadow-primary);
}
.nbm-new-btn::after {
  border: none;
}
.nbm-skel {
  height: 120rpx;
  border-radius: 16rpx;
}
.nbm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26rpx 0;
}
.nbm-row.divided {
  border-top: 1rpx solid var(--line-50);
}
.nbm-row-hover {
  opacity: 0.8;
}
.nbm-row-main {
  display: flex;
  align-items: center;
  gap: 24rpx;
  flex: 1;
  min-width: 0;
}
.nbm-icon {
  width: 76rpx;
  height: 76rpx;
  border-radius: 20rpx;
  background: var(--brand-50);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.nbm-icon-img {
  width: 48rpx;
  height: 48rpx;
}
.nbm-row-info {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}
.nbm-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.nbm-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--ink-900);
}
.nbm-default-tag {
  font-size: 20rpx;
  color: var(--brand-600);
  background: var(--brand-50);
  border-radius: 8rpx;
  padding: 2rpx 12rpx;
  line-height: 1.5;
}
.nbm-count {
  font-size: 23rpx;
  color: var(--ink-400);
}
.nbm-more {
  padding: 12rpx 16rpx;
  color: var(--ink-400);
  font-size: 30rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}
.nbm-more-hover {
  opacity: 0.6;
}
.nbm-tip {
  display: block;
  margin: 8rpx 48rpx;
  font-size: 23rpx;
  color: var(--ink-400);
  line-height: 1.6;
}
</style>
