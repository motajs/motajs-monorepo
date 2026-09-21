import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { analyzer } from 'vite-bundle-analyzer';
import { resolvePlugin } from '@motajs/config/resolvePlugin';
import fs from 'node:fs/promises';

const packageInfo = JSON.parse(await fs.readFile(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

// https://vitejs.dev/config/
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  appType: 'mpa',
  plugins: [
    react(),
    svgr(),
    nodePolyfills({
      globals: {
        Buffer: true,
      },
    }),
    analyzer({
      analyzerMode: 'static',
      openAnalyzer: false,
    }),
    [
      {
        name: 'service-worker',
        configureServer(server) {
          server.middlewares.use(async (request, response, next) => {
            const pathname = new URL(request.url ?? '/', 'http://vite.local').pathname;
            if (pathname.startsWith('/assets/')) {
              const relative = pathname.slice(1);
              if (relative.includes('..')) return next();
              try {
                const source = await fs.readFile(path.resolve(import.meta.dirname, 'dist', relative));
                response.statusCode = 200;
                response.setHeader('content-type', relative.endsWith('.css') ? 'text/css' : 'application/javascript');
                response.setHeader('cache-control', 'no-cache');
                response.end(source);
                return;
              } catch {
                return next();
              }
            }
            if (pathname !== '/service-worker.js') return next();
            try {
              const source = await fs.readFile(path.resolve(import.meta.dirname, 'dist/service-worker.js'));
              response.statusCode = 200;
              response.setHeader('content-type', 'application/javascript; charset=utf-8');
              response.setHeader('cache-control', 'no-cache');
              response.setHeader('service-worker-allowed', '/');
              response.end(source);
            } catch (error) {
              next(error as Error);
            }
          });
        },
        load(id) {
          if (id === '/service-worker.js') {
            return `import ${JSON.stringify(path.resolve(import.meta.dirname, 'src/server/index.ts'))}`;
          }
        },
      },
      resolvePlugin,
    ],
  ],
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
  define: {
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(packageInfo.version),
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        serverWorker: path.resolve(import.meta.dirname, 'src/server/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'serverWorker') {
            return 'service-worker.js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
});
