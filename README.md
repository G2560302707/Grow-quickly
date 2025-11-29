# Smart Wrong Notebook (智能错题本)

一个基于 AI 的智能错题管理系统，帮助学生高效整理、分析和复习错题。

## ✨ 主要功能

- **🤖 AI 智能分析**：自动识别题目内容，生成解析、知识点标签和同类练习题。
- **⚙️ 灵活的 AI 配置**：支持 **Google Gemini** 和 **OpenAI** (及兼容接口) 两种 AI 提供商，可直接在网页设置中动态切换和配置。
- **📚 多错题本管理**：支持按科目（如数学、物理、英语）创建和管理多个错题本。
- **🏷️ 智能标签系统**：自动提取知识点标签，支持自定义标签管理。
- **📝 智能练习**：基于错题生成相似的练习题，巩固薄弱环节。
- **📊 数据统计**：可视化展示错题掌握情况和学习进度。
- **🔐 用户管理**：支持多用户注册、登录，数据安全隔离。

## 🛠️ 技术栈

- **框架**: [Next.js 14](https://nextjs.org/) (App Router)
- **数据库**: [SQLite](https://www.sqlite.org/) (via [Prisma](https://www.prisma.io/))
- **样式**: [Tailwind CSS](https://tailwindcss.com/) + [Shadcn UI](https://ui.shadcn.com/)
- **AI**: Google Gemini API / OpenAI API
- **认证**: [NextAuth.js](https://next-auth.js.org/)

## 🚀 快速开始

### 1. 环境准备

确保已安装 Node.js (v18+) 和 npm。

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并填入必要的配置：

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your_secret_key"
NEXTAUTH_URL="http://localhost:3000"

# 默认 AI 配置 (可选，会被 app-config.json 覆盖)
AI_PROVIDER="gemini" # 或 "openai"
GOOGLE_API_KEY="your_gemini_api_key"
OPENAI_API_KEY="your_openai_api_key"
```

### 4. 初始化数据库

```bash
npx prisma migrate dev
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 开始使用。

## ⚙️ AI 模型配置

本项目支持动态配置 AI 模型，无需重启服务器。

1.  **进入设置**：点击首页右上角的设置图标。
2.  **选择提供商**：支持 Google Gemini 和 OpenAI (或兼容 API，如智谱 GLM-4)。
3.  **填写参数**：
    *   **API Key**: 您的 API 密钥（支持显示/隐藏查看）。
    *   **Base URL**: (可选) 自定义 API 地址，用于代理或兼容模型。
    *   **Model Name**: 指定使用的模型名称 (如 `gemini-1.5-flash`, `gpt-4o`)。
4.  **保存生效**：点击保存后即刻生效。

> **注意**：网页配置会保存到项目根目录的 `app-config.json` 文件中，该文件的优先级高于 `.env` 环境变量。

## 🔑 密码重置指南

如果您忘记了登录密码，可以通过以下步骤重置：

### 方法一：使用内置脚本（推荐）

我们在项目根目录提供了一个重置脚本 `reset-password.js`。

1.  打开终端，进入项目根目录。
2.  运行以下命令（替换 `<邮箱>` 和 `<新密码>`）：

    ```bash
    node reset-password.js <您的注册邮箱> <新密码>
    ```

    **示例：**
    ```bash
    node reset-password.js user@example.com 123456
    ```

3.  脚本运行成功后，您可以使用新密码登录。

### 方法二：数据库直接修改

如果您熟悉数据库操作，也可以直接修改 SQLite 数据库：

1.  打开 `prisma/dev.db`。
2.  找到 `User` 表。
3.  更新对应用户的 `password` 字段（注意：密码必须是 bcrypt 哈希值，不能是明文）。

## 📄 许可证

MIT License
