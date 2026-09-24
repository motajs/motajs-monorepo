#!/usr/bin/env node
/**
 * Phase 4 shim 清单与「唯一 new 点」门禁的两极性证明（D-10 / D-06 / T-04-02 / T-04-04 / T-04-13）。
 *
 * 用法：node scripts/verify/editorShims.js
 *
 * 断言的是「门禁真的会响」，而不是「配置文件写对了」：
 *   (a) 清单非空且精确 —— `packages/apps/editor/src` 下带 `// SHIM(phase4)` 标记的文件集合，必须
 *       **恰好等于**硬编码的 `EXPECTED_SHIMS`（本阶段创建的 17 个逐文件转发 shim 加 `src/appInstances.ts`）。
 *       集合相等而非「包含」是关键：新加一个 shim 必须是一次有意的改动，删掉一个 shim 会被立刻发现——
 *       这份清单是 Phase 11 删除清单的唯一来源（T-04-13）。
 *   (b) 只转发 —— 除 `APP_INSTANCE_MODULE`（组合根-lite，天然会构造）外，每个标记文件必须含至少一条
 *       re-export（`export { … } from` / `export type { … } from` / `export * from`），且不含
 *       `new Xxx`、`class`、`function`（shim 一旦长出实现就不再属于干净的删除类别）。
 *   (c) 唯一 new 点 —— 扫描 editor 全部源文件（去注释后）的四种构造形式
 *       `new FileHandlerManager(` / `new FileHandlerManagerClass(` / `new PersistenceMonitor(` /
 *       `new OperationHistory(`：每个命中都必须在 `src/appInstances.ts`，且命中总数**恰好三个**
 *       （每个去单例化的类一次）。「恰好」而非「至少」是关键：零命中（空转）不能通过（T-04-02/T-04-04）。
 *   (d) 两极性（Phase 2 的教训：无法失败的 verifier 与没有 verifier 不可区分）——
 *       (i) 临时写入一个只有标记、没有 re-export 的 fixture，只转发检查必须报错；
 *       (ii) 临时写入一个在 `src/appInstances.ts` 之外构造 `PersistenceMonitor` 的 fixture，
 *       唯一 new 点检查必须报错。两个 fixture 都在 `finally` 里删除，随后断言文件确实不存在。
 *
 * 注释剥离说明：构造点扫描与「只转发」检查都先剥掉行注释与块注释再匹配——注释里写构造调用是文档、
 * 不是构造点；不剥离就会把「恰好三个」误判为四个。
 *
 * 不访问网络、不导入任何 workspace 包；只读文件系统。
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ==================== 常量 ====================

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const EDITOR_SRC = path.join(REPO_ROOT, 'packages', 'apps', 'editor', 'src');
const EDITOR_SRC_REL = 'packages/apps/editor/src';

/** shim 标记；Phase 11 的删除清单由它枚举。 */
const MARKER = '// SHIM(phase4)';

/** 唯一允许构造三个实例的模块（组合根-lite），它豁免「只转发」检查。 */
const APP_INSTANCE_MODULE = 'packages/apps/editor/src/appInstances.ts';

/** 本阶段创建的 17 个逐文件 shim 加组合根-lite 模块（共 18），是本门禁的精确清单。 */
const EXPECTED_SHIMS = [
  'packages/apps/editor/src/appInstances.ts',
  'packages/apps/editor/src/fs/BinaryFileHandler.ts',
  'packages/apps/editor/src/fs/ContentUtils.ts',
  'packages/apps/editor/src/fs/DataHandler.ts',
  'packages/apps/editor/src/fs/errors.ts',
  'packages/apps/editor/src/fs/FileHandler.ts',
  'packages/apps/editor/src/fs/FileHandlerManager.ts',
  'packages/apps/editor/src/fs/interfaces.ts',
  'packages/apps/editor/src/fs/JsonDataHandler.ts',
  'packages/apps/editor/src/fs/PersistenceMonitor.ts',
  'packages/apps/editor/src/fs/PersistExecutor.ts',
  'packages/apps/editor/src/fs/types.ts',
  'packages/apps/editor/src/project/history/operationHistory.ts',
  'packages/apps/editor/src/project/history/operations.ts',
  'packages/apps/editor/src/project/resources.ts',
  'packages/apps/editor/src/utils/action.ts',
  'packages/apps/editor/src/utils/base/signal.ts',
  'packages/apps/editor/src/utils/fieldPath.ts',
];

/** 去单例化后的四种构造形式；总数必须恰好三个（每个类一次）。 */
const CONSTRUCTION_FORMS = [
  'new FileHandlerManager(',
  'new FileHandlerManagerClass(',
  'new PersistenceMonitor(',
  'new OperationHistory(',
];
const EXPECTED_CONSTRUCTION_TOTAL = 3;

