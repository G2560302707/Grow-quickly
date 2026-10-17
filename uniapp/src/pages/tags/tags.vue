<template>
	<scroll-view scroll-y class="page-scroll" :show-scrollbar="false" enable-back-to-top>
		<view :class="['page', themeCls]">
			<view v-if="loading" class="empty-tip">加载中...</view>
			<template v-else>
				<view v-if="needsImport" class="card import-card fade-up">
					<view class="import-badge">考点树</view>
					<text class="import-title">尚未导入官方考点</text>
					<text class="import-desc">导入行测考点模板后，识别打标与薄弱点诊断才会生效。每人一份，可自行增删改。</text>
					<button class="btn-primary" :disabled="importing" hover-class="button-hover" @tap="doImport('merge')">
						{{ importing ? "导入中..." : "一键导入官方模板" }}
					</button>
				</view>

				<template v-else>
					<view class="hero card fade-up">
						<view class="hero-left">
							<text class="hero-title">我的考点树</text>
							<text class="hero-sub">共 {{ flatRows.length }} 个节点 · 点开展开 · 长按或 ⋯ 编辑</text>
						</view>
						<button class="hero-add" hover-class="button-hover" @tap="promptAdd(null)">
							<text class="hero-add-plus">+</text>
							<text>模块</text>
						</button>
					</view>

					<view v-if="flatRows.length === 0" class="empty-tip">树为空，请重新导入</view>
					<view v-else class="tree-wrap fade-up">
						<view
							v-for="row in visibleRows"
							:key="row.id"
							class="tree-item"
							:class="'depth-' + Math.min(row.depth, 3)"
							hover-class="tree-item-hv"
							@tap="onRowTap(row)"
							@longpress="onRowMenu(row)"
						>
							<view class="node-indent" :style="{ width: row.depth * 28 + 'rpx' }" />
							<view class="node-rail" v-if="row.depth > 0" />
							<view class="node-body">
								<view class="node-icon" :class="iconClass(row)">
									<text v-if="row.hasKids">{{ expanded[row.id] ? "▾" : "▸" }}</text>
									<text v-else class="leaf-dot" />
								</view>
								<view class="node-text">
									<text class="node-name">{{ row.name }}</text>
									<text class="node-meta">{{ metaLabel(row) }}</text>
								</view>
								<view class="node-more" @tap.stop="onRowMenu(row)">⋯</view>
							</view>
						</view>
					</view>

					<view class="foot-actions">
						<button class="btn-ghost" hover-class="button-hover" @tap="confirmReplace">
							用官方模板重新覆盖
						</button>
					</view>
				</template>
			</template>
		</view>
	</scroll-view>
</template>

<script setup lang="ts">
import { useThemeClass } from "@/utils/theme";

