# 优化计划书 — 智能错题本

> 版本：v1.0　　日期：2026-09-29　　适用范围：考公/行测场景改造中版本（当前 package v1.9.1）
> 定位：本计划书面向项目下一阶段迭代，聚焦「考公转型收尾」「系统健壮性」「性能与体验」三个层面，按优先级排列，可直接作为开发排期依据。

---

## 0. 背景与现状

项目是一个基于 **Next.js 16 (App Router) + React 19 + Prisma/SQLite + Tailwind v4 + NextAuth** 的智能错题本。

**当前正处于关键转型期**：从 K12 学科学习场景，整体向 **考公/行测备考** 场景迁移。正在进行中的改动包括：

- 新增 [src/lib/subjects.ts](src/lib/subjects.ts)：考题默认按行测五大模块（言语理解 / 判断推理 / 数量关系 / 资料分析 / 常识判断）建本，AI 学科枚举下沉到统一文件。
- 重写 [src/lib/ai/prompts.ts](src/lib/ai/prompts.ts)：角色从"跨学科考试分析专家"改为"公务员考试（国考/省考/事业编）行测与申论辅导专家"，知识点/错因/图片依赖判断全部对齐行测语境。
- 改造 [src/lib/knowledge-tags.ts](src/lib/knowledge-tags.ts)：知识点映射覆盖行测模块关键词（数量/言语/申论/常识/资料/判断）。
- 三端 AI 提供方（[openai](src/lib/ai/openai-provider.ts)/[gemini](src/lib/ai/gemini-provider.ts)/[azure](src/lib/ai/azure-provider.ts)）与 [schema.ts](src/lib/ai/schema.ts)、[translations.ts](src/lib/translations.ts) 同步适配。

---

## 1. 优化总览

| 优先级 | 维度 | 目标 | 关键举措 |
| :---: | :--- | :--- | :--- |
| P0 | 考公转型收尾 | 转型完整、不残留 K12 逻辑、兼容旧数据 | A1–A5 |
| P0 | 数据兼容与迁移 | 旧 K12 数据不丢失、可回退 | B1–B3 |
| P1 | AI 能力与成本 | 降本增效、输出稳定、可观测 | C1–C5 |
| P1 | 性能与体验 | 首屏提速、交互流畅、图片流程顺滑 | D1–D5 |
| P2 | 健壮性与安全 | 错误可排查、权限可管控、可运维 | E1–E5 |
| P2 | 测试与质量 | 覆盖率回升、回归可控 | F1–F3 |

> P0 = 本轮必做；P1 = 建议本轮做；P2 = 可排后续。建议排期 2–3 个迭代。

---

## 2. P0 — 考公转型收尾

### A1. 学科/标签写到「单一事实源」（重要）

当前科目信息散落在多处：`AI_SUBJECT_OPTIONS`（subjects.ts）、`knowledge-tags.ts` 的 `inferSubjectFromName`、prompt 模板、translations。**任何一处漏改会导致 AI 输出与标签系统不一致。**

- 已做：`subjects.ts` 已定义 `AI_SUBJECT_OPTIONS` 与 `GONGKAO_NOTEBOOKS`。
- 待做：让 prompt 中的「科目枚举」、标签推断、前端下拉选项、统计聚合 **统一引用 `AI_SUBJECT_OPTIONS`**，消灭硬编码字符串。
- 检查清单：全局搜索 `"数学"、"物理"、语文、英语` 等 K12 残留，确认是否仍需在 AI 枚举中保留（兼容旧题）。若旧题仍含 K12 科目，保留但须在 UI 上区分。

### A2. 行测科目与统计口径

`inferSubjectFromName` 目前把「常识 → history」「资料 → geography」「判断 → politics」硬映射到 K12 科目，用于图表配色/统计归类。**这在考公语义下是近似且易误导的。**

- 调研：统计页 [stats/page.tsx](src/app/stats/page.tsx) 与 [wrong-answer-stats.tsx](src/components/wrong-answer-stats.tsx) 对这些映射的依赖程度。
- 建议：引入独立的行测模块归类逻辑（言语/判断/数量/资料/常识 + 申论），统计图按模块而非 K12 科目渲染；旧 K12 科目单独成组。

### A3. 默认建本逻辑

首页/新建用户时按 `GONGKAO_NOTEBOOKS` 建 5 个行测本。需确认：
- 是否仅新用户才建默认本？（避免重复建本）
- 是否提供「跳过建本 / 自定义」入口？
- 数据埋点：建本完成后是否有空态引导（引导上传第一道错题）。

### A4. 导出/打印文案

[print-preview](src/app/print-preview/page.tsx) 与导出 API [api/export](src/app/api/export/route.ts) 若含"学生/考试/年级"等 K12 文案，需改为考公语境（考生 / 模考 / 岗位）。