/** 只转发文件必须出现至少一条 re-export。 */
const REEXPORT_PATTERN = /export\s+(?:type\s+)?(?:\{[^}]*\}|\*)\s*from\s*['"]/;

/** 字符串/模板态的收尾字符。 */
const CLOSING_QUOTES = { single: "'", double: '"', template: '`' };

/** fixture 路径（脚本创建、脚本删除，绝不入库）。 */
const FORWARD_FIXTURE = path.join(EDITOR_SRC, '__shimForwardOnlyProbe__.ts');
const NEW_SITE_FIXTURE = path.join(EDITOR_SRC, '__shimNewSiteProbe__.ts');

const FORWARD_FIXTURE_SOURCE = [
  '// SHIM(phase4)',
  '/**',
  ' * 合成违规 fixture：带标记但没有 re-export（editorShims.js 创建与删除，绝不入库）。',
  ' */',
  '',
].join('\n');

const NEW_SITE_FIXTURE_SOURCE = [
  '/**',
  ' * 合成违规 fixture：在 appInstances 之外构造实例（editorShims.js 创建与删除，绝不入库）。',
  ' */',
  'export const offendingInstance = new PersistenceMonitor();',
  '',
].join('\n');

// ==================== 断言工具 ====================

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function relative(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, '/');
}

/** 递归收集目录下全部 .ts/.tsx 源文件（相对路径用正斜杠）。 */
function collectSources(dir) {
  const results = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        results.push({ relPath: relative(full), source: fs.readFileSync(full, 'utf8') });
      }
    }
  };
  walk(dir);
  results.sort((left, right) => left.relPath.localeCompare(right.relPath));
  return results;
}

/**
 * 剥离行注释与块注释（保留换行，便于定位）。
 *
 * 用一个小状态机，避免字符串/模板里的 `//`（例如 URL）被误当注释。字符串/模板态原样保留内容，
 * 并跳过转义字符——`\` 后的字符不参与收尾判定。
 */
function stripComments(source) {
  let out = '';
  let state = 'code';
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (state === 'code') {
      if (char === '/' && next === '/') {
        state = 'line';
        index += 1;
        continue;
      }
      if (char === '/' && next === '*') {
        state = 'block';
        index += 1;
        continue;
      }
      if (char === "'") state = 'single';
      else if (char === '"') state = 'double';
      else if (char === '`') state = 'template';
      out += char;
      continue;
    }
    if (state === 'line') {
      if (char === '\n') {
        state = 'code';
        out += char;
      }
      continue;
    }
    if (state === 'block') {
      if (char === '*' && next === '/') {
        state = 'code';
        index += 1;
      } else if (char === '\n') {
        out += char;
      }
      continue;
    }
    out += char;
    if (char === '\\') {
      if (next !== undefined) {
        out += next;
        index += 1;
      }
      continue;
    }
    if (CLOSING_QUOTES[state] === char) state = 'code';
  }
  return out;
}

// ==================== (a) 标记清单 ====================

function collectMarkedFiles(sources) {
  return sources.filter((file) => file.source.includes(MARKER));
}

function checkShimInventory(marked) {
  const expected = [...EXPECTED_SHIMS].sort();
  const actual = marked.map((file) => file.relPath).sort();
  check(actual.length > 0, `${MARKER} 清单为空 —— 门禁空转`);
  const missing = expected.filter((item) => !actual.includes(item));
  const unexpected = actual.filter((item) => !expected.includes(item));
  check(missing.length === 0, `缺少带 ${MARKER} 标记的预期 shim：${missing.join('、')}`);
  check(unexpected.length === 0, `出现了未登记的 ${MARKER} 标记文件：${unexpected.join('、')}`);
  console.log(`editorShims: 标记清单与 EXPECTED_SHIMS 精确一致（${actual.length} 个文件）`);
}

// ==================== (b) 只转发 ====================

function forwardOnlyFailures(marked) {
  const found = [];
  for (const file of marked) {
    if (file.relPath === APP_INSTANCE_MODULE) continue;
    const code = stripComments(file.source);
    if (!REEXPORT_PATTERN.test(code)) {
      found.push(`${file.relPath} 不是仅转发：找不到 re-export（需 export { … } from / export type { … } from）`);
    }
    if (/\bnew\s+[A-Z]/.test(code)) found.push(`${file.relPath} 不是仅转发：含构造调用`);
    if (/\bclass\s/.test(code)) found.push(`${file.relPath} 不是仅转发：含 class 声明`);
    if (/\bfunction\s/.test(code)) found.push(`${file.relPath} 不是仅转发：含 function 声明`);
  }
  return found;
}

