<template>
	<view :class="['page', themeCls]">
		<!-- 导出备份 -->
		<view class="card fade-up">
			<view class="section-head">
				<text class="section-title">导出备份</text>
			</view>
			<text class="desc-text">把你的全部数据（错题本、知识点、复习计划、练习记录）导出为一个 JSON 备份文件。包含错题图片，文件可能较大，请耐心等待。</text>
			<button class="btn-primary action-btn" :disabled="exporting" hover-class="button-hover" @tap="exportData">
				{{ exporting ? "正在导出…" : "导出我的数据" }}
			</button>
		</view>

		<!-- 导入恢复 -->
		<view class="card fade-up">
			<view class="section-head">
				<text class="section-title">导入恢复</text>
			</view>
			<text class="desc-text">选择之前导出的 JSON 备份文件导入。导入为合并方式：已存在的题目会自动跳过，不会删除或覆盖现有数据。</text>
			<button class="btn-outline action-btn" :disabled="importing" hover-class="button-hover" @tap="chooseAndImport">
				{{ importing ? "正在导入…" : "选择备份文件导入" }}
			</button>
			<view v-if="importSummary" class="import-result">
				<text class="import-result-text">{{ importSummary }}</text>
			</view>
		</view>

		<view class="card fade-up tips-card">
			<text class="tips-title">温馨提示</text>
			<text class="tips-text">· 备份文件包含全部学习数据，请妥善保管，不要发给陌生人</text>
			<text class="tips-text">· 只能导入本账号导出的数据（其他账号的备份会被拒绝）</text>
			<text class="tips-text">· 建议重要阶段（如考试前）定期导出备份</text>
		</view>
	</view>
</template>

<script setup lang="ts">
import { useThemeClass } from "@/utils/theme";

const themeCls = useThemeClass();
import { ref } from "vue";
import { importUserData, type ImportStats } from "@/api";
import { BASE_URL } from "@/utils/config";

const exporting = ref(false);
const importing = ref(false);
const importSummary = ref("");

function todayStr(): string {
	const d = new Date();
	const p = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 导出：H5 直接触发浏览器下载；微信小程序写入本地文件后唤起分享 */
function exportData() {
	if (exporting.value) return;
	exporting.value = true;
	// #ifdef H5
	try {
		const a = document.createElement("a");
		a.href = "/api/export";
		a.download = `wrong-notebook-export-${todayStr()}.json`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		uni.showToast({ title: "已开始下载备份文件", icon: "none" });
	} catch (e: any) {
		uni.showToast({ title: e?.message || "导出失败", icon: "none" });
	} finally {
		exporting.value = false;
	}
	// #endif

	// #ifdef MP-WEIXIN
	uni.request({
		url: `${BASE_URL}/api/export`,
		method: "GET",
		success: (res) => {
			if (res.statusCode < 200 || res.statusCode >= 300 || typeof res.data !== "string") {
				uni.showToast({ title: "导出失败，请重试", icon: "none" });
				exporting.value = false;
				return;
			}
			const filePath = `${wx.env.USER_DATA_PATH}/wrong-notebook-export-${todayStr()}.json`;
			wx.getFileSystemManager().writeFile({
				filePath,
				data: res.data as string,
				encoding: "utf8",
				success: () => {
					exporting.value = false;
					wx.shareFileMessage({
						filePath,
						fileName: `错题本备份-${todayStr()}.json`,
						success: () => uni.showToast({ title: "备份已分享", icon: "none" }),
						fail: () => uni.showToast({ title: "已保存到本地，可再次分享", icon: "none" }),
					});
				},
				fail: () => {
					exporting.value = false;
					uni.showToast({ title: "备份文件写入失败", icon: "none" });
				},
			});
		},
		fail: () => {
			exporting.value = false;
			uni.showToast({ title: "网络异常，导出失败", icon: "none" });
		},
	});
	// #endif
}

/** 导入前置确认：说明合并语义，防止误以为会覆盖 */
function confirmImport(): Promise<boolean> {
	return new Promise((resolve) => {
		uni.showModal({
			title: "确认导入",
			content: "将以合并方式导入备份中的数据：已有题目自动跳过，不会删除现有数据。继续吗？",
			success: (res) => resolve(!!res.confirm),
			fail: () => resolve(false),
		});
	});
}

async function doImport(raw: string) {
	let data: any;
	try {
		data = JSON.parse(raw);
	} catch (e) {
		uni.showToast({ title: "文件不是有效的 JSON 备份", icon: "none" });
		return;
	}
	if (!data || !data.user || !Array.isArray(data.errorItems)) {
		uni.showToast({ title: "不是本系统导出的备份文件", icon: "none" });
		return;
	}
	// 账号归属由后端强校验（非本人数据直接拒绝），前端不做预判
	if (!(await confirmImport())) return;

	importing.value = true;
	try {
		const res = await importUserData(data);
		const s = res?.stats;
		importSummary.value = s
			? `导入完成：错题 ${s.errorItemsCreated || 0} 题、知识点 ${s.tagsCreated || 0} 个、练习记录 ${s.practiceRecordsCreated || 0} 条（重复已自动跳过）`
			: "导入完成";
		uni.showToast({ title: "导入成功", icon: "success" });
	} catch (e: any) {
		uni.showToast({ title: e?.message || "导入失败", icon: "none" });
	} finally {
		importing.value = false;
	}
}

/** 选择文件：H5 用文件选择器，微信小程序从聊天记录选 */
function chooseAndImport() {
	if (importing.value) return;
	// #ifdef H5
	const input = document.createElement("input");
	input.type = "file";
	input.accept = ".json,application/json";
	input.onchange = async () => {
		const file = input.files && input.files[0];
		if (!file) return;
		try {
			const text = await file.text();
			await doImport(text);
		} catch (e: any) {
			uni.showToast({ title: e?.message || "读取文件失败", icon: "none" });
		}
	};
	input.click();
	// #endif

	// #ifdef MP-WEIXIN
	wx.chooseMessageFile({
		count: 1,
		type: "file",
		extension: ["json"],
		success: (res) => {
			const file = res.tempFiles && res.tempFiles[0];
			if (!file) return;
			wx.getFileSystemManager().readFile({
				filePath: file.path,
				encoding: "utf8",
				success: (r) => doImport(String(r.data)),
				fail: () => uni.showToast({ title: "读取文件失败", icon: "none" }),
			});
		},
	});
	// #endif
}
</script>

<style scoped>
.section-head {
	margin-bottom: 12rpx;
}
.section-title {
	font-size: 30rpx;
	font-weight: 700;
	color: var(--ink-900);
}
.desc-text {
	display: block;
	font-size: 24rpx;
	color: var(--ink-500);
	line-height: 1.7;
	margin-bottom: 24rpx;
}
.action-btn {
	width: 100%;
}
.import-result {
	margin-top: 20rpx;
	background: var(--brand-50);
	border-radius: 12rpx;
	padding: 20rpx 24rpx;
}
.import-result-text {
	font-size: 24rpx;
	color: var(--brand-600);
	line-height: 1.6;
}
.tips-card {
	display: flex;
	flex-direction: column;
	gap: 10rpx;
}
.tips-title {
	font-size: 26rpx;
	font-weight: 600;
	color: var(--ink-700);
}
.tips-text {
	font-size: 22rpx;
	color: var(--ink-400);
	line-height: 1.6;
}
</style>
