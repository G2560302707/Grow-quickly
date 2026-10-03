# 后续优化功能计划书 V2 — 智能错题本

> 版本：v2.0　　日期：2026-10-03　　前置文档：[OPTIMIZATION_PLAN.md](OPTIMIZATION_PLAN.md)（V1，2026-09-29，考公转型专项）
> 定位：V1 聚焦「K12 → 考公」转型收尾；本计划书基于 **2026-10-03 全量自测结果 + 代码库逐项核查**，给出转型之后的下一步工程与产品计划。所有问题均附代码证据，可直接作为排期依据。

---

## 1. 自测结论（2026-10-03）

### 1.1 测试结果总览

| 类别 | 结果 | 说明 |
| :--- | :--- | :--- |
| 单元测试（vitest） | ✅ 23 文件 / 341 用例全过 | 16.6s |
| 集成测试（vitest） | ✅ 12 文件 / 204 用例全过 | API 层覆盖良好 |
| E2E（Playwright） | ✅ 3/3 通过（修复后） | 修复前 1 过 2 败，见 1.3 |
| 网页端冒烟（:3000） | ✅ | 9 个页面鉴权跳转正确；API 未登录 401 / 管理接口 403 隔离正确 |
| uniapp H5（:5173） | ✅ | 页面 200，`/api` 代理到 :3000 正常（实测 `{"version":"1.9.1"}`） |
| 小程序产物（mp-weixin） | ✅ | 11 个页面 + 3 tab 编译完整，watch 模式正常 |
| ESLint | ⚠️ 237 问题（150 errors / 87 warnings） | 主要为 `no-explicit-any`、`@ts-ignore` 等 |
| tsc 类型检查 | ⚠️ 51 错误，全部在测试文件 | src 生产代码 0 错误；测试缺 vitest globals 配置 |

### 1.2 核心结论

功能层面**三端（Web / H5 / 小程序）均可正常使用**，鉴权、数据隔离、AI 流程、业务闭环无阻断性缺陷。主要欠账在**工程质量**与**数据层性能**两块，随用户量增长会逐步放大。

### 1.3 自测过程中发现并已修复的问题

| # | 问题 | 修复 |
| :--- | :--- | :--- |
| 1 | Playwright 升级后本机无匹配的 `chromium_headless_shell`，E2E 全部无法启动 | `playwright.config.ts` 增加 `channel: 'chromium'`，改用完整 chromium 的无头模式（顺带省掉一套浏览器构建的维护） |
| 2 | `auth-flow` 用例仍监听原生 `confirm()`，而管理端已改用应用内 `confirmDialog`（改版遗留） | [auth-flow.spec.ts](../e2e/auth-flow.spec.ts) 改为点击 Radix 对话框确认按钮 |
| 3 | `upload-correction` 用模糊的 h2 定位器，改版后首页出现多个 h2 导致歧义；且保存/删除成功后新增的 `alertDialog` 提示框无人点击，阻塞了跳转断言 | [upload-correction.spec.ts](../e2e/upload-correction.spec.ts) 按标题名称定位 + 补两处提示框点击 |

> **教训（进入 P0-1 依据）**：前端大改版（feature/frontend-upgrade 合入）后 E2E 静默失效了近一个月而无人发现——因为没有任何 CI 在跑它。测试通过 ≠ 有回归防护，**必须在 CI 里跑起来**。

---

## 2. 与 V1 计划的衔接

V1 中以下条目经本轮核查**仍然有效，继续沿用**，本计划不再展开：

- **C1–C5（AI 稳定性/成本/可观测）**：超时并发控制、模型按任务路由、prompt 版本化——均未落地，维持 V1 排期。
- **A1–A5 / B1–B3（转型收尾与数据兼容）**：`src/lib/subjects.ts` 单一事实源已建，统计口径切换仍待做。
- **D3（分页）/ D5（移动端）**：维持。

V2 新增/收紧的重点（V1 未覆盖或证据不足的）：

| 维度 | V2 新增内容 |
| :--- | :--- |
| 数据层性能 | 核心表零索引、列表接口携带 base64 大字段、内存聚合——本轮逐行核实（见 P0-2、P1-1） |
| 安全 | 全站无限流、zod 仅 2/44 路由使用、错误信息透传——逐路由核实（见 P0-3） |
| 工程质量 | E2E 断档、ESLint 150 errors、测试 tsconfig 缺陷、依赖大版本落后（见 P0-1、P2-1） |
| 多端协同 | 小程序与网页端的功能差距清单（见 P1-3） |

---

## 3. P0 — 质量与数据层加固（下一迭代必做）

### P0-1. 建立 CI 回归防线（含本轮修复的制度化）

**问题**：E2E 改版后静默失效近一个月（1.3 节）；测试只有本地手跑才有价值。

**方案**：
1. 仓库加 GitHub Actions / GitLab CI（gitlab 为主仓）：`lint → unit → integration → e2e` 四步流水线，E2E 用 `npm run start`（standalone 构建产物，比 dev server 稳定）。
2. ESLint 先设基线（150 errors 只减不增），tsc 给测试目录补 vitest globals 配置（`tsconfig` 加 `"types": ["vitest/globals"]`，51 个错误即刻清零）。
3. Playwright HTML 报告作为 CI 产物，失败可回看截图/trace。

