import { defineConfig } from 'vitest/config'
import path from 'path'

// 管理端测试：仅 API 层（路由 handler 直调），node 环境足够
export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        setupFiles: ['./__tests__/setup.ts'],
        include: ['__tests__/**/*.test.ts'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@grow/shared': path.resolve(__dirname, '../shared/src'),
        },
    },
})
