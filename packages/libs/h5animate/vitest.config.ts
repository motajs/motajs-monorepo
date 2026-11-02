import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    maxWorkers: '50%',
    globals: true,
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
