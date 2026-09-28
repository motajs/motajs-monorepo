#!/usr/bin/env node
/**
 * editor-core / editor-impl 依赖边界门禁的两极性证明（VERIFY-05 / PKG-03 / T-05.1-07）。
 *
 * 用法：node scripts/verify/coreBoundaries.js
 *
 * 断言的是「门禁真的会响」，而不是「配置文件写对了」：
 *   (a) 真实树 —— cruise 必须 0 个 error 级违规；
 *   (b) 未被掩盖 —— 两个包的包内相对边必须全部解析到**同一个包**内部。一条未解析的边会让所有按
 *       `to.path` 匹配的规则静默失效（规则永不触发也算「通过」）。唯一容忍的是裸的
 *       `@styled-system/*`：它是 PandaCSS 由消费方生成的路径（styled-system/），不是真实包，
 *       因此不添加 blanket not-to-unresolvable 规则（Pitfall 6）；
 *   (c) 能力互斥 —— 临时在 editor-impl 的 `code` 能力目录写入一个 import `table` 能力的 fixture，
 *       cruise 必须被 capabilities-must-not-import-each-other 拦下；
 *   (d) 依赖方向 —— 临时在 editor-core/lib 写入一个 import `@motajs/editor-impl` 的 fixture，
 *       cruise 必须被 editor-core-must-not-import-editor-impl 以 error 级命中（T-05.1-07）；
 *   (e) 底层 IO 清零 —— editor-core/lib 的生产源码不得出现文件读写**调用**形态（`this.fs`、
 *       `.readFile(` …），真实树命中 0、扫描文件数不低于非空转下界；一个含 `this.fs.readFile(` 的
 *       合成 fixture 必须被同一条断言拦下；
 *   (f) PKG-03 负极性 —— 临时写入一个错误的包内相对导入，core 自己的 `tsc -p` 必须报 TS2307，
 *       证明 core 的 TypeScript program 真的在检查 core 自己的文件；
 *   (g) 边方向 —— editor 真实 import 默认实现包的 `./react`，且两个包的 manifest 都不反向声明
 *       editor/service-worker。
 *
 * 全部 fixture 都由脚本自己创建与删除，绝不入库。
 *
 * 两个实测得到的工具事实（决定了实现形状）：
 *   1. `--output-type json` 即使存在 error 级违规也以 0 退出，因此 (c)/(d) 额外用默认 err reporter
 *      跑一次，单独观测非零退出码；
 *   2. dependency-cruiser 的 `exports` 未导出 `./package.json`，因此 manifest 通过 Node 自身的
 *      搜索路径算法定位，再取 `bin.depcruise` 拼出 CLI 路径。
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ==================== 常量 ====================

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

/** cruise 目标：底层与默认实现两个包的 lib（D-14：不做全仓 cruise），配置显式传入。 */
const CORE_LIBS = ['packages/libs/editor-core/lib', 'packages/libs/editor-impl/lib'];
const CONFIG_PATH = '.dependencyCruiser.cjs';

const CORE_PACKAGE_JSON = path.join(REPO_ROOT, 'packages', 'libs', 'editor-core', 'package.json');
const IMPL_PACKAGE_JSON = path.join(REPO_ROOT, 'packages', 'libs', 'editor-impl', 'package.json');
const EDITOR_APP_TSX = path.join(REPO_ROOT, 'packages', 'apps', 'editor', 'src', 'App.tsx');

/**
 * editor→默认实现的边：`App.tsx` 拆分后的新说明符。
 *
 * 本计划只改常量：编辑器文件由同波的 05.1-08 改。为了在本计划边界处仍能证明「边真实存在」，
 * 边缘断言同时接受拆分前的旧说明符（`@motajs/editor-core/react`）作为过渡形态。
 */
const EDITOR_TO_CORE_EDGE = '@motajs/editor-impl/react';
const EDITOR_TO_CORE_EDGE_PRESPLIT = '@motajs/editor-core/react';

/** 两个包都不得反向声明的包。 */
const FORBIDDEN_REVERSE_DECLARATIONS = ['@motajs/editor', '@motajs/service-worker'];
const MANIFEST_SECTIONS = ['dependencies', 'peerDependencies', 'devDependencies'];

