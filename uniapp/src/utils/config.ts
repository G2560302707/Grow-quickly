/**
 * 全局配置
 * H5 走 vite 代理（同源 /api），小程序端需配置为线上 HTTPS 域名
 * （微信小程序要求 request 合法域名，且运行时会自动维护该域名下的 Cookie）
 */
let baseUrl = "";

// #ifndef H5
// TODO: 上线小程序前替换为生产环境 HTTPS 域名（需 ICP 备案并在微信后台配置 request 合法域名）
baseUrl = "http://localhost:3000";
// #endif

export const BASE_URL = baseUrl;
