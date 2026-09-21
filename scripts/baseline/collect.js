#!/usr/bin/env node
/**
 * 基线采集脚本（VERIFY-01 / VERIFY-07）。
 *
 * 用法：node scripts/baseline/collect.js <unit|build|e2e|screenshots>
 *
 * 每次调用会读取已有的 `.planning/baseline/baseline.json`（若存在），只合并本次
 * scope 对应的块，再以两空格缩进 + 末尾换行的形式写回；重复运行不会产生重复键。
 *
 * 计数来源约定（RESEARCH Pitfall 5）：所有数字都取自 runner 自己产出的报告
 * （vitest `--reporter=json` / Playwright `--reporter=json`），绝不通过枚举源文件估算。
 * 产物体积取自 editor-artifact-plugin 自己打印的报告行以及它写出的 manifest，
 * 20 MiB 上限常量与插件保持一致。
 *
 * 本脚本是纯 Node ESM：只从仓库根运行、不导入任何 workspace 包、不安装依赖、不访问网络。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

// ==================== 常量 ====================

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BASELINE_DIR = path.join(REPO_ROOT, '.planning', 'baseline');
const BASELINE_PATH = path.join(BASELINE_DIR, 'baseline.json');
const SCREENSHOTS_DIR = path.join(BASELINE_DIR, 'screenshots');
const EDITOR_MANIFEST_PATH = path.join(REPO_ROOT, 'packages', 'apps', 'editor', 'dist', 'editor-manifest.json');
const BASELINE_MANIFEST_PATH = path.join(BASELINE_DIR, 'editor-manifest.json');
const ARTIFACT_PLUGIN_PATH = path.join(REPO_ROOT, 'packages', 'apps', 'editor', 'editor-artifact-plugin.ts');
const RUNTIME_PROTOCOL_PATH = path.join(REPO_ROOT, 'packages', 'apps', 'editor', 'src', 'runtime', 'protocol.ts');

/** 拥有 `test` 脚本的 workspace 包（不含 @motajs/utils / @motajs/react-dark-mode / @motajs/config）。 */
const UNIT_PACKAGES = [
  '@motajs/editor',
  '@motajs/service-worker',
  '@motajs/file2x',
  '@motajs/h5animate',
  '@motajs/packer',
  '@motajs/react-hooks',
  '@motajs/react-monaco-editor',
  '@motajs/react-store',
];

/** 拥有 Playwright e2e 套件的应用。 */
const E2E_PACKAGES = ['@motajs/editor', '@motajs/service-worker'];

/** D-07 约定的五张人工比对基线截图。 */
const SCREENSHOT_NAMES = ['shell.png', 'editor-map.png', 'editor-table.png', 'editor-code.png', 'editor-asset.png'];

/** ci.yml 的四个 job 名，作为仓库 required-status-check 设置的契约（D-03/D-04）。 */
const CI_JOB_NAMES = ['lint', 'typecheck', 'unit', 'build'];

/** 影响本阶段行为、且属于复现配方的四个环境变量名（只记录名字，绝不记录取值）。 */
const ENV_VARS = ['MOTA_JS_ROOT', 'MOTA_WITH_EDITOR', 'MOTA_EDITOR_E2E_PORT', 'PLAYWRIGHT_USE_SYSTEM_CHROME'];

/** 与 editor-artifact-plugin.ts 的 MAX_EDITOR_ARTIFACT_BYTES 保持一致。 */
const RAW_BUDGET_BYTES = 20 * 1024 * 1024;

/** 写回时固定的顶层键顺序，保证多次运行产出稳定 diff。 */
const BLOCK_ORDER = ['git', 'unit', 'e2e', 'build', 'protocol', 'ciJobNames', 'envVars', 'screenshots'];

const MEBIBYTE = 1024 * 1024;

// ==================== 通用工具 ====================

