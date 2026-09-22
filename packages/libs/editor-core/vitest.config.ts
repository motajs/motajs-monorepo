import react from '@vitejs/plugin-react';
import { resolvePlugin } from '@motajs/config/resolvePlugin';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    resolvePlugin,
  ],
  resolve: {
    alias: {
      '@styled-system': path.resolve(import.meta.dirname, '../../apps/editor/styled-system'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['lib/**/*.test.{ts,tsx}'],
  },
});
