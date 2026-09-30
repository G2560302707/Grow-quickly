<template>
	<view class="md-view">
		<block v-for="(block, i) in blocks" :key="i">
			<text v-if="block.type === 'h'" class="md-h">{{ block.text }}</text>
			<text v-else-if="block.type === 'li'" class="md-li">{{ block.text }}</text>
			<text v-else class="md-p">{{ block.text }}</text>
		</block>
	</view>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ content: string }>();

/** 轻量分段：# 标题 / - 列表 / 普通段落，让 AI 解析在手机上更易读 */
const blocks = computed(() => {
	const lines = (props.content || "").split(/\r?\n/);
	const out: { type: "h" | "li" | "p"; text: string }[] = [];
	for (const raw of lines) {
		const line = raw.trim();
		if (!line) continue;
		if (/^#{1,6}\s/.test(line)) {
			out.push({ type: "h", text: line.replace(/^#{1,6}\s*/, "").replace(/^\d+[.、]\s*/, "") });
		} else if (/^[-*•]\s+/.test(line)) {
			out.push({ type: "li", text: line.replace(/^[-*•]\s+/, "") });
		} else {
			out.push({ type: "p", text: line });
		}
	}
	return out;
});
</script>

<style scoped>
.md-view {
	display: flex;
	flex-direction: column;
}
.md-h {
	font-size: 28rpx;
	font-weight: 700;
	color: #1f2937;
	margin: 20rpx 0 8rpx;
}
.md-h:first-child {
	margin-top: 0;
}
.md-p {
	font-size: 27rpx;
	color: #4b5563;
	line-height: 1.7;
	margin-bottom: 8rpx;
}
.md-li {
	font-size: 27rpx;
	color: #4b5563;
	line-height: 1.7;
	margin-bottom: 6rpx;
	padding-left: 24rpx;
	position: relative;
}
.md-li::before {
	content: "·";
	position: absolute;
	left: 4rpx;
	color: #f97316;
	font-weight: 700;
}
</style>
