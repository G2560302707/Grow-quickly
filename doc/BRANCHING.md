# 分支管控说明（BRANCHING）

> 目标：项目清楚可控、部署清晰。本文件说明当前分支模型、为什么这样做，以及日常操作规范。

## 当前分支拓扑

```
main                          稳定发布线（随时可部署）
└─ feature/uniapp-frontend    小程序线（uniapp + 其依赖的共享后端）※ 当前最新
└─ feature/frontend-upgrade   网页端线（web 升级，86cdadd）
develop                       集成线（两条 feature 线在此汇合后进入 main）
```

## 为什么不按"后端 / PC 前端 / 小程序"拆三个长期分支

- **网页前端和后端是同一个 Next.js 应用**：`src/app` 同时承载页面和 API 路由，共享
  `prisma / auth / ai / lib`。它们在 Git 里无法物理拆分——分支是整个仓库的快照，
  拆出来的"后端分支"和"网页分支"会包含彼此的全部代码。
- 改一个共享接口（例如 `/api/announcements` 同时服务网页铃铛和小程序首页）需要同时改
  两条分支，合并时必然冲突，管控成本反而更高。
- **小程序（uniapp/）是物理独立目录**，天然适合单独一条线——这正是
  `feature/uniapp-frontend` 存在的原因。

结论：**按"端"拆线保留（网页端线 + 小程序线），共享后端跟随各自的线走，最终在
develop 汇合；"后端"用提交前缀表达，而不是长期分支。**

## 日常工作流

1. 从 `develop` 拉功能分支，命名体现归属：
   - `feature/uniapp-*`（如 `feature/uniapp-register`）
   - `feature/web-*`（如 `feature/web-error-edit`）
   - `feature/api-*`（如 `feature/api-review-scheduler`）
   - `fix/web-*` / `fix/uniapp-*` / `fix/api-*`
2. 完成后合回 `develop`；`develop` 验证稳定后合入 `main` 发版。
3. 提交信息使用模块前缀，历史一眼可辨归属：
   - `feat(api): ...` / `fix(api): ...` —— 后端接口、Prisma、lib
   - `feat(web): ...` / `fix(web): ...` —— 网页端（src/app 页面、components）
   - `feat(uniapp): ...` / `fix(uniapp): ...` —— 小程序（uniapp/）
   - `chore: ...` / `docs: ...`

## 部署对应关系

| 产物 | 构建来源 | 说明 |
|------|----------|------|
| Next.js（网页 + API） | `main`（或指定 tag）根目录 `npm run build` + Docker | 网页与后端一体部署（`Dockerfile` / docker-compose） |
| 微信小程序 | `main`（或 develop 验证版）`uniapp/` 目录 `npm run build:mp-weixin` | 微信开发者工具上传审核，发布节奏与网页独立 |
| 数据库 | 部署前执行 `npx prisma migrate deploy` | 迁移以 main 上的历史为准 |

## 待办：两条 feature 线的汇合

`feature/frontend-upgrade`（网页端升级）与本线（uniapp + 全部新功能）在
`src/app/page.tsx`、`settings-dialog.tsx` 等文件上有真实分叉，合并不是快进：

1. 在 `develop` 上执行 `git merge feature/frontend-upgrade`
2. 逐个解决冲突：以功能更全的一侧为基准，把另一侧的增量（深色模式、骨架屏等）
   手工并入——两边的改进都要保留
3. 合并后全量验证：`npm run type-check`（根 + uniapp）、`npm run test:unit`、
   双端构建、关键页面人工走查
4. `develop` 稳定后合入 `main` 发版

## 其它约定

- 本地验证产物不入库：`uniapp/.ui-shots/`、`prisma/dev.db.backup-*`（已在 .gitignore）
- 数据库备份文件（dev.db.backup-*）仅存在于本地，作为迁移前保险
- `.zcode/` 为本地工具工作区，不入库

## 变体：两条端线作为长期开发线（当前采用）

也可以不删 feature 线，把它们当作**长期的端线**持续开发（当前项目的选择）：

- `feature/frontend-upgrade` = 网页端开发线
- `feature/uniapp-frontend` = 小程序开发线

日常直接在这两条线上开发（或从它们拉短期分支），定期：

1. `git switch feature/xxx && git merge develop` —— 先同步另一条线的成果（都是快进，无冲突）
2. 验证后 `git switch main && git merge develop` —— 发版

两条线偶尔会分叉，合回时以"两边功能都保留"为原则逐文件取舍（参考 2026-10 本次合并：
page.tsx 取改版外壳、settings-dialog 取功能全侧、stats 取懒加载+诊断卡共存）。
