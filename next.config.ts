import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  experimental: {
    // 大型图标/图表库按需引入，减小客户端 bundle
    optimizePackageImports: ['recharts', 'lucide-react'],
  },
};

export default nextConfig;
