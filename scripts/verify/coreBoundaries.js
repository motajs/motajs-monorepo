#!/usr/bin/env node
/**
 * editor-core 依赖边界门禁的两极性证明（VERIFY-05 / PKG-03）。
 *
 * 用法：node scripts/verify/coreBoundaries.js
 *
 * 断言的是「门禁真的会响」，而不是「配置文件写对了」：
 *   (a) 真实树 —— cruise 必须 0 个 error 级违规；
 *   (b) 未被掩盖 —— core 的包内相对边必须全部解析到 core 内部。一条未解析的边会让所有按
 *       `to.path` 匹配的规则静默失效（规则永不触发也算「通过」）。唯一容忍的是裸的
 *       `@styled-system/*`：它是 PandaCSS 由消费方生成的路径（styled-system/），不是真实包，
 *       因此不添加 blanket not-to-unresolvable 规则（Pitfall 6）；
 *   (c) 合成违规 —— 临时写入一个跨能力 fixture，cruise 必须被
 *       capabilities-must-not-import-each-other 拦下，finally 删除后断言其不存在；
 *   (d) PKG-03 负极性 —— 临时写入一个错误的包内相对导入，core 自己的 `tsc -p` 必须报 TS2307，
 *       证明 core 的 TypeScript program 真的在检查 core 自己的文件；
 *   (e) 边方向 —— editor 真实 import core，且 core 的 manifest 不反向声明 editor/service-worker。
 *
 * 两个 fixture 都由脚本自己创建与删除，绝不入库。
 *
 * 两个实测得到的工具事实（决定了实现形状）：
 *   1. `--output-type json` 即使存在 error 级违规也以 0 退出，因此 (c) 额外用默认 err reporter
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

/** cruise 目标与规则集：只 cruise core（D-14），配置显式传入。 */
const CORE_LIB = 'packages/libs/editor-core/lib';
const CONFIG_PATH = '.dependencyCruiser.cjs';

const CORE_PACKAGE_JSON = path.join(REPO_ROOT, 'packages', 'libs', 'editor-core', 'package.json');
const EDITOR_APP_TSX = path.join(REPO_ROOT, 'packages', 'apps', 'editor', 'src', 'App.tsx');

/** editor→core 的边：App.tsx 里真实存在的 import 说明符。 */
const EDITOR_TO_CORE_EDGE = '@motajs/editor-core/react';

/** core 不得反向声明的包。 */
const FORBIDDEN_REVERSE_DECLARATIONS = ['@motajs/editor', '@motajs/service-worker'];
const MANIFEST_SECTIONS = ['dependencies', 'peerDependencies', 'devDependencies'];

/** (c) 合成违规：`code` 能力 import `table` 能力，必须被规则拦下。 */
const SYNTHETIC_FIXTURE = path.join(REPO_ROOT, CORE_LIB, 'code', '__boundariesProbe__.ts');
const SYNTHETIC_SOURCE = "import '../table/index';\n";
const SYNTHETIC_RULE = 'capabilities-must-not-import-each-other';

/** (d) PKG-03 负极性：一个不存在的包内相对导入。具名导入才会被 tsc 检查（side-effect 导入默认不检查）。 */
const POLARITY_FIXTURE = path.join(REPO_ROOT, CORE_LIB, '__polarityProbe__.ts');
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
  const result = spawnSync(process.execPath, [DEPCRUISE_BIN, '--config', CONFIG_PATH, ...extraArgs, CORE_LIB], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
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

// ==================== (a) 真实树 + (b) 未被掩盖 ====================

function isInsideCoreLib(candidate) {
  return candidate === CORE_LIB || candidate.startsWith(`${CORE_LIB}/`);
}

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
  const coreModules = modules.filter((module) => isInsideCoreLib(module.source ?? ''));
  check(coreModules.length > 0, `cruise 报告里没有任何 core 模块（目标 ${CORE_LIB}）—— 规则无从生效`);

  let relativeEdges = 0;
  let tolerated = 0;
  for (const module of coreModules) {
    for (const dependency of module.dependencies ?? []) {
      const specifier = dependency.module ?? '';
      const unresolved = dependency.couldNotResolve === true;
      const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
      if (isRelative) {
        relativeEdges += 1;
        if (unresolved) {
          check(false, `core 包内相对边未解析：${module.source} → ${specifier}（会让所有路径规则静默失效）`);
          continue;
        }
        const resolved = dependency.resolved ?? '';
        check(
          isInsideCoreLib(resolved),
          `core 包内相对边解析到 core 之外：${module.source} → ${specifier}（解析为 ${resolved || '未知'}）`,
        );
        continue;
      }
      if (!unresolved) continue;
      if (TOLERATED_UNRESOLVED.test(specifier)) {
        tolerated += 1;
        continue;
      }
      check(false, `core 出现非 @styled-system 的未解析说明符：${module.source} → ${specifier}`);
    }
  }
  console.log(
    `coreBoundaries: core 包内相对边全部解析到 core 内部（${coreModules.length} 个 core 模块、${relativeEdges} 条相对边）`,
  );
  if (tolerated > 0) {
    console.log(
      `coreBoundaries: 容忍 ${tolerated} 条 @styled-system/* 未解析边 —— 它是 PandaCSS 由消费方生成的路径` +
        '（packages/apps/editor/styled-system），不是真实包；因此不添加 blanket not-to-unresolvable 规则（Pitfall 6）',
    );
  }
}

