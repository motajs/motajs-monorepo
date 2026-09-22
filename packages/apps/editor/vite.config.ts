import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';
import type { PluginOption } from 'vite';
import { resolvePlugin } from '@motajs/config/resolvePlugin';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import motaServerPlugin from './vite-plugin-mota-server';
import fs from 'node:fs/promises';
import { editorArtifactPlugin } from './editor-artifact-plugin';
import { MOTA_JS_ROOT } from './mota-root';

const packageInfo = JSON.parse(await fs.readFile(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

// https://vite.dev/config/
export default defineConfig({
  appType: 'mpa',
  base: './',
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    nodePolyfills({
      include: ['events'],
    }),
    motaServerPlugin({ motaRoot: MOTA_JS_ROOT }),
    editorArtifactPlugin(packageInfo.version),
    // 必须放在最后：`resolve.alias`（vite:alias，先于 enforce:'pre' 与 vite:resolve 求值）
    // 会劫持被链接包内的 `@/`，因此硬别名 '@' 已移除，改由 importer 相对的 resolvePlugin 解析。
    // 收窄类型：resolvePlugin 的 `Plugin` 类型来自 @motajs/config 侧解析到的另一份 vite 实例
    // （peer 后缀不同），与 editor 自身实例名义不兼容；运行时是同一插件对象。
    resolvePlugin as PluginOption,
  ],
  resolve: {
    alias: {
      '@test': path.resolve(__dirname, './test'),
      '@styled-system': path.resolve(__dirname, './styled-system'),
    },
  },
  publicDir: MOTA_JS_ROOT,
  server: {
    port: 1055,
    host: '127.0.0.1',
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        editor: path.resolve(__dirname, 'index.html'),
        runtime: path.resolve(__dirname, 'runtime.html'),
      },
    },
    copyPublicDir: false,
  },
});
