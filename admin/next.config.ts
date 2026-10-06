import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: 'standalone',
  // monorepo 下 standalone 输出锚定仓库根，Docker CMD 用 node admin/server.js 启动
  outputFileTracingRoot: path.join(__dirname, '../'),
  transpilePackages: ['@grow/shared'],
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
};

export default nextConfig;