**验收**：每次 push 自动跑全量测试；改版导致选择器失效时 CI 当次变红。
**工作量**：0.5 ~ 1 天。

### P0-2. 数据层性能改造（用户量增长前的时间窗）

**问题与证据**：
- `ErrorItem`、`ReviewSchedule` 等核心表**零索引**（[prisma/schema.prisma:128-177](../prisma/schema.prisma)），所有按用户查询均为全表扫描；
- 错题列表 `include: { subject: true, tags: true }` 全量返回，**每条记录携带最大 14M 字符的 base64 图片**（[error-items/list/route.ts:147-156](../src/app/api/error-items/list/route.ts)，上限定义见 [error-items/route.ts:15](../src/app/api/error-items/route.ts)）——列表 50 条即可拖垮移动端；
- 图片以 base64 直接写库（[openclaw/batch-upload/route.ts:171](../src/app/api/openclaw/batch-upload/route.ts)），当前 dev.db 仅 256KB，但按单图 ~1MB 估算，**1000 道题即让库膨胀到 GB 级**，备份/查询/响应全面劣化。

**方案**（按序）：
1. schema 补索引：`@@index([userId, createdAt])`、`@@index([subjectId])`、`@@index([userId, masteryLevel])`，一次 migration；
2. 列表接口改 `select`，排除 `originalImageUrl`/`ocrText`/`analysis` 大字段，详情页再按需取图；
3. 图片出库：新上传写文件系统（`data/uploads/`，Docker volume 已挂载）或对象存储，DB 只存 URL；存量 base64 写一次性迁移脚本。服务端补图片压缩（目前仅客户端有，[image-utils.ts:9](../src/lib/image-utils.ts)）。

**验收**：1000 条错题时列表接口 P95 < 300ms；DB 体积不随图片数量线性膨胀。
**工作量**：2 ~ 3 天（含迁移脚本与三端验证）。

### P0-3. 安全加固三件套

**问题与证据**：
- **全站无限流**：注册、bcrypt 登录、openclaw apiKey 校验（且为 `!==` 明文比较，[batch-upload/route.ts:226](../src/app/api/openclaw/batch-upload/route.ts)）均可无限暴力尝试；
- **输入校验覆盖率 2/44**：仅 register 与 user 路由用 zod，其余全部手工解析 body；`/api/analyze` 的 imageBase64 无 MIME 白名单（对比 openclaw 已有 `ALLOWED_MIME_TYPES`）；
- **错误信息透传**：约 8 处路由把 `error.message` 原样返回（如 [ai/models/route.ts:118](../src/app/api/ai/models/route.ts)、[reanswer/route.ts:47](../src/app/api/reanswer/route.ts)），可能泄漏上游 AI 服务地址与配置。

**方案**：
1. 引入轻量限流（内存令牌桶即可，单机部署无需 Redis）：登录 5 次/分钟/IP、注册 3 次/小时/IP、AI 接口按用户 10 次/分钟；apiKey 改 `timingSafeEqual`；
2. 通用 `validateBody(schema)` 中间件函数，优先覆盖注册/登录/上传/设置四类入口；
3. 统一走 [api-errors.ts](../src/lib/api-errors.ts) 的 `internalError`，原始错误只进日志。

**验收**：连续错 5 次密码被限流；错误响应不含上游 URL；44 条路由中安全敏感的 15 条全部有 schema 校验。
**工作量**：2 天。

---

## 4. P1 — 体验与效率（紧随 P0）

### P1-1. 统计/诊断接口聚合化 + 缓存

**证据**：[analytics/route.ts:39-48](../src/app/api/analytics/route.ts) 把用户全部错题（含 base64）拉进内存用 Map 统计；同文件 60-75 行用 for 循环发 7 次 `count` 算近 7 天活跃；[diagnosis/weakness/route.ts:35-51](../src/app/api/diagnosis/weakness/route.ts) 一次性拉全部错题+练习记录+标签。全库无任何 `unstable_cache`/`revalidate`。
**方案**：改 Prisma `groupBy` 与日期聚合一次取回；admin/dashboard 与 stats 类接口加 60s `unstable_cache`（按 userId 维度）。
**验收**：analytics 接口不再加载图片字段，请求数从 8+ 降到 1~2；统计页二次打开 < 500ms。
**工作量**：1.5 天。

### P1-2. 导出能力升级（对考公用户价值最直接）

**证据**：[export/route.ts:93-100](../src/app/api/export/route.ts) 仅支持 JSON；打印预览（print-preview）已覆盖"纸质复盘"场景，但电子表格化整理仍不可能。
**方案**：新增 CSV（Excel 直接打开，注意 BOM 防中文乱码）与按知识点筛选导出；PDF 可直接复用 print-preview 的打印为 PDF 路径，不重复建设。
**验收**：导出的 CSV 在 Excel/WPS 打开中文无乱码；支持按科目/标签/掌握度三维度筛选导出。
**工作量**：1 天。

