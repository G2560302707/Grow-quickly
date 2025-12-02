# WSL 局域网访问配置指南

## 问题说明
WSL 的 IP 地址（172.30.x.x）是虚拟网络 IP，局域网内其他设备无法直接访问。需要通过 Windows 宿主机的 IP 访问。

## 解决方案

### 方法一：使用端口转发（推荐）

#### 1. 获取 Windows 宿主机的真实 IP
在 **Windows PowerShell**（管理员权限）中运行：
```powershell
ipconfig
```
找到 "无线局域网适配器 WLAN" 或 "以太网适配器" 的 IPv4 地址，例如：`192.168.1.100`

#### 2. 配置端口转发
在 **Windows PowerShell（管理员权限）** 中运行：
```powershell
# 添加端口转发规则
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=172.30.108.211

# 查看转发规则
netsh interface portproxy show all

# 允许防火墙端口（如果需要）
New-NetFirewallRule -DisplayName "WSL Dev Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

#### 3. 访问测试
- **本机访问：** `http://localhost:3000`
- **局域网访问：** `http://192.168.1.100:3000` （使用您的 Windows IP）

#### 4. 删除转发规则（如果不需要了）
```powershell
netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0
```

---

### 方法二：使用 WSL 镜像网络模式（Windows 11 22H2+）

#### 1. 创建或编辑 `.wslconfig`
在 Windows 用户目录（`C:\Users\YourUsername\`）创建 `.wslconfig` 文件：
```ini
[wsl2]
networkingMode=mirrored
dnsTunneling=true
firewall=true
autoProxy=true
```

#### 2. 重启 WSL
在 **Windows PowerShell** 中运行：
```powershell
wsl --shutdown
```
然后重新启动 WSL

#### 3. 验证
镜像模式下，WSL 和 Windows 共享网络接口，可以直接使用 Windows IP 访问

---

### 方法三：临时端口转发（快速测试）

在 **Windows PowerShell（管理员权限）** 中运行：
```powershell
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=$(wsl hostname -I | cut -d' ' -f1)
```

---

## 故障排查

### 1. 检查 Windows 防火墙
- 打开 "Windows Defender 防火墙"
- 点击 "高级设置"
- 检查入站规则中是否有端口 3000 的规则
- 或者临时关闭防火墙测试

### 2. 检查端口占用
在 Windows PowerShell 中：
```powershell
Get-NetTCPConnection -LocalPort 3000
```

### 3. 检查 WSL IP 是否变化
WSL IP 可能在重启后改变，需要重新配置端口转发：
```bash
# 在 WSL 中查看 IP
hostname -I
```

### 4. 使用 Windows 的 localhost 转发
Windows 访问 `localhost:3000` 会自动转发到 WSL，但局域网设备需要使用 Windows IP

---

## 推荐配置

**最简单的方法：**
1. 在 Windows PowerShell（管理员）运行端口转发命令
2. 获取 Windows IP 地址
3. 在其他设备上使用 `http://Windows-IP:3000` 访问

**一劳永逸的方法：**
- 如果您使用 Windows 11，启用镜像网络模式
- 如果是 Windows 10，创建启动脚本自动配置端口转发