/** 以仓库根为 cwd、通过 shell 运行一条命令，返回退出码与合并后的输出。 */
function run(command, extraEnv) {
  const result = spawnSync(command, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 128 * MEBIBYTE,
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/** 直接调用 git（真实可执行文件，不需要 shell）。 */
function gitOutput(args) {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  if (result.status !== 0) return '';
  return (result.stdout ?? '').trim();
}

/** 把多行输出压成一行，供 not-run 的 reason 字段使用。 */
function compactOutput(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function mebibytesToBytes(value) {
  return Math.round(Number(value) * MEBIBYTE);
}

function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return {};
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

/** 按 BLOCK_ORDER 重排后写回，末尾补一个换行。 */
function writeBaseline(blocks) {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  const ordered = {};
  for (const key of BLOCK_ORDER) {
    if (blocks[key] !== undefined) ordered[key] = blocks[key];
  }
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');
}

// ==================== 环境事实 / 协议常量 ====================

function collectEnvironment() {
  const submoduleLine = gitOutput(['submodule', 'status', 'packages/external/mota-js']);
  const pnpmVersion = run('pnpm --version').stdout.trim();
  return {
    commit: gitOutput(['rev-parse', 'HEAD']),
    submoduleSha: submoduleLine.replace(/^[-+U ]/, '').split(/\s+/)[0] ?? '',
    submoduleStatus: submoduleLine,
    pnpm: pnpmVersion,
    node: process.version,
  };
}

/** 从源码读取四个协议常量，避免把数字硬编码进脚本。 */
function collectProtocol() {
  const pluginSource = fs.readFileSync(ARTIFACT_PLUGIN_PATH, 'utf8');
  const runtimeSource = fs.readFileSync(RUNTIME_PROTOCOL_PATH, 'utf8');
  const manifestSchemaVersion = Number(/schemaVersion:\s*(\d+)/.exec(pluginSource)?.[1]);
  const manifestEnvironmentProtocolVersion = Number(/environmentProtocolVersion:\s*(\d+)/.exec(pluginSource)?.[1]);
  const manifestRuntimeProtocolVersion = Number(/runtimeProtocolVersion:\s*(\d+)/.exec(pluginSource)?.[1]);
  const runtimeProtocolVersion = Number(/RUNTIME_PROTOCOL_VERSION\s*=\s*(\d+)/.exec(runtimeSource)?.[1]);
  return {
    manifestSchemaVersion,
    manifestEnvironmentProtocolVersion,
    manifestRuntimeProtocolVersion,
    runtimeProtocolVersion,
    mismatchPreserved: manifestRuntimeProtocolVersion !== runtimeProtocolVersion,
  };
}

// ==================== scope: unit ====================

function collectUnit() {
  const unit = {};
  const failures = [];
  const reportPath = path.join(os.tmpdir(), 'gsd-baseline-unit.json');

  for (const pkg of UNIT_PACKAGES) {
    fs.rmSync(reportPath, { force: true });
    const result = run(`pnpm --filter ${pkg} exec vitest run --reporter=json --outputFile="${reportPath}"`);

    if (!fs.existsSync(reportPath)) {
      unit[pkg] = {
        status: 'not-run',
        reason: compactOutput(result.stderr || result.stdout).slice(0, 600),
      };
      failures.push(`${pkg}: vitest produced no JSON report (exit ${result.status})`);
      continue;
    }

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const passed = report.numPassedTests ?? 0;
    const failed = report.numFailedTests ?? 0;
    const skipped = (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0);
    const total = report.numTotalTests ?? passed + failed + skipped;

    unit[pkg] = { passed, failed, skipped, total, exitCode: result.status };
    console.log(`unit ${pkg}: ${passed} passed / ${failed} failed / ${skipped} skipped / ${total} total`);

    if (total === 0) failures.push(`${pkg}: recorded total is 0`);
    if (failed > 0) failures.push(`${pkg}: ${failed} failing test(s)`);
    if (result.status !== 0 && failed === 0 && total > 0) {
      // 已知的既有 teardown 抖动（与本阶段改动无关）：报告完整且全绿，进程仍以非 0 退出。
      // 保留 exitCode 作为记录，但不把它当成测量失败。
      console.warn(
        `warning: ${pkg} exited ${result.status} after a complete, all-passing report ` +
          '(pre-existing teardown flake); counts recorded and exitCode preserved.',
      );
    }
    if (result.status !== 0 && (failed > 0 || total === 0)) {
      failures.push(`${pkg}: exit ${result.status} without a complete all-passing report`);
    }
  }

  fs.rmSync(reportPath, { force: true });
  if (failures.length > 0) throw new Error(`unit scope incomplete: ${failures.join('; ')}`);
  return unit;
}

// ==================== scope: build ====================

function collectBuild() {
  const result = run('pnpm --filter @motajs/editor build');
  const combined = `${result.stdout}\n${result.stderr}`;
  if (result.status !== 0) {
    throw new Error(`editor production build failed (exit ${result.status}): ${compactOutput(combined).slice(0, 600)}`);
  }
  if (!fs.existsSync(EDITOR_MANIFEST_PATH)) {
    throw new Error(`editor-manifest.json was not emitted at ${EDITOR_MANIFEST_PATH}`);
  }

  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  fs.copyFileSync(EDITOR_MANIFEST_PATH, BASELINE_MANIFEST_PATH);

  const manifest = JSON.parse(fs.readFileSync(EDITOR_MANIFEST_PATH, 'utf8'));
  const files = manifest.files;
  const rawBytes = files.reduce((sum, file) => sum + file.size, 0);
  const baseNames = files.map((file) => path.posix.basename(file.path));
  const tsWorkers = baseNames.filter((name) => /^(?:ts|typescript)\.worker-.*\.js$/.test(name));
  const cssHtmlWorkers = baseNames.filter((name) => /^(?:css|html)\.worker-.*\.js$/.test(name));

  const pluginReportLine = /Editor artifact:[^\n]*/.exec(combined)?.[0]?.trim() ?? null;
  const parsed =
    /Editor artifact:\s*(\d+)\s*files,\s*raw\s*([\d.]+)\s*MiB,\s*gzip\s*([\d.]+)\s*MiB,\s*brotli\s*([\d.]+)\s*MiB/.exec(
      combined,
    );
  if (!parsed) throw new Error('could not read the editor artifact report line from the build output');
  if (parsed && Number(parsed[1]) !== files.length) {
    console.warn(`warning: plugin reported ${parsed[1]} files but the manifest lists ${files.length}`);
  }

  const editor = {
    files: files.length,
    rawBytes,
    gzipBytes: mebibytesToBytes(parsed[3]),
    brotliBytes: mebibytesToBytes(parsed[4]),
    rawBudgetBytes: RAW_BUDGET_BYTES,
    rawPercentOfBudget: Number(((rawBytes / RAW_BUDGET_BYTES) * 100).toFixed(4)),
    exactlyOneTsWorker: tsWorkers.length === 1 && !tsWorkers[0].startsWith('typescript.worker-'),
    noCssHtmlWorkers: cssHtmlWorkers.length === 0,
    manifestSchemaVersion: manifest.schemaVersion,
    pluginReportLine,
  };

  console.log(
    `build editor: ${editor.files} files, raw ${editor.rawBytes} bytes ` +
      `(${editor.rawPercentOfBudget}% of the 20 MiB ceiling)`,
  );
  return { editor };
}

// ==================== scope: e2e ====================

function readPlaywrightReport(reportPath, stdout) {
  if (fs.existsSync(reportPath)) return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const start = stdout.indexOf('{');
  if (start < 0) return null;
  try {
    return JSON.parse(stdout.slice(start));
  } catch {
    return null;
  }
}

/** 从 Playwright JSON 报告里递归收集失败用例的 `file › suite › title` 路径。 */
function collectFailedTests(report) {
  const failures = [];
  const walk = (suite, trail) => {
    const titles = suite.title ? [...trail, suite.title] : trail;
    for (const spec of suite.specs ?? []) {
      const failed = (spec.tests ?? []).some((item) =>
        (item.results ?? []).some((result) => result.status === 'failed' || result.status === 'timedOut'),
      );
      if (failed) {
        failures.push({ file: spec.file ?? '', title: [...titles, spec.title].join(' > ') });
      }
    }
    for (const child of suite.suites ?? []) walk(child, titles);
  };
  for (const suite of report.suites ?? []) walk(suite, []);
  return failures;
}

function collectE2e() {
  if (process.env.MOTA_WITH_EDITOR === '0') {
    throw new Error('refusing to record an e2e baseline with MOTA_WITH_EDITOR=0 (see plan 01-02 task notes)');
  }

  const e2e = {};
  for (const pkg of E2E_PACKAGES) {
    const reportPath = path.join(os.tmpdir(), 'gsd-baseline-e2e.json');
    fs.rmSync(reportPath, { force: true });
    const result = run(`pnpm --filter ${pkg} exec playwright test --reporter=json`, {
      PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath,
    });

    const report = readPlaywrightReport(reportPath, result.stdout);
    fs.rmSync(reportPath, { force: true });

    if (!report || !report.stats) {
      e2e[pkg] = {
        status: 'not-run',
        reason: compactOutput(result.stderr || result.stdout).slice(0, 600) || `playwright exit ${result.status}`,
      };
      continue;
    }

    const stats = report.stats;
    const passed = stats.expected ?? 0;
    const failed = stats.unexpected ?? 0;
    const flaky = stats.flaky ?? 0;
    const skipped = stats.skipped ?? 0;
    const total = passed + failed + flaky + skipped;

    if (total === 0 && Array.isArray(report.errors) && report.errors.length > 0) {
      e2e[pkg] = {
        status: 'not-run',
        reason: compactOutput(report.errors.map((item) => item.message ?? String(item)).join(' ')).slice(0, 600),
      };
      continue;
    }

    e2e[pkg] = { status: 'ran', passed, failed, flaky, skipped, total };
    if (failed > 0 || flaky > 0) {
      e2e[pkg].failedTests = collectFailedTests(report);
    }
    console.log(`e2e ${pkg}: ${passed} passed / ${failed} failed / ${skipped} skipped / ${total} total`);
  }
  return e2e;
}

// ==================== scope: screenshots ====================

function collectScreenshots() {
  const screenshots = {};
  const missing = [];
  for (const name of SCREENSHOT_NAMES) {
    const absolute = path.join(SCREENSHOTS_DIR, name);
    if (!fs.existsSync(absolute)) {
      missing.push(name);
      continue;
    }
    const bytes = fs.statSync(absolute).size;
    if (bytes === 0) {
      missing.push(`${name} (empty)`);
      continue;
    }
    screenshots[name] = { path: `screenshots/${name}`, bytes };
  }
  if (missing.length > 0) throw new Error(`missing or empty screenshot baselines: ${missing.join(', ')}`);
  return screenshots;
}

// ==================== 入口 ====================

function main() {
  const scope = process.argv[2];
  if (!['unit', 'build', 'e2e', 'screenshots'].includes(scope)) {
    console.error('Usage: node scripts/baseline/collect.js <unit|build|e2e|screenshots>');
    process.exit(2);
  }

  const blocks = readBaseline();
  blocks.git = collectEnvironment();
  blocks.protocol = collectProtocol();
  blocks.ciJobNames = CI_JOB_NAMES;
  blocks.envVars = ENV_VARS;

  if (scope === 'unit') blocks.unit = collectUnit();
  if (scope === 'build') blocks.build = collectBuild();
  if (scope === 'e2e') blocks.e2e = collectE2e();
  if (scope === 'screenshots') blocks.screenshots = collectScreenshots();

  writeBaseline(blocks);
  console.log(`Baseline written: ${path.relative(REPO_ROOT, BASELINE_PATH).replace(/\\/g, '/')}`);
}

try {
  main();
} catch (error) {
  console.error(`baseline collection failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