/** (c) 合成违规：`code` 能力 import `table` 能力，必须被规则拦下。 */
const SYNTHETIC_FIXTURE = path.join(REPO_ROOT, 'packages/libs/editor-impl/lib/code/__boundariesProbe__.ts');
const SYNTHETIC_SOURCE = "import '../table/index';\n";
const SYNTHETIC_RULE = 'capabilities-must-not-import-each-other';

/** (d) 依赖方向：底层 import 默认实现，必须被 editor-core-must-not-import-editor-impl 拦下。 */
const DIRECTION_FIXTURE = path.join(REPO_ROOT, 'packages/libs/editor-core/lib/__implDependencyProbe__.ts');
const DIRECTION_SOURCE = "import '@motajs/editor-impl';\n";
const DIRECTION_RULE = 'editor-core-must-not-import-editor-impl';

/** (e) 底层 IO 清零：只匹配带前导点的调用形态；`ports/fs.ts` 的接口成员声明不带前导点，故不误报。 */
const BOTTOM_LAYER_IO_TOKENS = [
  'this.fs',
  '.readFile(',
  '.readFileBinary(',
  '.writeFile(',
  '.deleteFile(',
  '.readdir(',
  '.mkdir(',
  '.moveFile(',
];
const BOTTOM_LAYER_LIB = 'packages/libs/editor-core/lib';
const IO_FIXTURE = path.join(REPO_ROOT, BOTTOM_LAYER_LIB, '__bottomLayerIoProbe__.ts');
const IO_FIXTURE_SOURCE = [
  '/** 合成 fixture：底层 IO 清零门禁必须命中的调用形态（coreBoundaries.js 创建与删除，绝不入库）。 */',
  'export class BottomLayerIoProbe {',
  '  private readonly fs = { readFile: (path: string): string => path };',
  '',
  '  probe(): string {',
  "    return this.fs.readFile('x');",
  '  }',
  '}',
  '',
].join('\n');
/** 真实树扫描文件数的非空转下界（比 `> 0` 更紧，又不随 core 增长而误红）。 */
const MIN_EXPECTED_CORE_SOURCES = 8;

/** (f) PKG-03 负极性：一个不存在的包内相对导入。具名导入才会被 tsc 检查（side-effect 导入默认不检查）。 */
const POLARITY_FIXTURE = path.join(REPO_ROOT, BOTTOM_LAYER_LIB, '__polarityProbe__.ts');
const POLARITY_SOURCE = "import { definitelyMissing } from './definitely-missing-module';\n";

/** 唯一容忍的未解析说明符类别。 */
const TOLERATED_UNRESOLVED = /^@styled-system\//;

/** 由 main() 解析出的 dependency-cruiser CLI 路径。 */
let DEPCRUISE_BIN = '';

// ==================== 断言工具 ====================

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function relative(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, '/');
}

/** 返回包含该路径的包 lib 前缀（形如 packages/libs/<包名>/lib），不在任何包内则返回 null。 */
function packageRootOf(candidate) {
  for (const lib of CORE_LIBS) {
    if (candidate === lib || candidate.startsWith(`${lib}/`)) return lib;
  }
  return null;
}

function isInsideAnyCoreLib(candidate) {
  return packageRootOf(candidate) !== null;
}

// ==================== dependency-cruiser 定位与调用 ====================

/** dependency-cruiser 的 exports 未导出 ./package.json；先试直连，再退回 Node 的搜索路径。 */
function resolveDepcruiseManifest() {
  const require = createRequire(path.join(REPO_ROOT, 'package.json'));
  try {
    return { manifestPath: require.resolve('dependency-cruiser/package.json') };
  } catch {
    // 继续走下面的搜索路径分支。
  }
  for (const searchPath of require.resolve.paths('dependency-cruiser') ?? []) {
    const candidate = path.join(searchPath, 'dependency-cruiser', 'package.json');
    if (fs.existsSync(candidate)) return { manifestPath: candidate };
  }
  return { error: '无法定位 dependency-cruiser 的 package.json —— 依赖未安装？' };
}