// ==================== (c) 合成违规 ====================

function checkSyntheticViolation() {
  fs.writeFileSync(SYNTHETIC_FIXTURE, SYNTHETIC_SOURCE, 'utf8');
  try {
    const cruise = cruiseAsJson();
    if (cruise.error) {
      check(false, `合成违规 fixture 的 cruise 失败：${cruise.error}`);
    } else {
      const summary = cruise.report?.summary ?? {};
      check(
        summary.error > 0,
        `合成违规 fixture 未产生 error 级违规（error=${summary.error}）：${describeViolations(cruise.report)}`,
      );
      const named = (summary.violations ?? []).some((violation) => violation.rule?.name === SYNTHETIC_RULE);
      check(named, `合成违规 fixture 未被规则 ${SYNTHETIC_RULE} 命中：${describeViolations(cruise.report)}`);
    }

    // `--output-type json` 不会因 error 级违规而改变退出码，因此单独用默认 err reporter 观测非零退出。
    const exitRun = runDepcruise([]);
    if (exitRun.error) {
      check(false, `合成违规 fixture 的 err reporter 运行失败：${exitRun.error}`);
    } else {
      check(exitRun.status !== 0, `合成违规 fixture 未让 cruise 非零退出（默认 reporter 退出码 ${exitRun.status}）`);
    }
  } finally {
    fs.rmSync(SYNTHETIC_FIXTURE, { force: true });
  }
  check(!fs.existsSync(SYNTHETIC_FIXTURE), `合成违规 fixture 未被删除：${relative(SYNTHETIC_FIXTURE)}`);
}

// ==================== (d) PKG-03 负极性 ====================

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

// ==================== (e) 边方向 ====================

function checkEdgeDirection() {
  check(fs.existsSync(EDITOR_APP_TSX), `找不到 ${relative(EDITOR_APP_TSX)} —— 无法断言 editor→core 的边`);
  if (fs.existsSync(EDITOR_APP_TSX)) {
    const editorApp = fs.readFileSync(EDITOR_APP_TSX, 'utf8');
    check(
      editorApp.includes(EDITOR_TO_CORE_EDGE),
      `${relative(EDITOR_APP_TSX)} 未包含 ${EDITOR_TO_CORE_EDGE} —— editor→core 的边不存在`,
    );
  }

  check(fs.existsSync(CORE_PACKAGE_JSON), `找不到 ${relative(CORE_PACKAGE_JSON)}`);
  if (fs.existsSync(CORE_PACKAGE_JSON)) {
    const manifest = JSON.parse(fs.readFileSync(CORE_PACKAGE_JSON, 'utf8'));
    for (const section of MANIFEST_SECTIONS) {
      const block = manifest[section] ?? {};
      for (const name of FORBIDDEN_REVERSE_DECLARATIONS) {
        check(
          !Object.prototype.hasOwnProperty.call(block, name),
          `core 的 ${section} 反向声明了 ${name} —— 边界方向被反转`,
        );
      }
    }
  }
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
  checkSyntheticViolation();
  checkPolarity();
  checkEdgeDirection();

  if (failures.length > 0) {
    for (const failure of failures) console.error(`coreBoundaries: ${failure}`);
    process.exit(1);
  }
  console.log(
    'coreBoundaries: 全部断言通过（真实树 0 违规、合成违规被拦、PKG-03 负极性 TS2307、editor→core 边方向正确）',
  );
}

main();
