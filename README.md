# Smart Wrong Notebook (智能错题本)

一个基于 AI 的智能错题管理系统，帮助学生高效整理、分析和复习错题。

## ✨ 主要功能

- **🤖 AI 智能分析**：自动识别题目内容，生成解析、知识点标签和同类练习题。
- **⚙️ 灵活的 AI 配置**：支持 **Google Gemini** 和 **OpenAI** (及兼容接口) 两种 AI 提供商，可直接在网页设置中动态切换和配置。
- **📚 多错题本管理**：支持按科目（如数学、物理、英语）创建和管理多个错题本。
- **🏷️ 智能标签系统**：自动提取知识点标签，支持自定义标签管理。
- **🔍 多维度筛选**：支持按掌握状态、时间范围、知识点标签、年级学期、试卷等级等多种条件筛选错题。
- **🖨️ 灵活导出打印**：一键导出筛选后的错题，支持自定义打印内容（答案/解析/知识点）和图片缩放比例，可直接打印或保存为 PDF。
- **📝 智能练习**：基于错题生成相似的练习题，巩固薄弱环节。
- **📊 数据统计**：可视化展示错题掌握情况和学习进度。
- **🔐 用户管理**：支持多用户注册、登录，数据安全隔离。
- **🛡️ 管理员后台**：提供用户管理功能，可禁用/启用用户、删除违规用户。


## 📸 屏幕截图功能 (HTTPS 设置)

