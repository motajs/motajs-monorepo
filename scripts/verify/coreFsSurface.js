#!/usr/bin/env node
/**
 * 「core 确实驱动注入的文件系统」门禁的两极性证明（CORE-01 修订 / D-06 / D-16）。
 *
 * 用法：node scripts/verify/coreFsSurface.js
 *
 * 本门禁的语义在本阶段被**反转**：旧语义要求「通用 fs 接口 `IEditorFileSystem` 只允许出现在它的
 * 声明文件 `fs/types.ts`，其余任何文件出现即违规」；新语义要求「core 的资源驱动文件**确实引用**
 * 它」——core 的资源层是注入文件系统的唯一调用方（D-06）。
 *
 * 断言的是「门禁真的会响」，而不是「此刻恰好有引用」：
 *   (a) 真实树（正极性）—— `packages/libs/editor-core/src` 下全部 `*.ts`/`*.tsx`（含测试树）里，
 *       `IEditorFileSystem` 必须出现在**驱动文件集合**中（至少核心驱动注入 fs 的
 *       `resource/resourceSystem.ts`）。扫描文件数不低于非空转下界——扫描范围被静默削弱会立刻变红。
 *   (b) 可失败（两极性）—— 合成 fixture A（`implements IEditorFileSystem`）必须被同一条「逐文件
 *       逐行」扫描**命中**；合成 fixture B（只含近似名 `IEditorFileSystemLike`、无该标识符本身）
 *       **不得**被计入。两个 fixture 证明扫描能区分「有 / 无」，避免恒真空转；均在 `finally` 删除
 *       并断言已删。
 *   (c) 包根可导入（正极性）—— 临时写一个用普通 import 从包根 `./index` 引入 `IEditorFileSystem`
 *       并作类型使用的探针，`pnpm --filter @motajs/editor-core exec tsc -p tsconfig.json` 必须退出 0，
 *       证明接口仍经包根对外暴露、可被宿主统一 `implements`。
 *   (d) 包根可导入（负极性）—— 把探针改为从包根 `./index` 引入一个不存在的名字，同一条 tsc 必须
 *       非零退出并报告错误，且错误指向探针文件，证明该 typecheck 真的在检查这个探针而非空转通过。
 *
 * 关于 (d) 的错误码：从**已解析**的模块 `./index` 引入不存在的**成员**时，TypeScript 报的是
 * TS2305（`Module "./index" has no exported member ...`），而不是 TS2307——TS2307 是「找不到模块」，
 * `./index` 存在故不适用。门禁因此断言 TS2305。
 *
 * 探针都由本脚本创建与删除，**绝不入库**。只读源码、不访问网络、不导入任何 workspace 包；
 * 仅调用仓库自带的 tsc。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ==================== 常量 ====================

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

/** 扫描范围根（core 的资源层 / D-06）：editor-core 的 src 全量，包含测试树。 */
const CORE_DIR = 'packages/libs/editor-core/src';
const CORE_DIR_ABS = path.join(REPO_ROOT, CORE_DIR);

/** 被门禁锁定的通用 fs 接口标识符（CORE-01 修订）。 */
const TARGET_IDENTIFIER = 'IEditorFileSystem';

/**
 * 驱动文件集合：core 里真正驱动注入文件系统的资源层文件，每一个都必须引用该标识符。
 * 至少包含核心驱动注入 fs 的 `resource/resourceSystem.ts`（读写 / 增删移都落到注入 fs）。
 */
const DRIVER_FILES = [`${CORE_DIR}/resource/resourceSystem.ts`, `${CORE_DIR}/resource/fileIndex.ts`];

/** 匹配标识符的词边界模式（`IEditorFileSystemLike` 式近似名不会误命中）。 */
const REFERENCE_PATTERN = new RegExp(`\\b${TARGET_IDENTIFIER}\\b`);

/** 扫描扩展名（与 coreImportType.js / coreEngineNeutral.js 一致）。 */
const SOURCE_EXTENSION = /\.tsx?$/;

/**
 * 真实树非空转底线：editor-core 全量源码文件数的保守下界。它**高于**「排除测试树」的文件数，
 * 因此一旦扫描范围被削弱（glob 写错、排除规则被放大、只扫生产源码），扫描数会塌到下界以下并立刻变红。
 */
const MIN_EXPECTED_SOURCES = 30;

