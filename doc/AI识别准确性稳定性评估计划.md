# AI 识别题目：准确性与稳定性评估计划

> 版本：v1.1　|　日期：2026-10-15　|　状态：评估框架已完成；**M1 可观测性(落盘)已实现**；样本集标注与真实基线待用户参与
> 目标：为「拍照/多图 → AI → 结构化题干/答案/解析」这条识别链路建立一套**可重复、可量化、可回归**的评估方法，先准确/稳定地评估现状，再据评估结果驱动优化。

## 实施进度
- ✅ 框架成文（v1.0）
- ✅ M1-① AI 评估日志落盘：新增 `src/lib/ai-eval-log.ts`，analyze route（单图/多图成功 + 统一错误路径）每次识别写一行 JSONL 到 `.ai-eval/ai-eval-<date>.jsonl`（目录已 gitignore，可用 `AI_EVAL_LOG_DIR` 覆盖；不落图片 base64，长字段截断，写盘失败静默）。已冒烟验证：provider/model/场景/时延/错误/结构化结果均正确落盘。`readProviderLabel()` 实测当前 active = openai / deepseek-flash。
- ⬜ M1-② 请求代理固定 provider：config 文件已能固定；如需"同 golden 跑多 provider"，评估跑前在 `config/app-config.json` 切 provider 即可（暂不外挂代理参数）。
- ⬜ M1-③ golden 样本集 + 标注：**待用户提供/授权**（见 §8 开放问题）。
- ✅ M2 风险项 1 实测（2026-10-15，临时脚本 `_scratch_ai_test/eval-deepseek-multimodal.mjs`，不入库）：**deepseek-flash 支持 image_url base64 多模态，单/多图+跨页拼接 3/3 全通过**，返回完整 XML，时长 0.2~0.5s，token 用量合理。§5 风险#1 关闭（无风险）。基线起点已建立。
- ✅ **M2 golden 首轮基线（2026-10-17，考公真题实测）**：用户提供 8 题考公截图（常识判断×7 + 数量关系×1）→ 脚本切割 18 段（2~3 段/题、15% 重叠，`_scratch_ai_test/slice_questions.py`）→ 走完整链路 `/api/analyze` 多图 sharp 拼接 → deepseek-flash。**结果：题干完整重建 8/8（含选项）、学科判定 8/8、解析全部生成（559~1081 字）、知识点均输出；答案直接对照 6/8，复核后 7/8 有效**——q2 差异实为 golden 标注用了旧法（2024 新《行政复议法》第 24 条由本级政府管辖，AI 答 C 正确），q4 为题目改编歧义（B/D 史实均对，AI 按多选作答合理），两例均非识别失败。端到端时延 6.1~18.0s（完整链路含拼接/prompt，远高于 provider 直连的 0.2~0.5s，属正常）。脚本与结果存 `_scratch_ai_test/`（`eval-golden.mjs`/`score-golden.mjs`/`results/`，不入库）。**注意**：响应字段为 camelCase（questionText/answerText），评分脚本首次提取踩坑。
- ⬜ M2 golden 基线采集（逐字段准确率报表）：**golden 样本集待用户，已记待办**（用户 2026-10-15 决定稍后做，现在先做）。
- ⬜ reanswer / detect 路由接入同一落盘工具（复用，改动小，评估这两条链路时再补）。

---

## 1. 背景与为什么现在评估

当前识别链路是纯 AI 视觉理解 + XML 结构化返回：

```
拍照/多图 → POST /api/analyze（单图 | images[] 服务端 sharp 拼接）
→ getAIService() 按 config.aiProvider 分派 provider
→ provider 发多模态 image_url → 模型返回 XML
→ provider 内 extractTag + parseResponse 切片解析
→ zod safeParse（失败仅 warn 静默兜底）→ ParsedQuestion
```

但评估分为准确性与稳定性两部分，现状里**两者都有缺口**：

