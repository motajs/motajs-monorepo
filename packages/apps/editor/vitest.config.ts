import react from '@vitejs/plugin-react';
import path from 'path';
import { configDefaults, defineConfig } from 'vitest/config';
import { resolvePlugin } from '@motajs/config/resolvePlugin';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    // 与 vite.config.ts 保持一致（Pitfall 2）：硬别名 '@' 会劫持被链接包内的 `@/`，
    // 因此改由 importer 相对的 resolvePlugin 解析。
    resolvePlugin,
  ],
  resolve: {
    alias: {
      '@test': path.resolve(import.meta.dirname, 'test'),
      '@styled-system': path.resolve(import.meta.dirname, 'styled-system'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: [...configDefaults.exclude, 'e2e/**'],
    setupFiles: ['./test/setup.ts'],
  },
});
