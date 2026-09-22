#!/usr/bin/env node
/**
 * PKG-05 验证脚本（N-08）。
 *
 * 用法：node scripts/verify/coreReactCompiler.js
 *
 * 断言的是「真实的 Vite 转换产物」：用编辑器生产同款的 `@vitejs/plugin-react` 配置起一个活的
 * Vite server，对 core 的探针 TSX 跑 `transformRequest`，要求产物同时含 `react/compiler-runtime`
 * 导入与 `_c(` memo-cache 调用。
 *
 * 不重新实现插件的 include/exclude 过滤——跑真实插件。探针必须调用 hook，否则编译器对它无可
 * 记忆化（实测：无 hook 的模块不产生任何标记）。转换不需要编辑器改配置：pnpm 软链解析到
 * `packages/libs/editor-core/...` 真实路径，落在插件默认 include 内、默认 exclude 之外。
 *
 * `server.close()` 可能让进程存活（实测），因此显式 `process.exit`。
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

// ==================== 常量 ====================

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const EDITOR_DIR = path.join(REPO_ROOT, 'packages', 'apps', 'editor');

/** 与编辑器构建同源：root 相对路径，便于 transformRequest 直接接受。 */
const PROBE_MODULE = '/packages/libs/editor-core/lib/react/CoreProbe.tsx';

/** React Compiler 的两个标记：运行时导入 + memo-cache 调用。 */
const RUNTIME_MARKER = /react\/compiler-runtime/;
const MEMO_CACHE_MARKER = /_c\(/;

// ==================== 断言工具 ====================

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

// ==================== 入口 ====================

async function main() {
  const require = createRequire(path.join(EDITOR_DIR, 'package.json'));
  let compilerPath;
  try {
    compilerPath = require.resolve('babel-plugin-react-compiler');
  } catch (error) {
    console.error(`coreReactCompiler: 无法解析 babel-plugin-react-compiler：${error.message}`);
    process.exit(1);
  }

  let server;
  try {
    server = await createServer({
      configFile: false,
      root: REPO_ROOT,
      logLevel: 'silent',
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true, watch: null, hmr: false },
      // 编辑器的生产配置：真实插件 + 编译器；@styled-system 与编辑器保留的别名一致。
      plugins: [react({ babel: { plugins: [[compilerPath]] } })],
      resolve: { alias: { '@styled-system': path.join(EDITOR_DIR, 'styled-system') } },
    });
  } catch (error) {
    console.error(`coreReactCompiler: 无法创建 Vite server：${error.message}`);
    process.exit(1);
  }

  try {
    const transformed = await server.transformRequest(PROBE_MODULE);
    if (!transformed) {
      check(false, `transformRequest(${PROBE_MODULE}) 未返回转换结果 —— 模块不在 Vite 的转换图里`);
    } else {
      const hasRuntime = RUNTIME_MARKER.test(transformed.code);
      const hasMemoCache = MEMO_CACHE_MARKER.test(transformed.code);
      console.log(`coreReactCompiler: react/compiler-runtime 标记：${hasRuntime ? '存在' : '缺失'}`);
      console.log(`coreReactCompiler: _c( memo-cache 调用：${hasMemoCache ? '存在' : '缺失'}`);
      check(hasRuntime, 'React Compiler 未转换 core TSX：产物缺少 react/compiler-runtime');
      check(hasMemoCache, 'React Compiler 产物缺少 _c( memo-cache 调用');
    }
  } catch (error) {
    check(false, `transformRequest(${PROBE_MODULE}) 抛错：${error.message}`);
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`coreReactCompiler: ${failure}`);
    process.exit(1);
  }
  console.log('coreReactCompiler: 全部断言通过（真实 Vite transformRequest 下 core TSX 被 React Compiler 转换）');
  process.exit(0);
}

main().catch((error) => {
  console.error(`coreReactCompiler: 未预期的失败：${error?.stack ?? error}`);
  process.exit(1);
});
