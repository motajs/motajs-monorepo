import { defineConfig } from 'vitest/config';

const workerStub = '\0motajs-monaco-worker-stub';

export default defineConfig({
  plugins: [
    {
      name: 'mock-monaco-workers',
      enforce: 'pre',
      resolveId(id) {
        return id.endsWith('.worker?worker') ? workerStub : undefined;
      },
      load(id) {
        if (id === workerStub) return 'export default class WorkerStub {}';
      },
    },
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