本应用的屏幕截图功能依赖浏览器的安全上下文 (HTTPS)。在 Docker 或局域网环境中使用时，请参考 **[部署文档 → HTTPS 部署](doc/部署文档.md#8-https-部署内置无需额外反代)** 启用内置 HTTPS 支持。

## 📚 项目文档

| 文档 | 内容 |
| :--- | :--- |
| [部署文档](doc/部署文档.md) | Docker Compose / 本地构建 / HTTPS 部署、数据备份、升级与排查 |
| [技术文档](doc/技术文档.md) | 架构、技术栈、AI 调用链路、鉴权与数据模型 |
| [功能文档](doc/功能文档.md) | 三端功能清单与使用入口 |
| [目录结构](doc/目录结构.md) | 仓库目录逐项说明 |
| [管理后台拆分方案](doc/管理后台拆分方案.md) | 学习端/管理端拆分设计与接口归属 |
| [薄弱点诊断算法说明](doc/薄弱点诊断算法说明.md) | 薄弱点诊断与定向出题算法 |
| [题库方案](doc/题库方案.md) | 题库收录/分类/检索出题设计与分期实施 |

## 📱 PWA 支持 (添加到主屏幕)

本项目支持 PWA (Progressive Web App)，您可以将应用添加到手机主屏幕，获得原生应用般的使用体验。

**功能特性**：
- 🚀 **快速启动**：点击主屏幕图标直接打开，无需输入网址。
- 📱 **沉浸体验**：全屏运行，无浏览器地址栏干扰。
- 🎨 **原色适配**：应用图标和启动画面适配系统主题。

**使用方法**：

- **iPhone / iPad (Safari)**: 点击底部 **分享** 按钮 -> 选择 **"添加到主屏幕"**。
- **Android (Chrome)**: 点击右上角 **菜单** -> 选择 **"添加到主屏幕"** 或 **"安装应用"**。

## 🛠️ 技术栈

- **框架**: [Next.js 16](https://nextjs.org/) (App Router)
- **UI 库**: [React 19](https://react.dev/)
- **数据库**: [SQLite](https://www.sqlite.org/) (via [Prisma](https://www.prisma.io/))
- **样式**: [Tailwind CSS v4](https://tailwindcss.com/) + [Shadcn UI](https://ui.shadcn.com/)
- **AI**: Google Gemini API / OpenAI API / Azure OpenAI
- **认证**: [NextAuth.js](https://next-auth.js.org/)

## 🚀 快速开始

### 方式一：使用 Docker 部署（推荐）

本仓库没有发布预构建镜像，首次部署使用本地构建（Compose 会同时构建学习端与管理端两个镜像）：

1.  **克隆仓库**（见方式二第 1 步），在仓库根目录执行：

2.  **修改 `NEXTAUTH_SECRET`**：编辑 `docker-compose.yml`，把两个服务的 `NEXTAUTH_SECRET` 改为 `openssl rand -base64 32` 生成的随机值（两个服务保持一致）。

3.  **启动服务**（本地构建学习端 + 管理端）：
    ```bash
    docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
    ```
4.  **查看日志**：
    ```bash
    docker compose logs -f
    ```
5.  **停止服务**：
    ```bash
    docker compose down
    ```

> 首次启动会自动完成数据库迁移、种子与管理员账号初始化；AI 供应商在管理端（`:3001`）首次配置。完整说明（HTTPS、备份、升级、排查）见 [部署文档](doc/部署文档.md)。

### 方式二：本地源码运行

#### 1. 克隆仓库

```bash
git clone https://github.com/G2560302707/Grow-quickly.git
cd Grow-quickly
```

#### 2. 环境准备

确保已安装 Node.js (v18+) 和 npm。

#### 3. 安装依赖

```bash
npm install
```

#### 4. 配置环境变量

复制 `.env.example` 为 `.env` 并填入必要的配置：

```bash
cp .env.example .env
```

**基础配置**

| 环境变量 | 描述 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | 数据库连接地址 | `file:./dev.db` | SQLite 数据库路径 |
| `NEXTAUTH_SECRET` | Auth 密钥 | 无 | 用于加密 Session，生产环境建议设置,可以使用 openssl rand -base64 32 生成一个随机字符串作为密钥 |
| `NEXTAUTH_URL` | 访问地址 | `http://your-domain-name:3000` | 部署后的访问地址 |
| `AUTH_TRUST_HOST` | 信任主机头 | `true` | 设置为 `true` 时自动推断 URL，适合 Docker/PaaS |
| `LOG_LEVEL` | 日志级别 | `debug` (开发) / `info` (生产) | 可选值：`trace`, `debug`, `info`, `warn`, `error`, `fatal` |
| `HTTP_PROXY` | HTTP 代理 | 无 | 设置 HTTP 代理 |
| `HTTPS_PROXY` | HTTPS 代理 | 无 | 设置 HTTPS 代理 |

**AI 配置**

| 环境变量 | 描述 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `AI_PROVIDER` | AI 提供商 | `openai` | 可选 `gemini`、`openai` 或 `azure`；默认 `openai`（对接 DeepSeek 兼容接口） |

**DeepSeek 配置（默认）**

| 环境变量 | 描述 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | 无 | 使用 DeepSeek 时必填，从 [DeepSeek Platform](https://platform.deepseek.com) 获取 |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址 | `https://api.deepseek.com` | 可选 |
| `DEEPSEEK_MODEL` | DeepSeek 模型 | `deepseek-chat` | 可选，如 `deepseek-reasoner` 等 |

**Gemini 配置**

| 环境变量 | 描述 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `GOOGLE_API_KEY` | Gemini API Key | 无 | 使用 Gemini 时必填，从 [Google AI Studio](https://aistudio.google.com/apikey) 获取 |
| `GEMINI_BASE_URL` | Gemini API 地址 | 无 | 可选，默认 `https://generativelanguage.googleapis.com`，通常无需修改 |
| `GEMINI_MODEL` | Gemini 模型 | `gemini-2.5-flash` | 可选，如 `gemini-2.5-pro`、`gemini-3.0-flash` 等 |

**OpenAI 兼容配置（DeepSeek 未配置时兜底）**

| 环境变量 | 描述 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `OPENAI_API_KEY` | OpenAI API Key | 无 | 使用 OpenAI 时必填，从 [OpenAI Platform](https://platform.openai.com/api-keys) 获取 |
| `OPENAI_BASE_URL` | OpenAI API 地址 | 无 | 可选，默认 `https://api.openai.com/v1`；使用第三方兼容服务时填写对应地址 |
| `OPENAI_MODEL` | OpenAI 模型 | `gpt-4o` | 可选，如 `gpt-4-turbo`、`o3`、`o4-mini` 等 |

**Azure OpenAI 配置**

| 环境变量 | 描述 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `AZURE_OPENAI_API_KEY` | Azure API Key | 无 | 使用 Azure OpenAI 时必填，从 Azure 门户获取 |
| `AZURE_OPENAI_ENDPOINT` | Azure Endpoint | 无 | Azure 资源端点，如 `https://xxx.openai.azure.com` |
| `AZURE_OPENAI_DEPLOYMENT` | 部署名称 | 无 | Azure 中配置的部署名称，如 `gpt-4o` |
| `AZURE_OPENAI_API_VERSION` | API 版本 | `2024-02-15-preview` | 可选，Azure API 版本 |
| `AZURE_OPENAI_MODEL` | Azure 模型 | `gpt-4o` | 可选，显示用的模型名称 |

#### 5. 初始化数据库

```bash
npx prisma migrate dev
npx prisma db seed
```

#### 6. 管理员账户

默认管理员账户：
- **邮箱**: `admin@localhost`
- **密码**: `123456`

#### 7. 启动开发服务器

```bash
npm run dev              # 学习端 http://localhost:3000
npm run dev -w @grow/admin   # 管理后台 http://localhost:3001
```

（一键启动：双击 `启动测试.bat`，会同时拉起学习端与管理端两个窗口。）

访问 [http://your-domain-name:3000](http://your-domain-name:3000) 开始使用。

## 🖥️ 管理后台（独立应用）

管理功能与学习功能已拆分：**学习端（根目录）与 uniapp 只负责学习**，用户、公告、反馈、系统配置等管理功能全部在独立的管理后台应用 `admin/`（端口 3001）。

| 功能 | 入口（管理后台） |
| :--- | :--- |
| 仪表盘（全站统计/趋势） | `/` |
| 用户管理（启用/禁用/删除、注册开关） | `/users` |
| 公告管理（发布/下架/删除） | `/announcements` |
| 反馈处理 | `/feedback` |
| 系统设置（AI 供应商 / Prompts / 邮件通知） | `/settings` |
| 系统工具（标签迁移、系统重置、Prompt 调试） | `/tools` |

- 管理后台使用**独立登录**：复用同一套用户数据，但仅 `admin` 角色可登录；会话 cookie 与学习端互相隔离。
- 两端共享同一个 SQLite 数据库与 `config/app-config.json` 配置文件（学习端只读，管理端读写）。
- 共享代码（Prisma、配置、AI 库、邮件等）在 `shared/`（`@grow/shared` 包）。
- Docker 部署：`docker-compose.yml` 已包含 `wrong-notebook-admin` 服务（本地构建，端口 3001）；生产环境建议只在内网/VPN 或加 IP 白名单暴露管理端。
- 详细拆分方案见 [doc/管理后台拆分方案.md](doc/管理后台拆分方案.md)。

## ⚙️ AI 模型配置

本项目支持动态配置 AI 模型，无需重启服务器。**AI 配置入口已迁移至管理后台 `/settings`**（学习端设置弹窗不再包含 AI 配置）。

1.  **进入管理后台**：`http://your-domain-name:3001`，使用管理员账号登录。
2.  **选择提供商**：支持 Google Gemini、OpenAI 和 **Azure OpenAI**。
3.  **填写参数**：
    *   **通用参数**: API Key、Base URL（或 Endpoint）、Model Name（或 Deployment Name）。
    *   **Azure 特有**: Deployment Name（部署名称）、API Version（API 版本）。
4.  **保存生效**：点击保存后即刻生效。

> **注意**：网页配置会保存到 `config/app-config.json` 文件中，该文件的优先级高于 `.env` 环境变量。

### 配置样例

选择提供商后，填写对应参数即可。各服务商获取方式如下：

#### Google Gemini

| 参数 | 获取方式 |
| :--- | :--- |
| API Key | [Google AI Studio](https://aistudio.google.com/apikey) → 创建 API Key |
| Base URL | 默认 `https://generativelanguage.googleapis.com`，通常无需修改 |
| 模型 | `gemini-2.5-flash`（推荐）、`gemini-2.5-pro`、`gemini-3.0-flash` 等 |

#### OpenAI

| 参数 | 获取方式 |
| :--- | :--- |
| API Key | [OpenAI Platform](https://platform.openai.com/api-keys) → Create new secret key |
| Base URL | 默认 `https://api.openai.com/v1` |
| 模型 | `gpt-4o`（推荐）、`gpt-4-turbo`、`o3`、`o4-mini` 等 |

> **兼容模式**：OpenAI 提供商兼容所有支持 OpenAI API 格式的第三方服务。只需将 Base URL 改为对应服务地址，即可使用硅基流动、智谱 GLM、月之暗面 Kimi、通义千问 DashScope 等平台的模型。模型名称需填写对应平台的完整模型 ID。

#### Azure OpenAI

| 参数 | 获取方式 |
| :--- | :--- |
| API Key | Azure 门户 → 你的 OpenAI 资源 → 密钥和终结点 |
| Endpoint | Azure 门户 → 你的 OpenAI 资源 → 终结点，如 `https://xxx.openai.azure.com` |
| 部署名称 | Azure 中配置的模型部署名称，如 `gpt-4o` |
| API 版本 | 默认 `2024-02-15-preview` |
| 模型 | 显示用的模型名称，如 `gpt-4o` |

## 🛠️ 实用脚本

在 `scripts/` 目录下提供了一些实用脚本，用于维护和调试：

- **重置密码**:
  ```bash
  node scripts/reset-password.js <邮箱> <新密码>
  ```
  示例:  
  ```bash
  node scripts/reset-password.js user@example.com 123456 
  ```

## 📄 许可证

MIT License
