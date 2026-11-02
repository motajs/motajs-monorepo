import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    maxWorkers: '50%',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
});
