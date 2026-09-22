#!/usr/bin/env node
/**
 * 编辑器产物资源完整性自检脚本（G-01）。
 *
 * 用法：node scripts/verify/editorArtifactAssets.js
 *
 * 断言的是「构建产物」而不是源码或配置文本：移除硬别名 '@'（plan 01 / D-05）后，Vite 的 CSS
 * url() 解析不再经过 resolvePlugin，`src/css/editor.css` 里的 `url('@/assets/FiraCode.ttf')`
 * 被原样写进产物——运行期 404，同时 289,624 字节的字体从 dist 里静默消失，没有任何门禁变红。
 * 本脚本让这一类「静默丢资源」出声：
 *   (a) 任何 `dist/assets/` 下发出的 `*.css` 里出现 `url(@/` 即失败（回归特征，递归扫描）；
 *   (b) Vite 产出的每个 `*.css` bundle 里，每个 `url(...)`（跳过 data: URI）去掉 #fragment 与
 *       ?query 后必须解析到产物里真实存在的文件——断言「引用了但没打包」这个通用类别；
 *   (c) 至少存在一个 `FiraCode*.ttf`——本缺陷具体丢掉的那个资源。
 *
 * (b) 的作用域是 Vite 直接写在 `dist/assets/` 下的 CSS bundle：只有它们经过 Vite 的 CSS url()
 * 管线，才可能出现「别名/相对路径不再被解析」这一缺陷。`dist/assets/theme/` 下的主题样式表由
 * `editor-artifact-plugin.ts` 用 `fs.cp` 原样拷贝（运行期经 `new URL('assets/theme/…', baseURI)`
 * 取用，不经过 Vite 处理），其中 `editor_color_dark.css` 引用 `../blockly/media/sprites_white.png`
 * 是一条**先于本阶段存在**的失效引用（blockly 12 已不再提供 `sprites_white.png`）；它不属于本
 * 缺陷类别，单独记录在 `.planning/phases/02-package-boundary-build-scaffolding/deferred-items.md`。
 *
 * 前置是产物已生成（CI 中位于 `pnpm build` 之后）。不访问网络、不构建，只读 dist。
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ==================== 常量 ====================

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const DIST_DIR = path.join(REPO_ROOT, 'packages', 'apps', 'editor', 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');

/** (a) 回归特征：无法解析的 `@/` 别名被原样写进 CSS。 */
const UNRESOLVED_ALIAS = /url\(\s*['"]?@\//;

/** 提取所有 `url(...)`（引号可有可无）。 */
const URL_PATTERN = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

/** (b) 需要跳过的内联数据 URI。 */
const DATA_URI = /^data:/i;

/** (c) 具体被丢掉的资源。 */
const FONT_BASENAME = /^FiraCode.*\.ttf$/i;

// ==================== 断言工具 ====================

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function relative(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, '/');
}

// ==================== 文件收集 ====================

/** Vite 直接产出的 CSS bundle：`dist/assets/` 下的直接子文件（Vite 的 assetsDir 是扁平的）。 */
function listEmittedCss(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.css'))
    .map((entry) => path.join(dir, entry.name));
}

/** 递归收集目录下所有 .css 文件（用于回归特征 与 字体，不受 (b) 的作用域限制）。 */
function collectAllCss(dir) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectAllCss(absolute));
    } else if (entry.name.toLowerCase().endsWith('.css')) {
      found.push(absolute);
    }
  }
  return found;
}

/** 递归收集 dist 下文件名匹配谓词的文件。 */
function collectFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectFiles(absolute, predicate));
    } else if (predicate(entry.name)) {
      found.push(absolute);
    }
  }
  return found;
}

// ==================== (a) 未解析的 url(@/ ====================

function checkNoUnresolvedAlias(cssFiles) {
  for (const cssFile of cssFiles) {
    const text = fs.readFileSync(cssFile, 'utf8');
    check(
      !UNRESOLVED_ALIAS.test(text),
      `${relative(cssFile)} 含未解析的 url(@/ —— '@' 别名已移除，CSS url() 必须写成相对路径`,
    );
  }
}

// ==================== (b) 每个 url() 目标都要能解析 ====================

function checkUrlTargetsResolve(cssFiles) {
  let checked = 0;
  let skippedData = 0;
  for (const cssFile of cssFiles) {
    const text = fs.readFileSync(cssFile, 'utf8');
    const baseDir = path.dirname(cssFile);
    URL_PATTERN.lastIndex = 0;
    let match;
    while ((match = URL_PATTERN.exec(text)) !== null) {
      const raw = match[2].trim();
      if (raw === '') continue;
      if (DATA_URI.test(raw)) {
        skippedData += 1;
        continue;
      }
      // 去掉 #fragment 与 ?query 后再判定目标文件是否存在（接受前导 `./`）。
      const target = raw.split('#')[0].split('?')[0].trim();
      if (target === '') continue;
      checked += 1;
      const resolved = path.resolve(baseDir, target);
      check(
        fs.existsSync(resolved) && fs.statSync(resolved).isFile(),
        `${relative(cssFile)} 引用的 ${raw} 未解析到产物里的文件（${relative(resolved)} 不存在）`,
      );
    }
  }
  console.log(`editorArtifactAssets: 校验 ${checked} 个 url() 目标、跳过 ${skippedData} 个 data: URI`);
}

// ==================== (c) FiraCode 字体必须真的产出 ====================

function checkFontEmitted() {
  const fonts = collectFiles(DIST_DIR, (name) => FONT_BASENAME.test(name));
  check(fonts.length > 0, `dist 下没有任何 FiraCode*.ttf —— 这正是移除 '@' 别名后静默丢掉的字体资源`);
  if (fonts.length > 0) {
    const bytes = fonts.reduce((total, file) => total + fs.statSync(file).size, 0);
    console.log(
      `editorArtifactAssets: FiraCode 字体已产出 ${fonts.length} 个（共 ${bytes} 字节）：${fonts.map(relative).join('、')}`,
    );
  }
}

// ==================== 入口 ====================

function main() {
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error(
      `editorArtifactAssets: 找不到 ${relative(ASSETS_DIR)} —— 请先运行 pnpm --filter @motajs/editor build`,
    );
    process.exit(1);
  }

  const emittedCss = listEmittedCss(ASSETS_DIR);
  const allCss = collectAllCss(ASSETS_DIR);
  check(emittedCss.length > 0, `${relative(ASSETS_DIR)} 下没有任何 Vite 产出的 .css bundle —— 构建产物缺失或为空`);

  checkNoUnresolvedAlias(allCss);
  checkUrlTargetsResolve(emittedCss);
  checkFontEmitted();

  if (failures.length > 0) {
    for (const failure of failures) console.error(`editorArtifactAssets: ${failure}`);
    process.exit(1);
  }
  console.log(
    `editorArtifactAssets: 全部断言通过（${allCss.length} 个产物样式表无 url(@/、${emittedCss.length} 个 Vite bundle 的 url() 目标均可解析、FiraCode 字体已产出）`,
  );
}

main();
