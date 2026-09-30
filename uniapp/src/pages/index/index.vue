<template>
	<view class="page">
		<view v-if="loading" class="empty-tip">加载中...</view>
		<view v-else-if="errorMsg" class="error-tip">{{ errorMsg }}</view>
		<view v-else-if="notebooks.length === 0" class="empty-tip">还没有错题本，去"识别"页添加第一道错题吧</view>
		<view v-else>
			<view
				v-for="nb in notebooks"
				:key="nb.id"
				class="card notebook-card"
				@tap="openNotebook(nb)"
			>
				<view class="notebook-icon">📖</view>
				<view class="notebook-info">
					<text class="notebook-name">{{ nb.name }}</text>
					<text class="notebook-count">{{ nb._count?.errorItems ?? 0 }} 道题目</text>
				</view>
				<text class="notebook-arrow">›</text>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { listNotebooks, type Notebook } from "@/api";

const notebooks = ref<Notebook[]>([]);
const loading = ref(true);
const errorMsg = ref("");

onShow(async () => {
	loading.value = true;
	errorMsg.value = "";
	try {
		notebooks.value = await listNotebooks();
	} catch (e: any) {
		errorMsg.value = e?.message || "加载失败";
	} finally {
		loading.value = false;
	}
});

function openNotebook(nb: Notebook) {
	uni.navigateTo({
		url: `/pages/items/items?subjectId=${nb.id}&name=${encodeURIComponent(nb.name)}`,
	});
}
</script>

<style scoped>
.notebook-card {
	display: flex;
	align-items: center;
}
.notebook-icon {
	font-size: 40rpx;
	margin-right: 24rpx;
}
.notebook-info {
	flex: 1;
	display: flex;
	flex-direction: column;
}
.notebook-name {
	font-size: 32rpx;
	font-weight: 600;
}
.notebook-count {
	font-size: 24rpx;
	color: #9ca3af;
	margin-top: 6rpx;
}
.notebook-arrow {
	font-size: 40rpx;
	color: #d1d5db;
}
</style>
