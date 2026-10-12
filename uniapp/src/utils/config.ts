/**
 * 全局配置
 * H5 走 vite 代理（同源 /api），小程序端需配置为线上 HTTPS 域名
 * （微信小程序要求 request 合法域名，且运行时会自动维护该域名下的 Cookie）
 */
let baseUrl = "";

// #ifndef H5
// 生产环境 HTTPS（需在微信公众平台配置 request 合法域名）
// 开发者工具调试：详情 → 本地设置 → 勾选「不校验合法域名…」
//
// 本地联调公式渲染（后端未上线生产时）：
//   在开发者工具「Console」执行以下命令即可临时指向本地后端，无需改代码/重编译：
//     uni.setStorageSync("base_url_override", "http://127.0.0.1:3210")   // 模拟器
//     uni.setStorageSync("base_url_override", "http://<局域网IP>:3210")  // 真机
//   联调结束删掉该值即恢复生产：
//     uni.removeStorageSync("base_url_override")
baseUrl =
    (uni.getStorageSync && uni.getStorageSync("base_url_override")) || "https://after7lab.cloud";
// #endif

export const BASE_URL = baseUrl;