function resolveDepcruiseBin() {
  const manifest = resolveDepcruiseManifest();
  if (manifest.error) return manifest;
  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(manifest.manifestPath, 'utf8'));
  } catch (error) {
    return { error: `无法读取 ${relative(manifest.manifestPath)}：${error.message}` };
  }
  const binField = packageJson.bin;
  const relativeBin = typeof binField === 'string' ? binField : binField?.depcruise;
  if (typeof relativeBin !== 'string') {
    return { error: 'dependency-cruiser 的 bin 字段里没有 depcruise —— 无法定位 CLI' };
  }
  return { binPath: path.resolve(path.dirname(manifest.manifestPath), relativeBin) };
}

function runDepcruise(extraArgs) {
  const result = spawnSync(
    process.execPath,
    [DEPCRUISE_BIN, '--config', CONFIG_PATH, ...extraArgs, ...CORE_LIBS],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (result.error) return { error: `无法运行 dependency-cruiser：${result.error.message}` };
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function cruiseAsJson() {
  const run = runDepcruise(['--output-type', 'json']);
  if (run.error) return run;
  try {
    return { status: run.status, report: JSON.parse(run.stdout) };
  } catch (error) {
    const detail = run.stderr.trim().replace(/\s+/g, ' ').slice(-300);
    return { error: `无法解析 dependency-cruiser 的 JSON 输出：${error.message}（stderr：${detail || '空'}）` };
  }
}

function describeViolations(report) {
  const violations = report?.summary?.violations ?? [];
  if (violations.length === 0) return '（无）';
  return violations.map((violation) => `${violation.rule?.name}: ${violation.from} → ${violation.to}`).join(' | ');
}

/** 断言某个合成 fixture 被指定规则以 error 级命中，且默认 err reporter 非零退出。 */
function assertSyntheticRuleHit(fixturePath, fixtureSource, ruleName, label) {
  fs.writeFileSync(fixturePath, fixtureSource, 'utf8');
  try {
    const cruise = cruiseAsJson();
    if (cruise.error) {
      check(false, `${label} fixture 的 cruise 失败：${cruise.error}`);
    } else {
      const summary = cruise.report?.summary ?? {};
      check(
        summary.error > 0,
        `${label} fixture 未产生 error 级违规（error=${summary.error}）：${describeViolations(cruise.report)}`,
      );
      const named = (summary.violations ?? []).some((violation) => violation.rule?.name === ruleName);
      check(named, `${label} fixture 未被规则 ${ruleName} 命中：${describeViolations(cruise.report)}`);
    }

    const exitRun = runDepcruise([]);
    if (exitRun.error) {
      check(false, `${label} fixture 的 err reporter 运行失败：${exitRun.error}`);
    } else {
      check(exitRun.status !== 0, `${label} fixture 未让 cruise 非零退出（默认 reporter 退出码 ${exitRun.status}）`);
    }
  } finally {
    fs.rmSync(fixturePath, { force: true });
  }
  check(!fs.existsSync(fixturePath), `${label} fixture 未被删除：${relative(fixturePath)}`);
}

// ==================== (a) 真实树 + (b) 未被掩盖 ====================

function checkRealTree() {
  const cruise = cruiseAsJson();
  if (cruise.error) {
    check(false, cruise.error);
    return null;
  }
  const summary = cruise.report?.summary ?? {};
  const errorCount = summary.error;
  check(
    errorCount === 0,
    `真实树 cruise 报告 ${errorCount} 个 error 级违规（期望 0）：${describeViolations(cruise.report)}`,
  );
  console.log(
    `coreBoundaries: 真实树 cruise 通过（error 违规 ${errorCount} 条，warn ${summary.warn ?? 0} 条，` +
      `共 ${summary.totalCruised ?? 0} 个模块、${summary.totalDependenciesCruised ?? 0} 条依赖）`,
  );
  return cruise.report;
}

function checkEdgesNotMasked(report) {
  if (report === null) return;
  const modules = Array.isArray(report.modules) ? report.modules : [];
  const coreModules = modules.filter((module) => isInsideAnyCoreLib(module.source ?? ''));
  check(coreModules.length > 0, `cruise 报告里没有任何 core/impl 模块（目标 ${CORE_LIBS.join(' 与 ')}）—— 规则无从生效`);

  let relativeEdges = 0;
  let tolerated = 0;
  for (const module of coreModules) {
    const moduleRoot = packageRootOf(module.source ?? '');
    for (const dependency of module.dependencies ?? []) {
      const specifier = dependency.module ?? '';
      const unresolved = dependency.couldNotResolve === true;
      const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
      if (isRelative) {
        relativeEdges += 1;
        if (unresolved) {
          check(false, `包内相对边未解析：${module.source} → ${specifier}（会让所有路径规则静默失效）`);
          continue;
        }
        const resolved = dependency.resolved ?? '';
        check(
          packageRootOf(resolved) === moduleRoot,
          `包内相对边解析到本包之外：${module.source} → ${specifier}（解析为 ${resolved || '未知'}）`,
        );
        continue;
      }
      if (!unresolved) continue;
      if (TOLERATED_UNRESOLVED.test(specifier)) {
        tolerated += 1;
        continue;
      }
      check(false, `core/impl 出现非 @styled-system 的未解析说明符：${module.source} → ${specifier}`);
    }
  }
  console.log(
    `coreBoundaries: 两个包的包内相对边全部解析回本包内部（${coreModules.length} 个模块、${relativeEdges} 条相对边）`,
  );
  if (tolerated > 0) {
    console.log(
      `coreBoundaries: 容忍 ${tolerated} 条 @styled-system/* 未解析边 —— 它是 PandaCSS 由消费方生成的路径` +
        '（packages/apps/editor/styled-system），不是真实包；因此不添加 blanket not-to-unresolvable 规则（Pitfall 6）',
    );
  }
}

// ==================== (d) 依赖方向两极性 ====================

function checkDependencyDirection() {
  assertSyntheticRuleHit(DIRECTION_FIXTURE, DIRECTION_SOURCE, DIRECTION_RULE, '底层→实现 依赖方向');
  console.log(
    `coreBoundaries: 依赖方向两极性成立（合成 fixture 被 ${DIRECTION_RULE} 以 error 级命中；真实树 0 违规）`,
  );
}

// ==================== (e) 底层 IO 清零两极性 ====================

/** 递归收集目录下全部 .ts/.tsx 源文件（返回相对仓库根的路径）。 */
function collectTsFiles(absoluteDir) {
  const results = [];
  const walk = (current) => {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) results.push(relative(full));
    }
  };
  walk(absoluteDir);
  return results;
}