### P1-3. 小程序端补齐"诊断 → 练习"闭环

**证据**：uniapp 仅 11 页（analyze/detail/help/index/items/login/practice/profile/profile-edit/register/stats），**网页端独有的**：错题本（科目）管理、知识点标签管理、薄弱点诊断（diagnosis/weakness）、导出打印。行测备考高频场景在手机端，"看薄弱点 → 定向练习"却只能在电脑上做。
**方案**：按价值排序补三页：① 薄弱点诊断（复用 `/api/diagnosis/weakness`，接口现成）；② 标签管理（`/api/tags`）；③ 错题本切换（练习页需先选科目）。导出/打印留在 Web 端（小程序分享图片方案另行评估）。
**验收**：小程序内可完成"看诊断 → 按薄弱点练习"全流程，无需切网页。
**工作量**：3 ~ 4 天（接口全部现成，纯前端页面）。

### P1-4. 依赖升级专项（分三个独立 PR，禁止一把梭）

**证据**：`@prisma/client 5.22 → 7.10`（跨两个大版本，driver adapter 已在用）、`@google/genai 1.34 → 2.27`（大版本，AI 核心依赖）、`next-auth 4.24`（V1 已识别，Auth.js v5 才是 Next 16/React 19 官方支持线，[auth.ts:15](../src/lib/auth.ts) 现挂 `@ts-expect-error` 运行）、`@playwright/test 1.57 → 1.63`、Radix 全家桶小版本。
**方案**：PR-1 Radix/playwright 等安全小版本；PR-2 @google/genai 2.x（重点回归 analyze 三 provider）；PR-3 prisma 7（重点回归迁移与 adapter）；next-auth v5 单独立项评估。
**验收**：每个 PR 合入前全量测试绿（依赖 P0-1 的 CI）。
**工作量**：各 0.5 ~ 1 天 + 回归。

---

## 5. P2 — 工程健康与长期项

| # | 项 | 证据 | 方案 | 工作量 |
| :--- | :--- | :--- | :--- | :--- |
| P2-1 | Lint/类型债清零 | ESLint 150 errors（`any` 117 处、`@ts-ignore`、`module` 变量等）；console.log 残留 22 处（如 [correction-editor.tsx:108](../src/components/correction-editor.tsx)） | 分模块清理；AI 返回结构补类型；debug 日志统一走 frontend-logger | 2 天 |
| P2-2 | 测试覆盖空白 | announcements、diagnosis、export/import、feedback、openclaw、ai/* 及 error-items 全部子路由共 **20+ 路由零测试** | 优先补 import/export 与 openclaw（外部通道，出问题影响面大）；沿用现有 integration 测试模式 | 2 天 |
| P2-3 | 杂项清理 | [latex-test/page.tsx](../src/app/latex-test/page.tsx) 开发页随生产暴露；Next 16 `middleware` 命名已弃用应迁 `proxy`；前端上报日志接口无条数上限可刷爆 | latex-test 加环境开关；middleware.ts 改名 + 回归；logs 接口限 100 条/请求 | 0.5 天 |
| P2-4 | PWA 离线复习 | 有 [manifest.ts](../src/app/manifest.ts) 无 Service Worker；"错题复习"恰是地铁/断网高频场景 | 轻量 SW：缓存壳 + 已加载错题列表离线可读，AI 功能明确标注需在线 | 2 ~ 3 天 |
| P2-5 | AI key 管理加固 | [config.ts:7](../src/lib/config.ts) key 明文存容器内 `config/app-config.json` | 支持 env 注入优先、文件兜底；文档标注该文件敏感勿随备份外发 | 0.5 天 |

---

## 6. 建议排期

| 迭代 | 内容 | 交付物 |
| :---: | :--- | :--- |
| IT-1（本周） | P0-1 + P0-2 | CI 流水线、索引 migration、列表接口瘦身、图片出库迁移 |
| IT-2 | P0-3 + P1-1 | 限流 + 校验 + 错误统一、聚合接口 + 缓存 |
| IT-3 | P1-2 + P1-3 | CSV 导出、小程序诊断/标签/错题本三页 |
| IT-4 | P1-4 + P2（按需） | 依赖升级三连、lint 清零、离线 PWA |

V1 未完成的 C 组（AI 稳定性/成本）与 A/B 组收尾项穿插在 IT-2 ~ IT-4 中并行推进。

## 7. 风险与依赖

1. **P0-2 的存量图片迁移**：必须在迁移前做全库快照（V1 B2 的备份钩子建议提前到本迭代实现，`sqlite .backup` + cron 即可）。
2. **限流的误伤**：考公季批量导入场景需为 openclaw 通道设置独立的宽松配额，避免限流打断正常批量上传。
3. **next-auth v4 → v5**：涉及会话与回调改造，是唯一可能伤及三端登录的改动，必须在 CI 完善后、且单独立项评估，不做顺手升级。
4. **SQLite 并发上限**：单机部署下写并发有限，若 P0-2 落地后仍有性能瓶颈（多用户同时写），再评估 PostgreSQL，本轮不预先迁移。
