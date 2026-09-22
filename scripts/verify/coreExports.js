#!/usr/bin/env node
/**
 * editor-core 包边界自检脚本（PKG-01 + PKG-02 + D-15）。
 *
 * 用法：node scripts/verify/coreExports.js
 *
 * 断言的是三类「只在被人 import 时才炸」的事实，而不是重述清单文本：
 *   1. PKG-01 结构：`packages/libs/editor-core/package.json` 的 private/type/sideEffects 取值、
 *      恰好七个 exports subpath、每个 exports 目标在磁盘上真实存在、且都在 subpathStatus.json 里登记；
 *      scripts 恰好是 typecheck + test，没有 build——一个指向不存在文件的 exports 是长期潜伏的隐性 bug；
 *   2. PKG-02 声明：peerDependencies 恰好是 PKG-02 点名的九个名字且全部 catalog:default，
 *      @douyinfe/semi-ui 被标记为 optional，且每个 peer 在 pnpm-workspace.yaml 的 catalog 里都有真实条目
 *      （catalog:default 只在该 catalog 定义了该包时才解析得出来）；
 *   3. D-15 单副本：八个单例库分别从 editor 与 editor-core 两个真实消费方解析，必须得到唯一 realpath——
 *      lockfile 文本只说明「写了什么」，Node 解析出的 realpath 才说明「会加载哪一份」。
 *      @douyinfe/semi-ui 单独从 packages/apps/service-worker 解析并打印原因（D-18：editor 与 core 都没有它的代码路径）。
 *
 * 不访问网络、不导入任何 workspace 包；只用 Node 的解析器与文件系统读取清单。
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ==================== 常量 ====================

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const CORE_DIR = path.join(REPO_ROOT, 'packages/libs/editor-core');
const EDITOR_DIR = path.join(REPO_ROOT, 'packages/apps/editor');
const SERVICE_WORKER_DIR = path.join(REPO_ROOT, 'packages/apps/service-worker');
const CORE_MANIFEST_PATH = path.join(CORE_DIR, 'package.json');
const WORKSPACE_YAML_PATH = path.join(REPO_ROOT, 'pnpm-workspace.yaml');
const SUBPATH_STATUS_PATH = path.join(
  REPO_ROOT,
  '.planning',
  'phases',
  '02-package-boundary-build-scaffolding',
  'subpathStatus.json',
);

/** PKG-01 固定的七个 subpath。 */
const EXPECTED_SUBPATHS = ['.', './code', './table', './map', './asset', './shell', './react'];

/** PKG-02 点名的九个 peer（React/ReactDOM + 七个单例库）。 */
const EXPECTED_PEERS = [
  'react',
  'react-dom',
  'antd',
  '@douyinfe/semi-ui',
  'alien-signals',
  'immer',
  'monaco-editor',
  'pixi.js',
  'blockly',
];

/** 八个真正被 editor 与 core 同时消费的单例库（Semi 不在其列，见 D-18）。 */
const SINGLETONS = ['react', 'react-dom', 'antd', 'alien-signals', 'immer', 'monaco-editor', 'pixi.js', 'blockly'];

/** 唯一被标记为 optional 的 peer：没有任何 editor/core 代码路径解析它。 */
const OPTIONAL_PEER = '@douyinfe/semi-ui';

/** 携带探针的 subpath（Phase 2 脚手架，Phase 4+ 由真实 React 层替换）。 */
const PROBE_SUBPATH = './react';

/** PKG-01 允许的两个脚本：没有 build（noEmit 纯源码库，D-08）。 */
const EXPECTED_SCRIPTS = { typecheck: 'tsc -b', test: 'vitest run' };

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

// ==================== 断言：catalog 解析 ====================

/** 从 `catalog:` 头开始逐行读取两空格缩进的 `name: value`，遇到第一个非该形状的行即停。 */
function parseCatalogNames(content) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === 'catalog:');
  if (start === -1) return null;
  const names = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const match = /^\s{2}([^:#\s]+):\s*\S/.exec(lines[index]);
    if (!match) break;
    names.push(match[1].replace(/^'|'$/g, ''));
  }
  return names;
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
      `exports 的 subpath 应为七个 [${EXPECTED_SUBPATHS.join('、')}]，实际是 [${exportKeys.join('、')}]（${describeSetDiff(exportKeys, EXPECTED_SUBPATHS)}）`,
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

  const statusSubpaths = status.subpaths || {};
  const statusKeys = Object.keys(statusSubpaths);
  if (!sortedEqual(statusKeys, EXPECTED_SUBPATHS)) {
    failures.push(
      `subpathStatus.json 的 subpaths 应为七个 [${EXPECTED_SUBPATHS.join('、')}]，实际是 [${statusKeys.join('、')}]（${describeSetDiff(statusKeys, EXPECTED_SUBPATHS)}）`,
    );
  }
  for (const subpath of EXPECTED_SUBPATHS) {
    const entry = statusSubpaths[subpath];
    if (!entry) continue;
    check(
      entry.target === exportsMap[subpath],
      `subpathStatus.json 的 "${subpath}" target 是 ${JSON.stringify(entry.target)}，与 exports 的 ${JSON.stringify(exportsMap[subpath])} 不一致`,
    );
    const carriesProbe = subpath === PROBE_SUBPATH;
    check(
      entry.carriesProbe === carriesProbe,
      `subpathStatus.json 的 "${subpath}" carriesProbe 应为 ${carriesProbe}，实际是 ${JSON.stringify(entry.carriesProbe)}`,
    );
    const expectedContent = carriesProbe ? 'probe' : 'empty-barrel';
    check(
      entry.content === expectedContent,
      `subpathStatus.json 的 "${subpath}" content 应为 "${expectedContent}"，实际是 ${JSON.stringify(entry.content)}`,
    );
  }
}