/** (b) 两极性 fixture A（必须被命中）的路径与源码（脚本创建、脚本删除，绝不入库）。 */
const SURFACE_FIXTURE_PATH = `${CORE_DIR}/__fsSurfaceProbe__.ts`;
const SURFACE_FIXTURE_ABS = path.join(REPO_ROOT, SURFACE_FIXTURE_PATH);
const SURFACE_FIXTURE_LINES = [
  '/**',
  ' * 合成违规 fixture A：一个 class 实现核心 fs 接口，必须被同一条断言逐行命中',
  ' * （coreFsSurface.js 创建与删除，绝不入库）。',
  ' */',
  'export class FsSurfaceProbe implements IEditorFileSystem {',
  '  readFile(path: string): Promise<string> {',
  '    return Promise.resolve(path);',
  '  }',
  '',
  '  writeFile(path: string, data: string): Promise<void> {',
  '    return Promise.resolve();',
  '  }',
  '',
  '  listDirectory(path: string): Promise<readonly string[]> {',
  '    return Promise.resolve([]);',
  '  }',
  '',
  '  makeDirectory(path: string): Promise<void> {',
  '    return Promise.resolve();',
  '  }',
  '',
  '  moveFile(source: string, destination: string): Promise<void> {',
  '    return Promise.resolve();',
  '  }',
  '',
  '  deleteFile(path: string): Promise<void> {',
  '    return Promise.resolve();',
  '  }',
  '}',
];
const SURFACE_FIXTURE_MARKERS = { implements: 'implements IEditorFileSystem' };
/** fixture A 里必须被命中的行数（标识符只出现一次：`implements` 那一行）。 */
const SURFACE_FIXTURE_EXPECTED_HITS = 1;

/** (b) 两极性 fixture B（不得被计入）的路径与源码：只含近似名，不含标识符本身。 */
const CLEAN_FIXTURE_PATH = `${CORE_DIR}/__fsSurfaceCleanProbe__.ts`;
const CLEAN_FIXTURE_ABS = path.join(REPO_ROOT, CLEAN_FIXTURE_PATH);
const CLEAN_FIXTURE_LINES = [
  '/**',
  ' * 合成 clean fixture B：只含近似名 `IEditorFileSystemLike`，不含标识符本身，不得被计入',
  ' * （coreFsSurface.js 创建与删除，绝不入库）。',
  ' */',
  'export class FsSurfaceCleanProbe implements IEditorFileSystemLike {',
  '  probe(): string {',
  "    return 'clean';",
  '  }',
  '}',
];
const CLEAN_FIXTURE_MARKERS = { implements: 'implements IEditorFileSystemLike' };

/** (c)/(d) 包根导入探针的路径（脚本创建、脚本删除，绝不入库）。 */
const IMPORT_PROBE_PATH = `${CORE_DIR}/__fsImportProbe__.ts`;
const IMPORT_PROBE_ABS = path.join(REPO_ROOT, IMPORT_PROBE_PATH);

/** (c) 正极性探针：普通 import（**禁** `import type`，与 coreImportType.js 门禁一致）从包根引入并作类型使用。 */
const IMPORT_PROBE_POSITIVE = [
  "import { IEditorFileSystem } from './index';",
  '',
  'export const probe: IEditorFileSystem | null = null;',
  '',
].join('\n');

/** (d) 负极性探针：从包根引入一个不存在的名字，tsc 必须报 TS2305（模块存在、成员不存在）。 */
const IMPORT_PROBE_NEGATIVE = [
  "import { IDefinitelyMissingFs } from './index';",
  '',
  'export const probe: IDefinitelyMissingFs | null = null;',
  '',
].join('\n');

/** (d) 负极性必须命中的错误码与探针文件标识。 */
const NEGATIVE_EXPECTED_CODE = 'TS2305';
const NEGATIVE_PROBE_FILE_TOKEN = '__fsImportProbe__';

// ==================== 断言工具 ====================

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function relative(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, '/');
}

function summarize(output) {
  return (output ?? '').trim().replace(/\s+/g, ' ').slice(-300);
}

/** 用行数组构造 fixture 源码，并以唯一子串反查行号——不写死行号，注释增删也不会静默错位。 */
function buildFixture(lines, markers) {
  const lineOf = {};
  for (const [key, needle] of Object.entries(markers)) {
    const index = lines.findIndex((line) => line.includes(needle));
    lineOf[key] = index === -1 ? -1 : index + 1;
  }
  return { source: `${lines.join('\n')}\n`, lineOf };
}

function formatReferences(references) {
  if (references.length === 0) return '（无）';
  return references.map((reference) => `${reference.relPath}:${reference.line}`).join(' | ');
}

