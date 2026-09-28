#!/usr/bin/env node
/**
 * editor-core 包边界自检脚本（PKG-01 + D-15）。
 *
 * 用法：node scripts/verify/coreExports.js
 *
 * 断言 `packages/libs/editor-core/package.json` 的结构事实：
 *   1. PKG-01 结构：private/type/sideEffects 取值、**恰好一个** exports subpath`.``、
 *      该目标在磁盘上真实存在、且在 subpathStatus.json 的 v2 记录里登记；scripts 恰好是
 *      typecheck + test，没有 build。Phase 4 起 `.` 汇总了资源层与编辑层；Phase 05.1-03 拆分后
 *      默认实现整体迁出，`. ` 只汇总内核 + 端口 + 撤销契约类型（`kernel+ports+undo-exports`）；
 *   2. **单向依赖**：editor-core 的任一 section（dependencies/peerDependencies/devDependencies）
 *      都不得出现 `@motajs/editor-impl`——底层绝不依赖默认实现（D-01）。
 *
 * peer 声明与单副本断言已随默认实现迁到 `scripts/verify/implExports.js`。
 * subpathStatus.json 的读法：只读 `packages['@motajs/editor-core'].subpaths`，不跨读 editor-impl 的条目，
 * 也不从 JSON 反读期望值（期望值写死在本脚本里，避免自我指涉）。
 *
 * 不访问网络、不导入任何 workspace 包；只用 Node 的文件系统读取清单。
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ==================== 常量 ====================

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const CORE_DIR = path.join(REPO_ROOT, 'packages/libs/editor-core');
const CORE_MANIFEST_PATH = path.join(CORE_DIR, 'package.json');
const SUBPATH_STATUS_PATH = path.join(
  REPO_ROOT,
  '.planning',
  'phases',
  '02-package-boundary-build-scaffolding',
  'subpathStatus.json',
);

/** PKG-01：editor-core 只剩 `.` 一个 subpath。 */
const EXPECTED_SUBPATHS = ['.'];

/**
 * 每个 subpath 的 `content` 期望值表（N-26）。期望值写死在这里，绝不从 subpathStatus.json 反读。
 */
const SUBPATH_CONTENT = {
  '.': 'kernel+ports+undo-exports',
};
const DEFAULT_SUBPATH_CONTENT = 'empty-barrel';

/** PKG-01 允许的两个脚本：没有 build（noEmit 纯源码库，D-08）。 */
const EXPECTED_SCRIPTS = { typecheck: 'tsc -b', test: 'vitest run' };

/** 反方向声明：editor-core 的任何 section 都不得出现它。 */
const FORBIDDEN_DEPENDENCY = '@motajs/editor-impl';
const MANIFEST_SECTIONS = ['dependencies', 'peerDependencies', 'devDependencies'];

