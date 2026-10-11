/**
 * 全局配置
 * H5 走 vite 代理（同源 /api），小程序端需配置为线上 HTTPS 域名
 * （微信小程序要求 request 合法域名，且运行时会自动维护该域名下的 Cookie）
 */
let baseUrl = "";

// #ifndef H5
// 生产环境 HTTPS（需在微信公众平台配置 request 合法域名）
// 开发者工具调试：详情 → 本地设置 → 勾选「不校验合法域名…」
baseUrl = "https://after7lab.cloud";
// #endif

export const BASE_URL = baseUrl;
