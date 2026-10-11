#!/usr/bin/env node
/**
 * 「通用 fs 接口不外泄」门禁的两极性证明（CORE-01 / D-13）。
 *
 * 用法：node scripts/verify/coreFsSurface.js
 *
 * 断言的是「门禁真的会响」，而不是「此刻恰好没有实现」：
 *   (a) 真实树 —— `packages/libs/editor-core/src` 与 `packages/libs/editor-impl/src` 下的全部
 *       `*.ts`/`*.tsx`（含测试树）里，通用 fs 接口标识符 `IEditorFileSystem` 只允许出现在它的
 *       声明文件 `packages/libs/editor-core/src/fs/types.ts`；任何其它文件出现该标识符
 *       （`implements`、类型引用、调用等）都算违规。真实树命中必须为 0，且扫描文件数不低于
 *       非空转下界——范围被静默削弱（glob 写错、只扫一个包）会立刻变红。
 *   (b) 可失败 —— 临时往 editor-core 的 src 写一个 `class ... implements IEditorFileSystem`
 *       的 fixture：同一条「逐文件逐行」断言必须把它拦下；fixture 在 `finally` 里删除，随后断言
 *       其确实不存在。
 *
 * 探针都由本脚本创建与删除，**绝不入库**。只读文件系统、不访问网络、不导入任何 workspace 包。
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ==================== 常量 ====================

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

/** 扫描范围根（CORE-01 / D-13）：底层与默认实现两个包的 src 全量，包含测试树。 */
const CORE_LIBS = ['packages/libs/editor-core/src', 'packages/libs/editor-impl/src'];
const CORE_LIB_ABS = CORE_LIBS.map((lib) => path.join(REPO_ROOT, lib));

/** 被门禁锁定的通用 fs 接口标识符（CORE-01 / D-13）。 */
const TARGET_IDENTIFIER = 'IEditorFileSystem';

/** 唯一允许出现该标识符的声明文件；其余任何文件出现即违规。 */
const DECLARATION_FILE = `${CORE_LIBS[0]}/fs/types.ts`;

/** 匹配标识符的词边界模式（`IEditorFileSystemXxx` 式假朋友不会误命中）。 */
const REFERENCE_PATTERN = new RegExp(`\\b${TARGET_IDENTIFIER}\\b`);

/** 扫描扩展名（与 coreImportType.js / coreEngineNeutral.js 一致）。 */
const SOURCE_EXTENSION = /\.tsx?$/;

/**
 * 真实树非空转底线：两个包全量源码文件数的保守下界。它比 `> 0` 更紧——若扫描范围被静默削弱
 * （glob 写错、排除规则被放大、只扫一个包），扫描数会塌到下界以下并立刻变红。
 */
const MIN_EXPECTED_SOURCES = 20;