### 准确性侧（语义对不对）
- `src/app/api/analyze/route.ts` 用 `getServerSession` 认证；限流 10/min；多图 `MAX_IMAGES=5`、单张解码 ≤5MB、总 base64 ≤60M 字符、拼接 `1400px/12000px/8MB` 预算（[image-stitch.ts](src/lib/image-stitch.ts)）。
- **当前 active provider 是 DeepSeek（`app-config.json` 覆盖 `.env`，`aiProvider:"openai"`，model `deepseek-flash`）**。⚠️ DeepSeek 传统不强支持 `image_url` base64 内联多模态——**这是准确性首要待实测风险**。
- 解析靠 provider 内 `extractTag(text, tagName)`，用 `lastIndexOf(endTag)`：模型重复/嵌套同名标签时可能截错区间；且只有 OpenAI provider 对 `<analysis>` 未闭合做了读到末尾的容错，Gemini/Azure 没有。
- 三家 `parseResponse` 的 zod `safeParse` 校验失败**仅 warn 并静默返回未校验结果**（openai L165-169 / gemini L118-126 / azure L150-158）——标签超 5、subject 非法等不重试不拒绝。
- 缺必需标签时抛 `"Invalid AI response: Missing critical XML tags"`，该 message **不匹配任何 AI_* 码**，会被以原始英文 message 透传前端（[analyze/route.ts](src/app/api/analyze/route.ts) L283-317 映射无此条）。

### 稳定性侧（会不会挂 / 快不快 / 会不会崩）
- 超时统一 `config.timeouts.analyze = 180s`；重试 `retryOperation` 默认 3 次指数退避（1/2/4s）。
- 但**重试覆盖不一致**：Gemini 全链路包 `retryOperation`，OpenAI 普通路径只靠 SDK `maxRetries:2`（仅 LongCat 走 retryOperation），**Azure analyzeImage 无显式重试**。
- 限流是内存令牌桶、**单实例 only**（多实例部署失效，`rate-limit.ts` 注解），10/min 按用户。
- **AI 原始请求/响应只打到 console，不落盘**——没有任何可回放的评估日志，无法统计正确率/失败分布。
- **无 golden 样本集**；已有测试 [analyze.test.ts](src/__tests__/integration/analyze.test.ts) mock AI 且坏 case 覆盖薄弱（没有乱码/非 XML/空 content/重复标签/截断用例）；`detect` 完全没有测试。
- 未知学科时 prompt 注入全部 K12 标签但不含行测标签，自动识别学科时打标可能漂移（[prompts.ts](shared/src/ai/prompts.ts) L444-459）。
- `TODO任务代办.txt` 第一条已记录官方对纯 AI 识别不足的认知，打算引入 OCR 对照。

> 结论：现在缺的**不是"再调 model"，而是一把能测出"到底差在哪、差多少、改完有没有变好"的尺子**。本计划就是这把尺子。

---

## 2. 评估维度与指标定义

统一分两轴：**准确性（质量）**与**稳定性（服务可靠性）**。所有指标给出定义、公式口径、采集来源。

### 2.1 准确性指标（语义质量）

| 指标 | 定义 | 计算 | 采集 |
|---|---|---|---|
| 题干语义一致率 | 模型 `question_text` 与真实题干语义是否等价 | 人工/LLM 打分 0|0.5|1，取均值 | golden 集逐题对照 |
| 答案正确率 | `answer_text` 与标准答案是否等价 | 同上学分 | golden 集 |
| 解析深度达标率 | `analysis` 是否含考点/步骤/易错点核心要素 | 人工 0|1 | golden 集 |
| 字段完整率 | 9 标签中必需三件套（question/answer/analysis）是否齐全非空 | 齐全数/总数 | 全量+golden |
| 学科判定正确率 | `subject` 是否与题目实际学科一致 | 判对数/总数 | golden 集 |
| 知识点精确率 | `knowledge_points` 命中真实考点比例 | 命中/给出数 | golden 集 |
| 结构健康率 | XML 无重复/截断/嵌套错乱的比例 | 健康数/总数 | 全量自动检测 |
| 多图跨页准确率 | 2~5 张拼接后能否完整重建一道题 | 同题干一致率口径 | 跨页 golden 子集 |
| 人工修正率（生产信号） | 保存前用户在校对页改动字段的比例 | 改题数/保存数 | 前端埋点（若做） |