function checkForwardOnly(marked) {
  const found = forwardOnlyFailures(marked);
  for (const failure of found) check(false, failure);
  console.log(`editorShims: ${marked.length - 1} 个转发 shim 均为仅转发（无 new/class/function）`);
}

// ==================== (c) 唯一 new 点 ====================

function scanConstructionSites(sources) {
  const hits = [];
  for (const file of sources) {
    const code = stripComments(file.source);
    for (const form of CONSTRUCTION_FORMS) {
      let index = code.indexOf(form);
      while (index !== -1) {
        hits.push({ relPath: file.relPath, form });
        index = code.indexOf(form, index + form.length);
      }
    }
  }
  return hits;
}

function constructionFailures(hits) {
  const found = [];
  const offenders = hits.filter((hit) => hit.relPath !== APP_INSTANCE_MODULE);
  if (offenders.length > 0) {
    found.push(
      `存在 ${offenders.length} 个位于 ${APP_INSTANCE_MODULE} 之外的构造点：` +
        offenders.map((hit) => `${hit.relPath} → ${hit.form}`).join(' | '),
    );
  }
  if (hits.length !== EXPECTED_CONSTRUCTION_TOTAL) {
    found.push(
      `构造点总数应为 ${EXPECTED_CONSTRUCTION_TOTAL}（每个去单例化的类一次），实际 ${hits.length}：` +
        hits.map((hit) => `${hit.relPath} → ${hit.form}`).join(' | '),
    );
  }
  return found;
}

function checkConstructionSites(sources) {
  const found = constructionFailures(scanConstructionSites(sources));
  for (const failure of found) check(false, failure);
  console.log(
    `editorShims: 唯一 new 点成立（构造点恰好 ${EXPECTED_CONSTRUCTION_TOTAL} 个，且都在 ${APP_INSTANCE_MODULE}）`,
  );
}

// ==================== (d) 两极性 ====================

function checkTwoPolarity() {
  try {
    // (i) 带标记但只有注释、没有 re-export 的 fixture：只转发检查必须报错。
    fs.writeFileSync(FORWARD_FIXTURE, FORWARD_FIXTURE_SOURCE, 'utf8');
    const forwardLocal = forwardOnlyFailures(collectMarkedFiles(collectSources(EDITOR_SRC)));
    check(forwardLocal.length > 0, '两极性 (i) 失败：带标记但不转发的 fixture 未让「只转发」检查报错');

    // (ii) 在 appInstances 之外构造实例的 fixture：唯一 new 点检查必须报错。
    fs.writeFileSync(NEW_SITE_FIXTURE, NEW_SITE_FIXTURE_SOURCE, 'utf8');
    const siteLocal = constructionFailures(scanConstructionSites(collectSources(EDITOR_SRC)));
    check(siteLocal.length > 0, '两极性 (ii) 失败：appInstances 之外的构造 fixture 未让「唯一 new 点」检查报错');
  } finally {
    fs.rmSync(FORWARD_FIXTURE, { force: true });
    fs.rmSync(NEW_SITE_FIXTURE, { force: true });
  }
  check(!fs.existsSync(FORWARD_FIXTURE), `只转发 fixture 未被删除：${relative(FORWARD_FIXTURE)}`);
  check(!fs.existsSync(NEW_SITE_FIXTURE), `唯一 new 点 fixture 未被删除：${relative(NEW_SITE_FIXTURE)}`);
  console.log('editorShims: 两极性成立（不转发 fixture 与越界构造 fixture 均被拦下，且已删除）');
}

// ==================== 入口 ====================

function main() {
  if (!fs.existsSync(EDITOR_SRC)) {
    console.error(`editorShims: 找不到 ${EDITOR_SRC_REL} —— 无法验证 shim 清单`);
    process.exit(1);
  }

  const sources = collectSources(EDITOR_SRC);
  check(sources.length > 0, `没有扫描到任何 ${EDITOR_SRC_REL}/**/*.{ts,tsx} —— 门禁无从生效`);
  const marked = collectMarkedFiles(sources);

  checkShimInventory(marked);
  checkForwardOnly(marked);
  checkConstructionSites(sources);
  checkTwoPolarity();

  if (failures.length > 0) {
    for (const failure of failures) console.error(`editorShims: ${failure}`);
    process.exit(1);
  }
  console.log(
    `editorShims: 全部断言通过（${marked.length} 个标记文件与 EXPECTED_SHIMS 精确一致、转发 shim 仅转发、` +
      `唯一 new 点恰好 ${EXPECTED_CONSTRUCTION_TOTAL} 个、两极性 fixture 均被拦下并删除）`,
  );
}

main();
