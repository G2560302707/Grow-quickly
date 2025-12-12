import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/__tests__/setup.ts'],
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx'],
        exclude: ['node_modules', '.next', 'dist'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/lib/**/*.ts', 'src/app/api/**/*.ts'],
            exclude: ['src/__tests__/**', 'node_modules/**'],
        },
    },
})