/** (b) 两极性 fixture 的路径与源码（脚本创建、脚本删除，绝不入库）。 */
const SURFACE_FIXTURE_PATH = `${CORE_LIBS[0]}/__fsSurfaceProbe__.ts`;
const SURFACE_FIXTURE_ABS = path.join(REPO_ROOT, SURFACE_FIXTURE_PATH);
const SURFACE_FIXTURE_LINES = [
  '/**',
  ' * 合成违规 fixture：一个 class 实现核心 fs 接口，必须被同一条断言拦下',
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
/** fixture 里必须被命中的行数（标识符只出现一次：`implements` 那一行）。 */
const SURFACE_FIXTURE_EXPECTED_HITS = 1;

// ==================== 断言工具 ====================

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function relative(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, '/');
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

/** 合并两个包的 src 全部源码（逐包 collectSources 后拼接，保持确定性排序）。 */
function collectAllSources() {
  return CORE_LIB_ABS.flatMap((dir) => collectSources(dir)).sort((left, right) =>
    left.relPath.localeCompare(right.relPath),
  );
}

/**
 * 逐文件逐行匹配标识符，返回按 `relPath → line` 稳定排序的违规列表。声明文件本身豁免（它正是
 * 该标识符唯一允许出现的地方）。
 */
function findReferences(sources) {
  const references = [];
  for (const file of sources) {
    if (file.relPath === DECLARATION_FILE) continue;
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
  check(sources.length > 0, `没有扫描到任何 ${CORE_LIBS.join('、')}/**/*.{ts,tsx} —— 门禁无从生效`);
  check(
    sources.length >= MIN_EXPECTED_SOURCES,
    `真实树只扫描到 ${sources.length} 个源码文件，低于非空转下界 ${MIN_EXPECTED_SOURCES} —— 扫描范围可能被削弱`,
  );
  const references = findReferences(sources);
  check(
    references.length === 0,
    `真实树出现 ${references.length} 处 ${TARGET_IDENTIFIER}（期望 0，必须去修源码而非放宽门禁；` +
      `唯一允许的位置是声明文件 ${DECLARATION_FILE}）：${formatReferences(references)}`,
  );
  console.log(
    `coreFsSurface: 真实树通过（已扫描 ${scannedFileCount} 个源码文件 ≥ 非空转下界 ${MIN_EXPECTED_SOURCES}，` +
      `${TARGET_IDENTIFIER} 仅出现在声明文件 ${DECLARATION_FILE}、其余 0 命中）`,
  );
}

// ==================== (b) 两极性 ====================

function checkTwoPolarity() {
  const fixture = buildFixture(SURFACE_FIXTURE_LINES, SURFACE_FIXTURE_MARKERS);
  fs.writeFileSync(SURFACE_FIXTURE_ABS, fixture.source, 'utf8');
  let references = [];
  try {
    references = findReferences(collectAllSources());
  } finally {
    fs.rmSync(SURFACE_FIXTURE_ABS, { force: true });
  }

  const fixtureReferences = references.filter((reference) => reference.relPath === SURFACE_FIXTURE_PATH);
  const line = fixture.lineOf.implements;
  if (line <= 0) {
    check(false, '`implements` 定位标记在 fixture 里找不到 —— 断言无法定位');
  } else {
    const onLine = fixtureReferences.filter((reference) => reference.line === line);
    check(
      onLine.length === 1,
      `两极性失败：合成 fixture 的 class 实现（第 ${line} 行）未被逐行命中：${formatReferences(fixtureReferences)}`,
    );
  }
  check(
    fixtureReferences.length === SURFACE_FIXTURE_EXPECTED_HITS,
    `两极性失败：fixture 应恰好产生 ${SURFACE_FIXTURE_EXPECTED_HITS} 处 ${TARGET_IDENTIFIER}，` +
      `实际 ${fixtureReferences.length} 处：${formatReferences(fixtureReferences)}`,
  );
  check(!fs.existsSync(SURFACE_FIXTURE_ABS), `两极性 fixture 未被删除：${SURFACE_FIXTURE_PATH}`);
  console.log(
    `coreFsSurface: 两极性成立（合成 fixture 的 \`implements ${TARGET_IDENTIFIER}\` 被逐行命中、` +
      '真实树 0 命中，且 fixture 已删除）',
  );
}

// ==================== 入口 ====================

function main() {
  for (const [index, abs] of CORE_LIB_ABS.entries()) {
    if (!fs.existsSync(abs)) {
      console.error(`coreFsSurface: 找不到 ${CORE_LIBS[index]} —— 无法验证门禁`);
      process.exit(1);
    }
  }
  const declarationAbs = path.join(REPO_ROOT, DECLARATION_FILE);
  if (!fs.existsSync(declarationAbs)) {
    console.error(`coreFsSurface: 找不到声明文件 ${DECLARATION_FILE} —— 无法验证门禁`);
    process.exit(1);
  }

  checkRealTree();
  checkTwoPolarity();

  if (failures.length > 0) {
    for (const failure of failures) console.error(`coreFsSurface: ${failure}`);
    process.exit(1);
  }
  console.log(
    `coreFsSurface: 全部断言通过（真实树扫描 ${scannedFileCount} 个源码文件、${TARGET_IDENTIFIER} 仅在声明文件；` +
      '两极性 fixture 被逐行拦下并已删除）',
  );
}

main();
