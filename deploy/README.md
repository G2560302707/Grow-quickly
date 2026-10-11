# 生产部署手册（后端 + 管理后台 + Web端 H5，tar 交付版）

> 环境：Docker 已装好、域名已备案（`after7lab.cloud`）、80 不可用、走纯 443。
> 不依赖镜像仓库，镜像在本机 build 后导出 `.tar` 上传。

## 架构

| 入口 | 内容 | 后端脚本 |
|---|---|---|
| `https://after7lab.cloud` | 学习端（页面 + /api 同源） | Nginx → 容器 :3100 |
| `https://after7lab.cloud/admin` | 管理后台（basePath=/admin） | Nginx → 容器 :3200 |

Nginx 一台服务器承载三种流量；两个容器 + 一份静态站，一个域名族全搞定。

---

## 一、本机产出三个交付物（已生成）

| 产物 | 命令 | 生成文件 |
|---|---|---|
| 后端镜像 | `docker build -t wrong-notebook:local .` + `docker save` | `wrong-notebook.tar` |
| 管理后台镜像 | `docker build -f admin/Dockerfile -t wrong-notebook-admin:local .` + `docker save` | `wrong-notebook-admin.tar` |
| Web端 H5 | `cd uniapp && npm run build:h5` + `tar` | `web-h5.tar.gz` |

本机当前状态：✅ 后端 / ✅ Web端 已生成；管理后台镜像修复后重建中。

## 二、上传到服务器并加载

```bash
# 三个文件一起传：wrong-notebook.tar、wrong-notebook-admin.tar、web-h5.tar.gz
scp wrong-notebook.tar wrong-notebook-admin.tar web-h5.tar.gz root@服务器IP:/opt/app/
ssh root@服务器IP
cd /opt/app

docker load -i wrong-notebook.tar         # 后端
docker load -i wrong-notebook-admin.tar   # 管理后台
mkdir -p web && tar -xzf web-h5.tar.gz -C web   # Web端静态站 → /opt/app/web
docker images   # 确认两个镜像
```

## 三、放 deploy 配置、填密钥、起容器

```bash
# 将仓库 deploy/ 目录（docker-compose.yml + nginx/after7lab.conf + .env.prod）放到 /opt/app/deploy
cp deploy/.env.prod deploy/.env
vim deploy/.env        # 改 NEXTAUTH_SECRET / WECHAT_APP_SECRET / GOOGLE_API_KEY
docker compose -f deploy/docker-compose.yml up -d
docker compose -f deploy/docker-compose.yml ps    # 两个容器 running
```
> `up` 不带 `--build` 用已加载镜像；entrypoint 首次启动自动 migrate + 建管理员 + 补标签，SQLite 落 `deploy/data/dev.db`。

## 四、Nginx + 证书 + 443

```bash
sudo cp deploy/nginx/after7lab.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/after7lab.conf /etc/nginx/sites-enabled/
# 证书：申请覆盖 after7lab.cloud 主域的证书（单域名证书即可，只有一个 server 块），改 conf 里 ssl_certificate 路径
sudo nginx -t && sudo systemctl reload nginx
```
安全组/防火墙**放行 443/TCP**；DNS 加一条 A 记录：`@` → 服务器 IP。

## 五、验证

```bash
curl -k https://after7lab.cloud/api/register/status   # 后端 JSON，应 200
curl -k https://after7lab.cloud/                      # Web端 index.html
curl -k https://after7lab.cloud/admin/login               # 管理后台登录页
```
管理后台登录：初始管理员账号由 entrypoint 自动创建，默认凭据见后端启动日志或文档，**登录后立即改密码、配置 AI**。

## 六、小程序端（另一步，配置对齐即可）

微信公众平台：
- request 合法域名：`https://after7lab.cloud`（appid `wx571724ac4670bcd7`）
- AppSecret 与 `deploy/.env` 的 `WECHAT_APP_SECRET` 一致
- `uniapp/src/utils/config.ts:14` 改为 `https://after7lab.cloud` 后重新 build 小程序上传

## 备份
```bash
cp /opt/app/deploy/data/dev.db /backup/dev-$(date +%F).db   # 每日 cron
```