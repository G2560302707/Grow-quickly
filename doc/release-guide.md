# 版本发布指南

本文档说明如何发布新版本 Docker 镜像。

## 版本标签策略

项目使用语义化版本（Semantic Versioning），格式：`v主版本.次版本.补丁版本`

| 版本类型 | 示例 | 说明 |
|---------|------|------|
| 主版本 | v2.0.0 | 不兼容的 API 变更 |
| 次版本 | v1.1.0 | 新增功能，向下兼容 |
| 补丁版本 | v1.0.1 | Bug 修复 |

## 发布操作流程

### 1. 确保代码已提交

```bash
git status
git add .
git commit -m "feat: 新功能描述"
git push origin main
```

### 2. 创建版本标签

```bash
# 创建标签（从 v1.0.0 开始）
git tag v1.0.0

# 或指定提交创建标签
git tag v1.0.0 <commit-sha>
```

### 3. 推送标签触发构建

```bash
git push origin v1.0.0
```

### 4. 查看构建状态

访问 GitHub 仓库的 **Actions** 页面查看构建进度。

## 自动生成的镜像标签

推送 `v1.0.0` 标签后，CI 自动生成以下镜像标签：

| 标签 | 说明 |
|------|------|
| `1.0.0` | 精确版本号 |
| `1.0` | 次版本号（自动更新到最新 1.0.x） |
| `1` | 主版本号（自动更新到最新 1.x.x） |
| `latest` | 最新版本 |
| `sha-xxxxxxx` | Git commit 短哈希 |

## 用户部署方式

```yaml
# docker-compose.yml
services:
  wrong-notebook:
    # 推荐：锁定精确版本
    image: ghcr.io/wttwins/wrong-notebook:1.0.0
    
    # 或：自动获取补丁更新
    image: ghcr.io/wttwins/wrong-notebook:1.0
    
    # 不推荐：始终最新（生产环境慎用）
    image: ghcr.io/wttwins/wrong-notebook:latest
```

## 常用命令

```bash
# 查看所有标签
git tag -l

# 删除本地标签
git tag -d v1.0.0

# 删除远程标签
git push origin --delete v1.0.0

# 查看标签对应的提交
git show v1.0.0
```
