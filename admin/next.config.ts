import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@grow/shared'],
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
};

export default nextConfig;
