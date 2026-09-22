#!/usr/bin/env node
/**
 * PKG-04 验证脚本（N-07）。
 *
 * 用法：node scripts/verify/corePandaClass.js
 *
 * 断言的是「提取产物」而不是配置文本：跑一次真实的 `panda cssgen`，要求输出 CSS 含探针的
 * config 稳定原子 class `.display_block { display: block`。
 *
 * `panda.config.ts` 的 `syntax: 'template-literal'` 关闭了简写与前缀、`hash: false` 关闭哈希，
 * 因此类名只由属性与取值决定、与配置稳定（实测目标；D-10 更正的 `.display_block`，非 `.d_block`）。
 * 绝不断言 `panda.config.ts` 的源码，也绝不断言含动态值/自定义样式的哈希 class。
 *
 * 不访问网络；只跑编辑器侧已安装的 PandaCSS CLI。输出文件是可丢弃的（node_modules/.tmp 下），
 * 脚本结束时删除。stderr 里的 browserslist 提示不是失败——只有退出码与提取产物算数。
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ==================== 常量 ====================

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const EDITOR_DIR = path.join(REPO_ROOT, 'packages', 'apps', 'editor');

/** 可丢弃的提取产物：node_modules 已被 gitignore，脚本读完即删。 */
const OUTFILE = path.join(EDITOR_DIR, 'node_modules', '.tmp', 'core-panda.css');

/** 探针的 config 稳定原子 class（实测：syntax template-literal + hash false）。 */
const EXPECTED_CLASS = /\.display_block\s*\{\s*display:\s*block/;

// ==================== 断言工具 ====================

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function relative(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, '/');
}

function trimDetail(text) {
  return (text ?? '').trim().replace(/\s+/g, ' ').slice(-300);
}

// ==================== PandaCSS CLI 定位 ====================

/** 不经过 pnpm：从编辑器目录解析 @pandacss/dev 的 manifest，再取 bin.panda 拼出 CLI。 */
function resolvePandaBin() {
  const require = createRequire(path.join(EDITOR_DIR, 'package.json'));
  let packageJsonPath;
  try {
    packageJsonPath = require.resolve('@pandacss/dev/package.json');
  } catch (error) {
    return { error: `无法解析 @pandacss/dev/package.json：${error.message}` };
  }
  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    return { error: `无法读取 ${relative(packageJsonPath)}：${error.message}` };
  }
  const relativeBin = packageJson.bin?.panda;
  if (typeof relativeBin !== 'string') {
    return { error: '@pandacss/dev 的 bin 字段里没有 panda —— 无法定位 CLI' };
  }
  return { binPath: path.resolve(path.dirname(packageJsonPath), relativeBin) };
}

// ==================== 入口 ====================

function main() {
  const panda = resolvePandaBin();
  if (panda.error) {
    console.error(`corePandaClass: ${panda.error}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUTFILE), { recursive: true });
  // 先删旧产物：确保后面读到的一定是本次提取的输出，而不是上一次的残留。
  fs.rmSync(OUTFILE, { force: true });

  const result = spawnSync(process.execPath, [panda.binPath, 'cssgen', '-o', OUTFILE], {
    cwd: EDITOR_DIR,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  try {
    if (result.error) {
      check(false, `无法运行 panda cssgen：${result.error.message}`);
    } else {
      check(result.status === 0, `panda cssgen 退出码 ${result.status}（stderr：${trimDetail(result.stderr)}）`);
      const extracted = fs.existsSync(OUTFILE) ? fs.readFileSync(OUTFILE, 'utf8') : null;
      check(extracted !== null, `panda cssgen 未产出 ${relative(OUTFILE)}`);
      if (extracted !== null) {
        const matched = EXPECTED_CLASS.test(extracted);
        check(
          matched,
          `提取产物里没有探针的 config 稳定原子 class（期望匹配 ${EXPECTED_CLASS}，产物 ${extracted.length} 字节）`,
        );
        if (matched) {
          console.log(`corePandaClass: 提取产物包含 .display_block { display: block（产物 ${extracted.length} 字节）`);
        }
      }
    }
  } finally {
    fs.rmSync(OUTFILE, { force: true });
  }
  check(!fs.existsSync(OUTFILE), `可丢弃的提取产物未被删除：${relative(OUTFILE)}`);

  if (failures.length > 0) {
    for (const failure of failures) console.error(`corePandaClass: ${failure}`);
    process.exit(1);
  }
  console.log('corePandaClass: 全部断言通过（PandaCSS 提取覆盖 core 且产出 .display_block）');
}

main();
