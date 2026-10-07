/**
 * 全局配置
 * H5 走 vite 代理（同源 /api），小程序端需配置为线上 HTTPS 域名
 * （微信小程序要求 request 合法域名，且运行时会自动维护该域名下的 Cookie）
 */
let baseUrl = "";

// #ifndef H5
// TODO: 上线小程序前替换为生产环境 HTTPS 域名（需 ICP 备案并在微信后台配置 request 合法域名）
// 开发者工具模拟器：用 127.0.0.1（与后端同机；localhost 可能被解析为 IPv6 ::1 导致 request:fail）
// 真机调试：127.0.0.1/localhost 指手机自己，必须改成电脑的局域网 IP（ipconfig 查看，
// 手机与电脑需在同一 Wi-Fi；连不上时检查 Windows 防火墙是否放行 Node/3000 端口入站）
// 当前为真机调试地址（电脑 WLAN IP，IP 变化后需同步更新）
baseUrl = "http://192.168.2.7:3000";
// #endif

export const BASE_URL = baseUrl;