### 2.2 稳定性指标（服务可靠性）

| 指标 | 定义 | 计算 | 采集 |
|---|---|---|---|
| 接口成功率 | HTTP 2xx / 总请求 | 占比 | 请求日志 |
| 错误码分布 | 各 `AI_*` / `INVALID_INPUT` / 5xx 占比 | 分类直方图 | 日志 |
| 解析失败率 | 抛 `Missing critical XML tags` / safeParse 失败 | 失败数/请求数 | 请求日志 |
| 时延 P50/P95/P99 | 单图/多图可观测量 | 分位数 | 日志/探针 |
| 重试命中率 | 触发重试(1 次以上)占总请求比例 | 占比 | 日志 |
| 超时率 / 限流触发率 | 超时；429 | 占比 | 日志 |
| 降级/兜底率 | 静默返回未校验结果的比例 | 占比 | 代码埋点(做时) |

---

## 3. 样本集（Golden Set）设计

评估准确性必须有可控基准集。按**维度分层抽样**，保证每个坑都能暴露。

**维度：**
- 学科：行测、申论、K12 各科（数学/物理/化学/生物/英语）
- 题型：选择 / 填空 / 解答 / 综合（含配图/表格的题）
- 图质：清晰 / 轻度倾斜 / 低清 / 阴影遮挡
- 张数：单张；2~5 张拼接（跨页长题）
- 作答痕迹：无（空白卷） / 有（学生笔迹+错勾）
- 疑难项：审题不清、多小题（(1)(2)(3)）、长题干一页拍不下

**规模与组织：**
- 首批目标 60~100 题，分层配额，单批 ≤30 题便于人工标注。
- 每批固定：图片 + 标准答案（人写）+ 期望标签（question/answer/analysis/keyword/subject）。
- 存 `_eval/golden/`（**不入库、不提交**，与密钥同待遇）。
- 样本来源：现有 `e2e/fixtures` 2 张 PNG 作种子，后续从真实错题补充。

**评价方式（双轨一致性）：**
1. 人工逐字段打分（0|0.5|1），为主要权威口径；
2. `LLM-as-judge` 用旁路模型按同一 rubric 打分，量化与人工一致性；两轨分歧大的样本单独复核。
3. 结果落成 `结果表 {golden_id, 字段, 得分, 判定理由, 是/否重试} `，可回放、可 sort、可归因。

---

## 4. 评估台阶（先补观测，再测，再归因）

在往程序里加"测量"之前，先补上三个地基，让评估可回放、可归因、不烧钱：

1. **可观测性（前置，必做）**：把 AI 请求与原始响应从 console 改为**落盘**（JSONL：request 摘要 + raw response + provider + model + 时延 + 耗时分布）。不落盘，一切准确率都无法统计。
2. **坏例回放集**：从真实响应里沉淀"识别失败/解析失败/超时"的原始报文，作为稳定性回归的最小集合。
3. **请求代理**：评估必须能**固定 provider / 固定 model / 固定 prompt 版本**跑同一 golden 集，避免 config 漂移污染对比。

> 注：以上三项在"评估框架"阶段**只设计方案形态，不实现**；落到实施时再编码。

**评估执行序列（每轮改造前先采基线）：**

```
基线：固定 provider=gemsni.deepseek 现状 → 跑 golden + 采集日志 → 得准确率 & 稳定性报表
→ 归因：按 §5 问题清单逐项定位（多模态? 解析? 兜底? 重试? prompt?）
→ 优化验证：改一处 → 重跑同一 golden → 对比报表（同一基线可回归）
```

---

## 5. 从侦察到的高危归因清单（评估第一优先要实测的）

按对准确/稳定的破坏力排序，评估时逐个验证并固化结论：