// ==================== 扫描 ====================

/** 递归收集目录下全部 .ts/.tsx 源文件（含 `__tests__` 与 `*.test.*`，CORE-01 覆盖全包含测试）。 */
function collectSources(dir) {
  const results = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (SOURCE_EXTENSION.test(entry.name))
        results.push({ relPath: relative(full), source: fs.readFileSync(full, 'utf8') });
    }
  };
  walk(dir);
  results.sort((left, right) => left.relPath.localeCompare(right.relPath));
  return results;
}

/** 收集 core src 全部源码（保持确定性排序）。 */
function collectAllSources() {
  return collectSources(CORE_DIR_ABS);
}

/** 逐文件逐行匹配标识符，返回按 `relPath → line` 稳定排序的命中列表。 */
function findReferences(sources) {
  const references = [];
  for (const file of sources) {
    const lines = file.source.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (REFERENCE_PATTERN.test(lines[index])) {
        references.push({ relPath: file.relPath, line: index + 1 });
      }
    }
  }
  references.sort((left, right) => left.relPath.localeCompare(right.relPath) || left.line - right.line);
  return references;
}

// ==================== (a) 真实树 ====================

let scannedFileCount = 0;

function checkRealTree() {
  const sources = collectAllSources();
  scannedFileCount = sources.length;
  check(sources.length > 0, `没有扫描到任何 ${CORE_DIR}/**/*.{ts,tsx} —— 门禁无从生效`);
  check(
    sources.length >= MIN_EXPECTED_SOURCES,
    `真实树只扫描到 ${sources.length} 个源码文件，低于非空转下界 ${MIN_EXPECTED_SOURCES} —— 扫描范围可能被削弱`,
  );

  const references = findReferences(sources);
  const hitsByFile = new Map();
  for (const reference of references) {
    hitsByFile.set(reference.relPath, (hitsByFile.get(reference.relPath) ?? 0) + 1);
  }
  for (const driverFile of DRIVER_FILES) {
    const hits = hitsByFile.get(driverFile) ?? 0;
    check(
      hits > 0,
      `真实树驱动文件未引用 ${TARGET_IDENTIFIER}：${driverFile} —— ` + `core 的资源层必须驱动注入的文件系统（D-06）`,
    );
  }
  console.log(
    `coreFsSurface: 真实树通过（已扫描 ${scannedFileCount} 个源码文件 ≥ 非空转下界 ${MIN_EXPECTED_SOURCES}，` +
      `驱动文件均引用 ${TARGET_IDENTIFIER}：` +
      DRIVER_FILES.map((file) => `${file}×${hitsByFile.get(file) ?? 0}`).join('、') +
      '）',
  );
}

// ==================== (b) 两极性 ====================

function checkTwoPolarity() {
  const fixture = buildFixture(SURFACE_FIXTURE_LINES, SURFACE_FIXTURE_MARKERS);
  const clean = buildFixture(CLEAN_FIXTURE_LINES, CLEAN_FIXTURE_MARKERS);
  fs.writeFileSync(SURFACE_FIXTURE_ABS, fixture.source, 'utf8');
  fs.writeFileSync(CLEAN_FIXTURE_ABS, clean.source, 'utf8');
  let references = [];
  try {
    references = findReferences(collectAllSources());
  } finally {
    fs.rmSync(SURFACE_FIXTURE_ABS, { force: true });
    fs.rmSync(CLEAN_FIXTURE_ABS, { force: true });
  }

  const fixtureReferences = references.filter((reference) => reference.relPath === SURFACE_FIXTURE_PATH);
  const line = fixture.lineOf.implements;
  if (line <= 0) {
    check(false, '`implements` 定位标记在 fixture A 里找不到 —— 断言无法定位');
  } else {
    const onLine = fixtureReferences.filter((reference) => reference.line === line);
    check(
      onLine.length === 1,
      `两极性失败：合成 fixture A 的 class 实现（第 ${line} 行）未被逐行命中：${formatReferences(fixtureReferences)}`,
    );
  }
  check(
    fixtureReferences.length === SURFACE_FIXTURE_EXPECTED_HITS,
    `两极性失败：fixture A 应恰好产生 ${SURFACE_FIXTURE_EXPECTED_HITS} 处 ${TARGET_IDENTIFIER}，` +
      `实际 ${fixtureReferences.length} 处：${formatReferences(fixtureReferences)}`,
  );

  const cleanReferences = references.filter((reference) => reference.relPath === CLEAN_FIXTURE_PATH);
  check(
    cleanReferences.length === 0,
    `两极性失败：不含 ${TARGET_IDENTIFIER}（只含近似名 ` +
      `\`IEditorFileSystemLike\`）的 fixture B 被误计入：${formatReferences(cleanReferences)}`,
  );

  check(!fs.existsSync(SURFACE_FIXTURE_ABS), `两极性 fixture A 未被删除：${SURFACE_FIXTURE_PATH}`);
  check(!fs.existsSync(CLEAN_FIXTURE_ABS), `两极性 fixture B 未被删除：${CLEAN_FIXTURE_PATH}`);
  console.log(
    `coreFsSurface: 两极性成立（含 \`implements ${TARGET_IDENTIFIER}\` 的 fixture A 被逐行命中、` +
      '只含近似名 `IEditorFileSystemLike` 的 fixture B 未被计入，且两个 fixture 均已删除）',
  );
}