// ==================== 断言：PKG-02 声明 ====================

function checkPeers(manifest) {
  const peers = Object.keys(manifest.peerDependencies || {});
  if (!sortedEqual(peers, EXPECTED_PEERS)) {
    failures.push(
      `peerDependencies 应为九个 [${EXPECTED_PEERS.join('、')}]，实际是 [${peers.join('、')}]（${describeSetDiff(peers, EXPECTED_PEERS)}）`,
    );
  }
  for (const name of EXPECTED_PEERS) {
    check(
      manifest.peerDependencies?.[name] === 'catalog:default',
      `peer ${name} 未写成 catalog:default，实际是 ${JSON.stringify(manifest.peerDependencies?.[name])}`,
    );
  }

  const meta = manifest.peerDependenciesMeta || {};
  check(
    sortedEqual(Object.keys(meta), [OPTIONAL_PEER]),
    `peerDependenciesMeta 应只含 ${OPTIONAL_PEER}，实际是 [${Object.keys(meta).join('、')}]`,
  );
  check(meta[OPTIONAL_PEER]?.optional === true, `${OPTIONAL_PEER} 未被标记为 optional: true（D-18）`);

  if (!fs.existsSync(WORKSPACE_YAML_PATH)) {
    failures.push('找不到 pnpm-workspace.yaml —— 无法校验 catalog');
    return;
  }
  const catalogNames = parseCatalogNames(fs.readFileSync(WORKSPACE_YAML_PATH, 'utf8'));
  if (catalogNames === null) {
    failures.push('pnpm-workspace.yaml 里没有可解析的 catalog: 块');
    return;
  }
  for (const name of EXPECTED_PEERS) {
    check(catalogNames.includes(name), `peer ${name} 声明为 catalog:default，但 catalog 里没有它的条目`);
  }
}

// ==================== 断言：D-15 单副本 ====================

/** 从一个消费方的 package.json 出发解析一个包名，返回 realpath 或具名错误。 */
function resolveFromConsumer(consumerDir, name) {
  try {
    const require = createRequire(path.resolve(consumerDir, 'package.json'));
    return { realpath: fs.realpathSync(require.resolve(name)) };
  } catch (error) {
    const code = error && error.code ? error.code : 'UNKNOWN';
    return { error: `${code}: ${error && error.message ? error.message : String(error)}` };
  }
}

function checkSingletons() {
  for (const name of SINGLETONS) {
    const consumers = [
      ['packages/apps/editor', resolveFromConsumer(EDITOR_DIR, name)],
      ['packages/libs/editor-core', resolveFromConsumer(CORE_DIR, name)],
    ];
    let unresolved = false;
    for (const [label, result] of consumers) {
      if (result.error) {
        unresolved = true;
        failures.push(`单例 ${name} 无法从 ${label} 解析（${result.error}）`);
      }
    }
    if (unresolved) continue;
    const resolved = new Set(consumers.map(([, result]) => result.realpath));
    check(
      resolved.size === 1,
      `单例 ${name} 从两个消费方解析出 ${resolved.size} 个 realpath（应恰好 1 个）：${[...resolved].map(relative).join(' / ')}`,
    );
  }
}

/**
 * Semi 只从它真实的消费方断言，且打印原因——绝不为了凑对称的检查把它加进 editor（D-18）。
 * 一个 MODULE_NOT_FOUND 必须报成具名失败，而不是被吞掉。
 */
function checkOptionalPeerConsumer() {
  const result = resolveFromConsumer(SERVICE_WORKER_DIR, OPTIONAL_PEER);
  const reason =
    `${OPTIONAL_PEER} 只从 packages/apps/service-worker 断言：editor 与 editor-core 都没有它的代码路径（D-18），` +
    `因此它在 core 里是 optional peer`;
  console.log(
    `coreExports: ${reason}${result.error ? `；但它在此处也无法解析（${result.error}）` : `；解析到 ${relative(result.realpath)}`}`,
  );
  if (result.error) {
    failures.push(`optional peer ${OPTIONAL_PEER} 无法从 packages/apps/service-worker 解析（${result.error}）`);
  }
}

// ==================== 入口 ====================

function main() {
  const manifest = readJson(CORE_MANIFEST_PATH);
  const status = readJson(SUBPATH_STATUS_PATH);
  if (manifest) {
    checkStructure(manifest, status);
    checkPeers(manifest);
  }
  checkSingletons();
  checkOptionalPeerConsumer();

  if (failures.length > 0) {
    for (const failure of failures) console.error(`coreExports: ${failure}`);
    process.exit(1);
  }
  console.log('coreExports: 全部断言通过（7 subpaths、9 peers、8 singletons 单副本）');
}

main();