const themeCls = useThemeClass();
import { ref, computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import {
	getUserTagTree,
	importTagTemplate,
	createTag,
	updateTag,
	deleteTag,
	type TagTreeNode,
} from "@/api";

interface FlatRow {
	id: string;
	name: string;
	depth: number;
	parentId: string | null;
	hasKids: boolean;
}

const loading = ref(true);
const importing = ref(false);
const tree = ref<TagTreeNode[]>([]);
const needsImport = ref(false);
const expanded = ref<Record<string, boolean>>({});

function flatten(nodes: TagTreeNode[], depth = 0, parentId: string | null = null): FlatRow[] {
	const out: FlatRow[] = [];
	for (const n of nodes) {
		const kids = n.children || [];
		out.push({
			id: n.id,
			name: n.name,
			depth,
			parentId,
			hasKids: kids.length > 0,
		});
		if (kids.length) out.push(...flatten(kids, depth + 1, n.id));
	}
	return out;
}

const flatRows = computed(() => flatten(tree.value));

const visibleRows = computed(() => {
	const parentOf = new Map(flatRows.value.map((r) => [r.id, r.parentId]));
	const isVisible = (id: string): boolean => {
		let p = parentOf.get(id) || null;
		while (p) {
			if (!expanded.value[p]) return false;
			p = parentOf.get(p) || null;
		}
		return true;
	};
	return flatRows.value.filter((r) => isVisible(r.id));
});

function onRowTap(row: FlatRow) {
	toggle(row);
}

function onRowMenu(row: FlatRow) {
	uni.showActionSheet({
		itemList: ["添加子考点", "改名", "删除"],
		itemColor: "#101a3c",
		success: (res) => {
			if (res.tapIndex === 0) promptAdd(row.id);
			else if (res.tapIndex === 1) promptRename(row);
			else if (res.tapIndex === 2) confirmDelete(row);
		},
	});
}

function iconClass(row: FlatRow) {
	if (row.depth === 0) return "icon-root";
	if (row.hasKids) return "icon-branch";
	return "icon-leaf";
}

function metaLabel(row: FlatRow) {
	if (row.depth === 0) return row.hasKids ? "模块" : "模块 · 叶子";
	if (row.hasKids) return "考点分组";
	return "可打标";
}

async function loadTree() {
	loading.value = true;
	try {
		const data = await getUserTagTree();
		tree.value = data.tags || [];
		needsImport.value = !!data.needsImport || tree.value.length === 0;
		const next: Record<string, boolean> = { ...expanded.value };
		for (const root of tree.value) next[root.id] = true;
		expanded.value = next;
	} catch (e: any) {
		uni.showToast({ title: e?.message || "加载失败", icon: "none" });
	} finally {
		loading.value = false;
	}
}

onShow(() => {
	loadTree();
});

function toggle(row: FlatRow) {
	if (!row.hasKids) return;
	expanded.value = { ...expanded.value, [row.id]: !expanded.value[row.id] };
}

async function doImport(mode: "merge" | "replace" = "merge") {
	importing.value = true;
	try {
		const res = await importTagTemplate(mode);
		tree.value = res.tags || [];
		needsImport.value = tree.value.length === 0;
		uni.showToast({ title: res.message || "导入成功", icon: "success" });
		const next: Record<string, boolean> = {};
		for (const root of tree.value) next[root.id] = true;
		expanded.value = next;
	} catch (e: any) {
		uni.showToast({ title: e?.message || "导入失败", icon: "none" });
	} finally {
		importing.value = false;
	}
}

function confirmReplace() {
	uni.showModal({
		title: "覆盖个人树",
		content: "将删除你当前的个人考点树，再导入官方模板。已挂到旧节点上的错题会解绑，确定吗？",
		confirmColor: "#d93a45",
		success: (r) => {
			if (r.confirm) doImport("replace");
		},
	});
}

function promptAdd(parentId: string | null) {
	uni.showModal({
		title: parentId ? "添加子考点" : "添加模块",
		editable: true,
		placeholderText: "输入名称（最多 40 字）",
		success: async (r) => {
			if (!r.confirm) return;
			const name = (r.content || "").trim();
			if (!name) {
				uni.showToast({ title: "名称不能为空", icon: "none" });
				return;
			}
			try {
				await createTag({ name, parentId });
				await loadTree();
				if (parentId) expanded.value = { ...expanded.value, [parentId]: true };
				uni.showToast({ title: "已添加", icon: "success" });
			} catch (e: any) {
				uni.showToast({ title: e?.message || "添加失败", icon: "none" });
			}
		},
	});
}

function promptRename(row: FlatRow) {
	uni.showModal({
		title: "重命名",
		editable: true,
		placeholderText: row.name,
		content: row.name,
		success: async (r) => {
			if (!r.confirm) return;
			const name = (r.content || "").trim();
			if (!name || name === row.name) return;
			try {
				await updateTag(row.id, { name });
				await loadTree();
				uni.showToast({ title: "已改名", icon: "success" });
			} catch (e: any) {
				uni.showToast({ title: e?.message || "改名失败", icon: "none" });
			}
		},
	});
}

function confirmDelete(row: FlatRow) {
	uni.showModal({
		title: "删除考点",
		content: `确定删除「${row.name}」及其全部子节点？关联错题会解绑标签。`,
		confirmColor: "#d93a45",
		success: async (r) => {
			if (!r.confirm) return;
			try {
				await deleteTag(row.id);
				await loadTree();
				uni.showToast({ title: "已删除", icon: "success" });
			} catch (e: any) {
				uni.showToast({ title: e?.message || "删除失败", icon: "none" });
			}
		},
	});
}
</script>

<style scoped>
.page-scroll {
	height: 100vh;
	box-sizing: border-box;
}
.import-card {
	padding: 40rpx 36rpx;
}
.import-badge {
	display: inline-flex;
	font-size: 20rpx;
	font-weight: 600;
	color: var(--brand-600);
	background: var(--brand-50);
	border: 1rpx solid var(--brand-100);
	padding: 6rpx 16rpx;
	border-radius: 999rpx;
	margin-bottom: 20rpx;
	letter-spacing: 2rpx;
}
.import-title {
	display: block;
	font-size: 36rpx;
	font-weight: 700;
	color: var(--ink-900);
	margin-bottom: 12rpx;
	letter-spacing: 1rpx;
}
.import-desc {
	display: block;
	font-size: 26rpx;
	color: var(--ink-400);
	line-height: 1.65;
	margin-bottom: 32rpx;
}

.hero {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
	padding: 28rpx 32rpx;
	background: linear-gradient(135deg, #ffffff 0%, #f0f3fd 100%);
}
.hero-title {
	display: block;
	font-size: 32rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.hero-sub {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	color: var(--ink-400);
}
.hero-add {
	margin: 0;
	padding: 0 22rpx;
	height: 64rpx;
	line-height: 64rpx;
	border-radius: 999rpx;
	background: var(--brand-600);
	color: #fff;
	font-size: 24rpx;
	font-weight: 600;
	display: flex;
	align-items: center;
	gap: 6rpx;
	box-shadow: var(--shadow-primary);
	border: none;
}
.hero-add::after {
	border: none;
}
.hero-add-plus {
	font-size: 32rpx;
	font-weight: 400;
	line-height: 1;
}

.tree-wrap {
	margin: 0 24rpx 24rpx;
	background: var(--bg-card);
	border-radius: 22rpx;
	border: 1rpx solid rgba(16, 26, 60, 0.05);
	box-shadow: var(--shadow-card);
	overflow: hidden;
}

.tree-item {
	display: flex;
	align-items: stretch;
	min-height: 112rpx;
	border-bottom: 1rpx solid var(--line-50);
	background: #ffffff;
}
.tree-item:last-child {
	border-bottom: none;
}
.tree-item-hv {
	background: #f5f7fc;
}
.depth-0 {
	background: #fbfcff;
}

.node-indent {
	flex-shrink: 0;
}
.node-rail {
	width: 2rpx;
	margin: 20rpx 0;
	background: var(--brand-100);
	flex-shrink: 0;
}
.node-body {
	flex: 1;
	display: flex;
	align-items: center;
	padding: 22rpx 12rpx 22rpx 16rpx;
	min-width: 0;
	gap: 16rpx;
}
.node-icon {
	width: 44rpx;
	height: 44rpx;
	border-radius: 999rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	font-size: 22rpx;
	color: var(--brand-600);
	background: var(--brand-50);
}
.icon-root {
	background: var(--brand-600);
	color: #fff;
	font-weight: 700;
}
.icon-branch {
	background: var(--brand-50);
	color: var(--brand-600);
}
.icon-leaf {
	background: var(--gold-50);
}
.leaf-dot {
	width: 12rpx;
	height: 12rpx;
	border-radius: 50%;
	background: var(--gold-600);
}
.node-text {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 4rpx;
}
.node-name {
	font-size: 29rpx;
	font-weight: 560;
	color: var(--ink-900);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.depth-0 .node-name {
	font-weight: 700;
	font-size: 30rpx;
}
.node-meta {
	font-size: 20rpx;
	color: var(--ink-400);
	letter-spacing: 1rpx;
}
.node-more {
	flex-shrink: 0;
	width: 64rpx;
	height: 64rpx;
	line-height: 64rpx;
	text-align: center;
	font-size: 36rpx;
	font-weight: 700;
	color: var(--ink-300);
	letter-spacing: 2rpx;
}

.foot-actions {
	padding: 8rpx 24rpx 48rpx;
}
.btn-ghost {
	margin: 0;
	height: 72rpx;
	line-height: 72rpx;
	font-size: 24rpx;
	color: var(--ink-400);
	background: transparent;
	border: 1rpx dashed var(--line-100);
	border-radius: 16rpx;
}
.btn-ghost::after {
	border: none;
}
</style>