/** 返回命中任一 IO token 的 `{ file, token }` 列表。 */
function findIoHits(fileList) {
  const hits = [];
  for (const relPath of fileList) {
    const source = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
    for (const token of BOTTOM_LAYER_IO_TOKENS) {
      if (source.includes(token)) hits.push({ file: relPath, token });
    }
  }
  return hits;
}

function checkBottomLayerIoFree() {
  const coreAbs = path.join(REPO_ROOT, BOTTOM_LAYER_LIB);
  const files = collectTsFiles(coreAbs);
  check(files.length > 0, `没有扫描到 ${BOTTOM_LAYER_LIB}/**/*.{ts,tsx} —— 门禁无从生效`);
  check(
    files.length >= MIN_EXPECTED_CORE_SOURCES,
    `真实树只扫描到 ${files.length} 个核心文件，低于非空转下界 ${MIN_EXPECTED_CORE_SOURCES} —— 扫描范围可能被削弱`,
  );

  const realHits = findIoHits(files);
  check(
    realHits.length === 0,
    `底层出现 ${realHits.length} 条文件读写调用（期望 0，底层只允许定义接口、永不调用）：` +
      realHits.map((hit) => `${hit.file} 含 ${hit.token}`).join(' | '),
  );

  fs.writeFileSync(IO_FIXTURE, IO_FIXTURE_SOURCE, 'utf8');
  let fixtureHits = [];
  try {
    fixtureHits = findIoHits(collectTsFiles(coreAbs));
  } finally {
    fs.rmSync(IO_FIXTURE, { force: true });
  }
  const fixtureRel = relative(IO_FIXTURE);
  check(
    fixtureHits.some((hit) => hit.file === fixtureRel),
    '底层 IO 清零两极性失败：含 `this.fs.readFile(` 的合成 fixture 未被同一条断言拦下',
  );
  check(!fs.existsSync(IO_FIXTURE), `底层 IO 清零 fixture 未被删除：${fixtureRel}`);
  console.log(
    `coreBoundaries: 底层 IO 清零两极性成立（真实树 ${files.length} 个文件 0 命中；合成 fixture 被拦下并已删除）`,
  );
}

