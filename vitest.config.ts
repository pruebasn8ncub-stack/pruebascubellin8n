import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            // Stub out Next.js server-only guard so server modules can be
            // imported in Vitest without throwing at test runtime.
            'server-only': path.resolve(__dirname, 'src/tests/__mocks__/server-only.ts'),
        },
    },
})