| # | 风险点 | 证据 | 评估动作 |
|---|---|---|---|
| 1 | **DeepSeek 是否真支持 `image_url` base64 多模态** | 当前 active=DeepSeek(deepseek-flash) | ✅ 已实测 3/3 支持（单/多图+跨页），风险**关闭**（2026-10-15） |
| 2 | 解析 `lastIndexOf` 遇重复/嵌套同名标签截错 | provider `extractTag` 实现 | golden 集放重复标签样例 + 断点观察 |
| 3 | 三家 schema `safeParse` 失败静默兜底、不重试不拒绝 | openai/gemini/azure `parseResponse` | 断言：非法 subject、knowledgePoints>5 时的行为 |
| 4 | 缺必需标签抛英文 message，不透传友好中文 | route 错误映射缺此条 | 构造缺标签响应，验证前端提示 |
| 5 | 重试覆盖不一致（Azure 无重试） | azure-provider | 注入瞬时失败，验证退避与最终结果 |
| 6 | 限流内存单实例 | `rate-limit.ts` 注解 | 多实例部署下是否失效（部署层是否已在/要做多实例） |
| 7 | 未知学科 prompt 注入缺行测标签致学科漂移 | `prompts.ts` L444-459 | 无 subjectId 时识别结果 subject 分布检查 |
| 8 | AI 仅打 console、零评估日志 | `shared/src/logger.ts` | 评估基线必须依赖它重建回放 |

---

## 6. 稳定性专项测试项（脚本化/可重复）

不依赖真实用户流量，独立可跑：

- **并发/限流**：同用户 1 秒内 >10 次 → 期望 429；确认限流封锁窗口。
- **超时**：放大超时或挂起 provider → 期望 `AI_TIMEOUT_ERROR`，P95 不被拖垮。
- **网络瞬时断/慢**：注入 connect reset → 验证 `retryOperation` 退避后恢复或归类 `AI_CONNECTION_FAILED`。
- **大图/超高**：拼接超 `12000px`/缩到 640px 仍超 → 期望明确中文报错，不卡死（已有用例但单测需补）。
- **provider 降级切换**：在 app-config.json 切换 gemini↔openai↔azure，同一 golden 跑通，确认各 provider 独立不串。
- **返回坏形状**：空 content、纯 JSON、markdown 包裹的 XML、乱码、重复标签 → 各自期望可预测地归类（成功结构化 / 解析失败 / 降级），并端到端不 500。

---

## 7. 执行步骤与里程碑（评估驱动落地）

> 本阶段交付评估框架本身；里程碑给出"做评估→出结果→归因→验证"的顺序，便于后续作为独立工单推进。

- **M0 产出本评估框架**（本文档）✅
- **M1 地基**：AI 响应落盘 + 请求代理固定 provider + golden 集(首批 60 题) + 标注规范
- **M2 基线采集**：跑通 golden → 生成准确率 & 稳定性报表；实测 §5 风险项 1（DeepSeek 多模态）
- **M3 归因报告**：按 §5 清单打分、定位每项真实影响，输出"准确率短板分布 + 稳定性短板分布"
- **M4 优化验证（评估驱动）**：逐项改 → 同一 golden 回归 → 对比报表 → 合入
- **M5 常设回归**：把 golden + 回放集挂到 CI/提交前置，prompt & model 升级必须过回归

验收标准：
1. 同一 golden 集可被重复跑出**可复现**的报表（确定性）。
2. 报表能归因到"模型 / prompt / 解析 / provider / 图片质量"至少一层。
3. 任意优化改动后能跑回归并给出**变好/变坏/持平**结论。
4. 无 golden 集与零日志的现状被补齐（M1 完成即达标）。

---

## 8. 开放问题（实施前需定）

1. **样本标注人力**：首批 60 题人工标注是否可接受？（或先用 LLM-as-judge 粗标 + 人工抽查）
2. **DeepSeek 多模态实测**：是否允许直接拿测试 key 打真实请求评估（会消耗 token）？
3. **落地范围**：M1 是否也修"AI 只打 console"？—倾向同意，否则评估无米下锅。
4. **是否同步引入 OCR 对照**：`TODO任务代办.txt` 计划过 OCR vs 纯 AI。评估可作为 OCR 对比的基线（但属另一工单，先不混入）。
5. **限流单实例是否已是问题**：取决于部署形态，需确认是否集群部署。