// ==================== (f) PKG-03 负极性 ====================

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

function checkPolarity() {
  fs.writeFileSync(POLARITY_FIXTURE, POLARITY_SOURCE, 'utf8');
  let typecheck = { error: '未运行' };
  try {
    typecheck = runCoreTypecheck();
  } finally {
    fs.rmSync(POLARITY_FIXTURE, { force: true });
  }
  if (typecheck.error) {
    check(false, typecheck.error);
  } else {
    check(
      typecheck.status !== 0,
      `core 自己的 tsc -p 未因错误的包内导入而失败（退出码 ${typecheck.status}）—— program 没有检查 core 的文件`,
    );
    check(
      typecheck.output.includes('TS2307'),
      `core 自己的 tsc -p 输出里没有 TS2307：${typecheck.output.trim().replace(/\s+/g, ' ').slice(-300)}`,
    );
  }
  check(!fs.existsSync(POLARITY_FIXTURE), `PKG-03 负极性 fixture 未被删除：${relative(POLARITY_FIXTURE)}`);
}

// ==================== (g) 边方向 ====================

function checkManifestDirection(manifestPath, label) {
  check(fs.existsSync(manifestPath), `找不到 ${relative(manifestPath)}`);
  if (!fs.existsSync(manifestPath)) return;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const section of MANIFEST_SECTIONS) {
    const block = manifest[section] ?? {};
    for (const name of FORBIDDEN_REVERSE_DECLARATIONS) {
      check(
        !Object.prototype.hasOwnProperty.call(block, name),
        `${label} 的 ${section} 反向声明了 ${name} —— 边界方向被反转`,
      );
    }
  }
}

function checkEdgeDirection() {
  check(fs.existsSync(EDITOR_APP_TSX), `找不到 ${relative(EDITOR_APP_TSX)} —— 无法断言 editor→impl 的边`);
  if (fs.existsSync(EDITOR_APP_TSX)) {
    const editorApp = fs.readFileSync(EDITOR_APP_TSX, 'utf8');
    const hasNewEdge = editorApp.includes(EDITOR_TO_CORE_EDGE);
    const hasPresplitEdge = editorApp.includes(EDITOR_TO_CORE_EDGE_PRESPLIT);
    check(
      hasNewEdge || hasPresplitEdge,
      `${relative(EDITOR_APP_TSX)} 未包含 ${EDITOR_TO_CORE_EDGE}（或过渡形态 ${EDITOR_TO_CORE_EDGE_PRESPLIT}）—— editor→impl 的边不存在`,
    );
    if (!hasNewEdge && hasPresplitEdge) {
      console.log(
        `coreBoundaries: editor 仍使用拆分前的说明符 ${EDITOR_TO_CORE_EDGE_PRESPLIT}（本计划不改编辑器；` +
          `由同波 05.1-08 改指 ${EDITOR_TO_CORE_EDGE}）`,
      );
    }
  }

  checkManifestDirection(CORE_PACKAGE_JSON, 'editor-core');
  checkManifestDirection(IMPL_PACKAGE_JSON, 'editor-impl');
}

// ==================== 入口 ====================

function main() {
  const depcruise = resolveDepcruiseBin();
  if (depcruise.error) {
    console.error(`coreBoundaries: ${depcruise.error}`);
    process.exit(1);
  }
  DEPCRUISE_BIN = depcruise.binPath;

  checkEdgesNotMasked(checkRealTree());
  assertSyntheticRuleHit(SYNTHETIC_FIXTURE, SYNTHETIC_SOURCE, SYNTHETIC_RULE, '能力互斥');
  checkDependencyDirection();
  checkBottomLayerIoFree();
  checkPolarity();
  checkEdgeDirection();

  if (failures.length > 0) {
    for (const failure of failures) console.error(`coreBoundaries: ${failure}`);
    process.exit(1);
  }
  console.log(
    'coreBoundaries: 全部断言通过（真实树 0 违规、能力互斥与底层→实现方向各被拦、底层 IO 清零两极性、' +
      'PKG-03 负极性 TS2307、两包 manifest 与 editor→impl 边方向正确）',
  );
}

main();
