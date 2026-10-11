import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: 'standalone',
  // 挂在主域 /admin 路径下（Nginx 按 /admin 前缀反代到本容器）
  basePath: '/admin',
  // 给前端 apiClient 用：fetch('/api/...') 需自动变成 '/admin/api/...'
  env: {
    NEXT_PUBLIC_BASE_PATH: '/admin',
  },
  // monorepo 下 standalone 输出锚定仓库根，Docker CMD 用 node admin/server.js 启动
  outputFileTracingRoot: path.join(__dirname, '../'),
  transpilePackages: ['@grow/shared'],
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
};

export default nextConfig;