### A5. 年级学历约束逻辑

prompts.ts 中 `generateGradeInstruction` 已做考公兼容（非小学/初中/高中则不加学历约束）。建议：
- 抽为可测试的纯函数并补单测（当前 [ai-prompts.test.ts](src/__tests__/unit/ai-prompts.test.ts) 有改动，需覆盖考公分支）。
- 确认：考公用户是否还要投递「年级」字段？若不要，可在 UI 上隐藏该字段避免困惑。

---

## 3. P0 — 数据兼容与迁移

### B1. 旧数据兼容验证

- 已知旧 K12 错题（学科为数学/物理…）在**新枚举下如何展示、统计、导出**？须有明确的映射表 + 测试。
- 建议：写迁移/兼容清单文档，明确每个旧学科在新 UI 中的去向。

### B2. 回退与备份

SQLite（**via Prisma**）单文件库，`docker-entrypoint.sh` 已有配置管理。建议：
- 在 `config/` 或 `data/` 增加**每日自动备份勾子**（cron + sqlite `.backup`），保留近 N 份。
- 迁移操作前强制快照，操作后验证行数。

### B3. 标签数据迁移

`tag-data` 目录与 tag 识别逻辑对 K12 标签强依赖。考公标签（如"逻辑填空""转折关系"）需要**新的标签数据源**。梳理：
- [tag-service.ts](src/lib/ai/tag-service.ts) 与 [tag-recognition.ts](src/lib/tag-recognition.ts) 是否支持多套标签映射？
- 建议：标签映射改为**按科目/场景配置化**，考公与 K12 各持一套，避免互相污染。

---

## 4. P1 — AI 能力与成本

### C1. 结构化输出稳定性

[schema.ts](src/lib/ai/schema.ts) + 各 provider 已用 zod 约束。建议：
- 对解析失败做**重试 + 降级**（一次失败用纯文本兜底，二次失败给提示而非报错）。
- JSON 解析使用已有 `jsonrepair` 能力，统一入口封装（避免各 provider 各自处理）。

### C2. 超时与并发控制

- 给 AI 调用设置**合理超时**与**并发上限**，避免批量导入/练习生成时打爆上游或内存。
- [practice/generate](src/app/api/practice/generate/route.ts) 与 `batch-upload`（openclaw）是重点：批量请求需限流 + 排队 + 可见进度。

### C3. 成本控制

- 行测常识/言语等「轻任务」可用 flash 档模型，资料分析计算类用更强模型——**按任务类型路由模型**（prompt 或 provider 层支持）。
- 上传图片做压缩/降采样（已有 image-utils），降低多模态 token 成本；超大图提示用户。

### C4. Prompt 可配置化与版本化

- [prompt-settings.tsx](src/components/settings/prompt-settings.tsx) 已支持用户改 prompt。建议把 prompt 模板**加版本号 + 差异说明**，便于升级排查。
- prompt 变更（本次改造）必须有**回归基线**：用固定的几张样例图跑断言（见 F 节）。

### C5. 错误与日志

- 统一 AI 错误到前端可读信息（[api-errors.ts](src/lib/api-errors.ts)），区分「限流 / 超时 / 格式错误 / 无 key」。
- LOG_LEVEL 已支持；建议在 [logger.ts](src/lib/logger.ts)+[frontend-logger.ts](src/lib/frontend-logger.ts) 记录每次 AI 请求的 model + token + 耗时 + provider，供成本与质量分析。

---

## 5. P1 — 性能与体验

### D1. 首屏加载

- 首页 [page.tsx](src/app/page.tsx) 与 notebooks 页，确认是否可用 **RSC/缓存** 减少首屏请求。
- 图表库 recharts 体积较大，确认是否按需加载（`dynamic import` / 懒加载统计页）。

### D2. 图片上传与裁剪

图片流程涉及 [react-easy-crop](src/components/image-cropper.tsx)、[react-image-crop](src/components/image-crop-usage)、dropzone。建议：
- 上传前**前端压缩**（限制长边 + JPEG 质量），减少带宽与 AI token。
- 裁剪组件按需加载，避免主包膨胀。

### D3. 列表页分页

[error-list.tsx](src/components/error-list.tsx)、知识筛选（knowledge-filter）已有分页（ui/pagination）。建议：
- 确认分页参数放在 Query 而非仅客户端 state（刷新/分享可恢复）。
- 大数据量（>1k 条）下 Prisma 用 `cursor` 而非 `offset` 分页，避免深分页变慢。

### D4. 数据请求合并

确认首页/统计页是否存在 **N+1 请求**（多个独立 useEffect 并行 fetch）。合并为一次聚合接口（如已有 `api/analytics`）减少往返。

### D5. 移动端体验

PWA 已支持主屏安装。行测备考高频在手机端，建议：
- 确认**上传拍照 → 裁剪 → 识别**链路在移动端流畅，触控命中区域 ≥ 48px。
- 图表在窄屏的可读性。

