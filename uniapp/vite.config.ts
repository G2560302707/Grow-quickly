import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  server: {
    port: 5173,
    // H5 开发时把 API 代理到本机 Next.js 后端（本地后端默认 3000；联调渲染接口时改为 3210）
    proxy: {
      "/api": {
        // 学习端 Next.js 本地默认 3000（联调渲染服务时可改 3210）
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