// ==================== 断言工具 ====================

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function relative(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, '/');
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    failures.push(`找不到 ${relative(filePath)}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    failures.push(`无法解析 ${relative(filePath)}：${error.message}`);
    return null;
  }
}

function sortedEqual(actual, expected) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function describeSetDiff(actual, expected) {
  const missing = expected.filter((item) => !actual.includes(item));
  const extra = actual.filter((item) => !expected.includes(item));
  return [missing.length > 0 ? `缺少 ${missing.join('、')}` : '', extra.length > 0 ? `多出 ${extra.join('、')}` : '']
    .filter(Boolean)
    .join('；');
}

// ==================== 断言：PKG-01 结构 ====================

function checkStructure(manifest, status) {
  check(manifest.private === true, `package.json 的 private 应为 true，实际是 ${JSON.stringify(manifest.private)}`);
  check(manifest.type === 'module', `package.json 的 type 应为 "module"，实际是 ${JSON.stringify(manifest.type)}`);
  check(
    manifest.sideEffects === false,
    `package.json 的 sideEffects 应为 false，实际是 ${JSON.stringify(manifest.sideEffects)}`,
  );

  const exportsMap = manifest.exports || {};
  const exportKeys = Object.keys(exportsMap);
  if (!sortedEqual(exportKeys, EXPECTED_SUBPATHS)) {
    failures.push(
      `exports 的 subpath 应为 [${EXPECTED_SUBPATHS.join('、')}]，实际是 [${exportKeys.join('、')}]（${describeSetDiff(exportKeys, EXPECTED_SUBPATHS)}）`,
    );
  }
  for (const subpath of EXPECTED_SUBPATHS) {
    const target = exportsMap[subpath];
    if (typeof target !== 'string') {
      failures.push(`exports["${subpath}"] 未声明目标`);
      continue;
    }
    const absolute = path.join(CORE_DIR, target);
    if (!fs.existsSync(absolute)) {
      failures.push(`exports["${subpath}"] 指向的目标在磁盘上不存在：${target}`);
      continue;
    }
    check(fs.statSync(absolute).isFile(), `exports["${subpath}"] 的目标不是文件：${target}`);
  }

  const scripts = manifest.scripts || {};
  const scriptsMatch =
    sortedEqual(Object.keys(scripts), Object.keys(EXPECTED_SCRIPTS)) &&
    Object.entries(EXPECTED_SCRIPTS).every(([name, value]) => scripts[name] === value);
  check(scriptsMatch, `scripts 应恰好是 {typecheck: "tsc -b", test: "vitest run"}，实际是 ${JSON.stringify(scripts)}`);
  check(
    !Object.prototype.hasOwnProperty.call(scripts, 'build'),
    'scripts 不得声明 build —— core 是 noEmit 纯源码库（D-08）',
  );

  if (status === null) return;

  const packageRecord = status.packages?.['@motajs/editor-core'];
  if (!packageRecord) {
    failures.push("subpathStatus.json 缺少 packages['@motajs/editor-core'] 条目");
    return;
  }
  const statusSubpaths = packageRecord.subpaths || {};
  const statusKeys = Object.keys(statusSubpaths);
  if (!sortedEqual(statusKeys, EXPECTED_SUBPATHS)) {
    failures.push(
      `subpathStatus.json 的 editor-core subpaths 应为 [${EXPECTED_SUBPATHS.join('、')}]，实际是 [${statusKeys.join('、')}]（${describeSetDiff(statusKeys, EXPECTED_SUBPATHS)}）`,
    );
  }
  for (const subpath of EXPECTED_SUBPATHS) {
    const entry = statusSubpaths[subpath];
    if (!entry) continue;
    check(
      entry.target === exportsMap[subpath],
      `subpathStatus.json 的 "${subpath}" target 是 ${JSON.stringify(entry.target)}，与 exports 的 ${JSON.stringify(exportsMap[subpath])} 不一致`,
    );
    check(
      entry.carriesProbe === false,
      `subpathStatus.json 的 "${subpath}" carriesProbe 应为 false，实际是 ${JSON.stringify(entry.carriesProbe)}`,
    );
    const expectedContent = SUBPATH_CONTENT[subpath] ?? DEFAULT_SUBPATH_CONTENT;
    check(
      entry.content === expectedContent,
      `subpathStatus.json 的 "${subpath}" content 应为 "${expectedContent}"，实际是 ${JSON.stringify(entry.content)}`,
    );
  }
}

// ==================== 断言：反方向声明 ====================

function checkNoReverseDependency(manifest) {
  for (const section of MANIFEST_SECTIONS) {
    const block = manifest[section] ?? {};
    check(
      !Object.prototype.hasOwnProperty.call(block, FORBIDDEN_DEPENDENCY),
      `editor-core 的 ${section} 声明了 ${FORBIDDEN_DEPENDENCY} —— 底层绝不依赖默认实现（D-01）`,
    );
  }
}

// ==================== 入口 ====================

function main() {
  const manifest = readJson(CORE_MANIFEST_PATH);
  const status = readJson(SUBPATH_STATUS_PATH);
  if (manifest) {
    checkStructure(manifest, status);
    checkNoReverseDependency(manifest);
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`coreExports: ${failure}`);
    process.exit(1);
  }
  console.log('coreExports: 全部断言通过（`.` 单 subpath、kernel+ports+undo-exports、无 editor-impl 依赖声明）');
}

main();