---

## 6. P2 — 健壮性与安全

### E1. 权限与越权校验

- 多用户数据隔离：确认所有 `[id]` 路由（error-items、notebooks）都做了**属主校验**，防越权读取他人数据。
- [admin](src/app/admin/page.tsx) 后台与 users 路由：确认角色判断强度，防普通用户调用管理员接口。

### E2. AI Key 安全

- 确认 **API Key 只存服务端**（config/app-config.json + env），绝不下发到前端。
- [api/ai/models](src/app/api/ai/models/route.ts) 若返回可用模型，确认不泄露 key。

### E3. 输入校验

- 上传、注册、设置等接口是否有 zod 校验（zod 已在依赖中）。
- 确认图片文件**类型 + 大小 + MIME** 白名单，禁止任意文件上传。

### E4. 运维与可观测

- [logs/frontend](src/app/api/logs/frontend/route.ts) 已有前端日志上报。建议补 **requestId + 告警阈值**。
- 健康检查端点（`/api/version` 已有），建议加 DB 连通性与 AI key 有效性探针。

### E5. 依赖与安全更新

- next-auth v4（较老），升级需评估；至少跟进安全补丁。
- 尚无可执行吊死超时的对外依赖治理清单（详见附录需扫描的模块）。

---

## 7. P2 — 测试与质量

### F1. 补齐单元测试回归

本次 prompt/标签改动较多，[ai-prompts.test.ts](src/__tests__/unit/ai-prompts.test.ts) 已改。建议：
- 新增 `subjects.test.ts`：枚举、`inferSubjectFromName` 考公分支、`GONGKAO_NOTEBOOKS`。
- `generateGradeInstruction` 考公/学历分支单测。
- 标签映射考公/ K12 双场景测试。

### F2. Prompt 回归基线

维护一组**固定样例（考公行测图片）**，跑通 analyze 后断言关键字段（subject 属于枚举、knowledge_points 数量、requires_image 布尔、JSON 可解析）。跑在 CI，prompt 变更即用。

### F3. 集成/E2E

- 已有 Playwright（test:e2e）与 vitest integration。建议补考公主流程冒烟：注册 → 建本 → 上传 → 识别 → 练习生成。

---

## 8. 建议迭代排期

| 迭代 | 内容 | 交付物 |
| :---: | :--- | :--- |
| IT-1 | A1–A3, B1–B2（转型收尾 + 数据兼容 + 备份） | 科目单一事实源、统计按模块、备份脚 |
| IT-2 | C1–C3, D1–D3（AI 稳定性/成本 + 性能） | 重试降级、模型路由、超时并发、首屏优化 |
| IT-3 | A4–A5, C4–C5, D4–D5（文案 + Prompt 版本化 + 体验） | 导出文案、prompt 基线、移动端优化 |
| IT-4 | E1–E5, F1–F3（安全 + 测试质量） | 权限加固、校验、测试回归基线 |

---

## 9. 风险与依赖

1. **旧 K12 数据**：若兼容策略不明确，会影响 B1 与 A2 的统计口径。→ 先产出兼容清单。
2. **prompt 大改**：行测改造已触及 prompt 核心，若回归基线缺失，AI 输出劣化难发现。→ IT-2 内尽早落地 F2。
3. **next-auth v4**：长期带风险。升级是独立工程，需单独评估排期。
4. **SQLite 并发**：多用户同时写时性能上限。单机/单容器部署尚可，量级上来再评估迁移 PostgreSQL。

---

## 附录：需重点扫描的模块

（便于后续按模块精读，快速定位每项举措的具体改动点）

| 模块 | 文件 | 对应举措 |
| :--- | :--- | :--- |
| 科目枚举 | `src/lib/subjects.ts`（新增） | A1, A2 |
| Prompt 模板 | `src/lib/ai/prompts.ts` | A5, C1, C4 |
| 标签推断 | `src/lib/knowledge-tags.ts`, `tag-service.ts`, `tag-recognition.ts` | A2, B3 |
| AI 提供方 | `src/lib/ai/{openai,gemini,azure}-provider.ts` | C1–C3, C5 |
| 导出/打印 | `src/app/api/export/route.ts`, `src/app/print-preview/page.tsx` | A4 |
| 统计 | `src/app/stats/page.tsx`, `src/components/wrong-answer-stats.tsx`, `practice-stats.tsx` | A2, D1, D4 |
| 列表与分页 | `src/components/error-list.tsx`, `src/components/ui/pagination.tsx` | D3 |
| 图片流程 | `src/components/{image-cropper,upload-zone}.tsx`, `src/lib/image-utils.ts` | C3, D2 |
| 管理后台 | `src/app/admin/*`, `src/app/api/admin/*` | E1, E2 |