// ==================== (c)/(d) 包根导入探针 ====================

/** 运行 core 自己的 tsc（与 coreBoundaries.js 的 PKG-03 调用一致）。 */
function runCoreTypecheck() {
  const result = spawnSync('pnpm', ['--filter', '@motajs/editor-core', 'exec', 'tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  if (result.error) return { error: `无法运行 core 的 tsc -p：${result.error.message}` };
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/** 写入探针、跑 tsc、`finally` 删除并断言已删；返回 tsc 的退出码与输出。 */
function runImportProbe(source) {
  fs.writeFileSync(IMPORT_PROBE_ABS, source, 'utf8');
  let result = { error: '未运行' };
  try {
    result = runCoreTypecheck();
  } finally {
    fs.rmSync(IMPORT_PROBE_ABS, { force: true });
  }
  check(!fs.existsSync(IMPORT_PROBE_ABS), `包根导入探针未被删除：${IMPORT_PROBE_PATH}`);
  return result;
}

function checkRootImportProbe() {
  const positive = runImportProbe(IMPORT_PROBE_POSITIVE);
  if (positive.error) {
    check(false, `包根导入正极性探针未运行：${positive.error}`);
  } else {
    check(
      positive.status === 0,
      `包根导入正极性探针 typecheck 未通过（退出码 ${positive.status}）—— ` +
        `${TARGET_IDENTIFIER} 未能经包根（./index）导入作类型使用：${summarize(positive.output)}`,
    );
  }

  const negative = runImportProbe(IMPORT_PROBE_NEGATIVE);
  if (negative.error) {
    check(false, `包根导入负极性探针未运行：${negative.error}`);
  } else {
    check(
      negative.status !== 0,
      `包根导入负极性探针未让 tsc 非零退出（退出码 ${negative.status}）—— 该 typecheck 没有检查这个探针`,
    );
    check(
      negative.output.includes(NEGATIVE_EXPECTED_CODE),
      `包根导入负极性探针未产生 ${NEGATIVE_EXPECTED_CODE}：${summarize(negative.output)}`,
    );
    check(
      negative.output.includes(NEGATIVE_PROBE_FILE_TOKEN),
      `包根导入负极性探针的错误没有指向探针文件：${summarize(negative.output)}`,
    );
  }
  console.log(
    `coreFsSurface: 包根导入两极性成立（正极性探针经 ./index 引入 ${TARGET_IDENTIFIER} 后 tsc 退出 0；` +
      `负极性探针引入不存在的名字后 tsc 报 ${NEGATIVE_EXPECTED_CODE} 且指向探针，两者均已删除）`,
  );
}

// ==================== 入口 ====================

function main() {
  if (!fs.existsSync(CORE_DIR_ABS)) {
    console.error(`coreFsSurface: 找不到 ${CORE_DIR} —— 无法验证门禁`);
    process.exit(1);
  }

  checkRealTree();
  checkTwoPolarity();
  checkRootImportProbe();

  if (failures.length > 0) {
    for (const failure of failures) console.error(`coreFsSurface: ${failure}`);
    process.exit(1);
  }
  console.log(
    `coreFsSurface: 全部断言通过（真实树扫描 ${scannedFileCount} 个源码文件、驱动文件均引用 ${TARGET_IDENTIFIER}；` +
      '两极性 fixture A 被逐行命中、fixture B 未被计入并均已删除；' +
      '包根导入正极性 tsc 退出 0、负极性报 TS2305 且指向探针）',
  );
}

main();
