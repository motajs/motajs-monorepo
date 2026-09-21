#!/usr/bin/env node
/**
 * PR CI 工作流结构自检脚本（VERIFY-02）。
 *
 * 用法：node scripts/verify/ci-workflow.js
 *
 * 断言的是「仓库设置必须引用的契约」与安全约束，而不是让脚本重新实现一个 YAML 解析器——
 * 全部断言建立在按缩进切出的结构片段上，绝不匹配整份文件的模糊子串：
 *   1. 触发器只有 pull_request 与 push 到 main；不含 workflow_dispatch、pull_request_target
 *      与 paths 过滤（任一都会让 required status check 永远无法满足，或把 secrets 暴露给 fork）；
 *   2. 恰好四个 job：lint / typecheck / unit / build，且各自调用对应的根 fan-out 脚本；
 *   3. submodules: recursive 只出现在 unit 与 build（lint/typecheck 不需要真实 mota-js 文件）；
 *   4. 每个 job 都声明 permissions: contents: read；
 *   5. 全文件不含 secrets 引用与 environment 绑定；
 *   6. 工具链固定值与 deploy-editor-h5test.yml 完全一致；
 *   7. build 在构建之前显式生成 styled-system；
 *   8. 顶层 concurrency 以 workflow + ref 为键并 cancel-in-progress: true。
 *
 * 不访问网络、不导入任何 workspace 包；只按文本读取工作流文件。
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ==================== 常量 ====================

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const WORKFLOW_PATH = path.join(REPO_ROOT, '.github', 'workflows', 'ci.yml');

/** 四个 job id 即仓库设置里 required status checks 引用的契约；改名会静默撤销门禁。 */
const JOB_IDS = ['lint', 'typecheck', 'unit', 'build'];

/** 每个 job 必须调用的根 fan-out 脚本。 */
const JOB_SCRIPTS = {
  lint: 'pnpm lint',
  typecheck: 'pnpm typecheck',
  unit: 'pnpm test',
  build: 'pnpm build',
};

/** 与 deploy-editor-h5test.yml 完全一致的工具链固定值。 */
const TOOLCHAIN_PINS = [
  ['actions/checkout@v4', '缺少 actions/checkout@v4'],
  ['pnpm/action-setup@v4', '缺少 pnpm/action-setup@v4'],
  ['12.5.1', 'pnpm 版本未固定为 12.5.1'],
  ['actions/setup-node@v4', '缺少 actions/setup-node@v4'],
  ['node-version: 24', 'Node 版本未固定为 24'],
  ['cache: pnpm', '未启用 pnpm 缓存'],
  ['pnpm install --frozen-lockfile', '缺少 --frozen-lockfile 安装'],
];

/** submodule 只允许出现在这两个 job。 */
const SUBMODULE_JOBS = ['unit', 'build'];

/** 允许的触发器键：其余一律视为门禁失效或泄露面扩大。 */
const ALLOWED_TRIGGERS = ['pull_request', 'push'];

/** 禁止出现的构造：任一命中即报告其对应的具体规则。 */
const FORBIDDEN = [
  [/pull_request_target/, 'pull_request_target 会让 fork 代码拿到仓库 secrets'],
  [/workflow_dispatch/, 'workflow_dispatch 无法满足 required status check'],
  [/^\s*paths:/m, 'paths 过滤会让 PR 永久停在「等待状态报告」'],
  [/^\s*paths-ignore:/m, 'paths-ignore 过滤会让 PR 永久停在「等待状态报告」'],
  [/\bsecrets\b/, '工作流引用了 secrets —— PR 门禁不得依赖任何 secret'],
  [/^\s*environment:/m, 'environment 绑定把部署环境与 PR 门禁混在一起'],
];

// ==================== 断言工具 ====================

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ==================== 结构切分（按缩进，不引入 YAML 依赖） ====================

/** 取 `key:` 之后、下一个顶格非空行为止的所有缩进行（空行保留跳过）。 */
function topLevelBlock(lines, key) {
  const headerPattern = new RegExp(`^${escapeRegExp(key)}:(?:\\s.*)?$`);
  const start = lines.findIndex((line) => headerPattern.test(line));
  if (start === -1) return null;
  const block = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (!/^\s/.test(line)) break;
    block.push(line);
  }
  return block;
}

/** 在给定缩进块里按「二级键」切分子块。 */
function splitByKey(block, keyPattern, makeEntry) {
  const entries = [];
  for (const line of block) {
    const match = keyPattern.exec(line);
    if (match) {
      entries.push(makeEntry(match));
      continue;
    }
    if (entries.length > 0 && line.trim() !== '') entries[entries.length - 1].body.push(line);
  }
  return entries;
}

function triggerEntries(lines) {
  const block = topLevelBlock(lines, 'on');
  if (!block) return null;
  return splitByKey(block, /^ {2}([A-Za-z0-9_]+):\s*(.*)$/, (match) => ({
    key: match[1],
    inline: match[2],
    body: [],
  }));
}

function jobEntries(lines) {
  const block = topLevelBlock(lines, 'jobs');
  if (!block) return null;
  return splitByKey(block, /^ {2}([A-Za-z0-9_-]+):\s*$/, (match) => ({ id: match[1], body: [] }));
}

/** 解析某触发器下 `branches:` 的取值（支持内联 `[main]` 与列表两种写法）；无该键返回 null。 */
function branchesOf(entry) {
  const candidateLines = entry.inline !== '' ? [`  ${entry.inline}`] : entry.body;
  for (let index = 0; index < candidateLines.length; index += 1) {
    const match = /^\s*branches:\s*(.*)$/.exec(candidateLines[index]);
    if (!match) continue;
    const rest = match[1].trim();
    if (rest.startsWith('[')) {
      return rest
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    if (rest !== '') return [rest];
    const items = [];
    for (let next = index + 1; next < candidateLines.length; next += 1) {
      const item = /^\s*-\s*(\S+)\s*$/.exec(candidateLines[next]);
      if (!item) break;
      items.push(item[1]);
    }
    return items;
  }
  return null;
}

// ==================== 断言：触发器 ====================

function checkTriggers(lines) {
  const entries = triggerEntries(lines);
  if (entries === null) {
    failures.push('缺少顶层 `on:` 触发器 —— 工作流不会被任何事件触发');
    return;
  }
  const keys = entries.map((entry) => entry.key);
  check(keys.includes('pull_request'), '缺少 pull_request 触发器 —— PR 不会运行这门禁');

  const unexpected = keys.filter((key) => !ALLOWED_TRIGGERS.includes(key));
  check(unexpected.length === 0, `出现了非预期触发器 ${unexpected.join('、')} —— 只允许 pull_request 与 push(main)`);

  const pushEntry = entries.find((entry) => entry.key === 'push');
  check(Boolean(pushEntry), '缺少 push 触发器 —— 合并进 main 的状态不受门禁保护');
  if (pushEntry) {
    const branches = branchesOf(pushEntry);
    if (branches === null) {
      failures.push('push 触发器未限定分支 —— 应在 branches 里只放 main');
    } else if (branches.length !== 1 || branches[0] !== 'main') {
      failures.push(`push 触发器限定的分支是 [${branches.join(', ')}]，应只有 main`);
    }
  }
}

// ==================== 断言：禁止构造 ====================

function checkForbiddenConstructs(text) {
  for (const [pattern, message] of FORBIDDEN) {
    check(!pattern.test(text), `含被禁止的构造：${message}`);
  }
}

// ==================== 断言：job 集合与内容 ====================

function runStepPattern(command) {
  return new RegExp(`(^|\\n)\\s*(?:-\\s*)?run:\\s*${escapeRegExp(command)}\\s*(?=\\n|$)`);
}

function checkJobs(lines) {
  const entries = jobEntries(lines);
  if (entries === null) {
    failures.push('缺少顶层 `jobs:` 块');
    return;
  }
  const ids = entries.map((entry) => entry.id);
  const missing = JOB_IDS.filter((id) => !ids.includes(id));
  const extra = ids.filter((id) => !JOB_IDS.includes(id));
  if (missing.length > 0 || extra.length > 0 || ids.length !== JOB_IDS.length) {
    const detail = [
      extra.length > 0 ? `多出 ${extra.join('、')}` : '',
      missing.length > 0 ? `缺少 ${missing.join('、')}` : '',
    ]
      .filter(Boolean)
      .join('；');
    failures.push(`job 集合应为 [${JOB_IDS.join(', ')}]，实际是 [${ids.join(', ')}]（${detail}）`);
  }

  for (const entry of entries) {
    const bodyText = entry.body.join('\n');
    check(/runs-on:\s*ubuntu-latest/.test(bodyText), `job ${entry.id} 未跑在 ubuntu-latest 上`);
    check(
      /permissions:/.test(bodyText) && /contents:\s*read/.test(bodyText),
      `job ${entry.id} 未声明 permissions: contents: read`,
    );

    const expectedScript = JOB_SCRIPTS[entry.id];
    if (expectedScript) {
      check(runStepPattern(expectedScript).test(bodyText), `job ${entry.id} 未调用对应的根脚本 ${expectedScript}`);
    }

    const needsSubmodule = SUBMODULE_JOBS.includes(entry.id);
    const hasSubmodule = /submodules:\s*recursive/.test(bodyText);
    if (needsSubmodule && !hasSubmodule) {
      failures.push(`job ${entry.id} 缺少 submodules: recursive —— 它运行时需要真实 mota-js 文件`);
    }
    if (!needsSubmodule && hasSubmodule) {
      failures.push(`job ${entry.id} 不应 checkout submodule —— 它不需要 mota-js 文件`);
    }

    for (const [pin, message] of TOOLCHAIN_PINS) {
      check(bodyText.includes(pin), `job ${entry.id} ${message}`);
    }
  }

  const build = entries.find((entry) => entry.id === 'build');
  if (build) {
    const bodyText = build.body.join('\n');
    const codegen = /pnpm --filter @motajs\/editor exec panda codegen/.exec(bodyText);
    check(Boolean(codegen), 'job build 缺少显式的 `pnpm --filter @motajs/editor exec panda codegen` 步骤');
    if (codegen) {
      const buildRun = runStepPattern('pnpm build').exec(bodyText);
      check(
        Boolean(buildRun) && codegen.index < buildRun.index,
        'job build 的 panda codegen 在构建之后 —— 必须先产出 styled-system 再构建',
      );
    }
  }
}

// ==================== 断言：并发策略 ====================

function checkConcurrency(lines) {
  const block = topLevelBlock(lines, 'concurrency');
  if (block === null) {
    failures.push('缺少顶层 concurrency 块 —— 同一 ref 的过期运行不会被取消');
    return;
  }
  const text = block.join('\n');
  check(/group:\s*\S+/.test(text), 'concurrency 缺少 group');
  check(
    /github\.workflow/.test(text) && /github\.ref/.test(text),
    'concurrency 的 group 未同时以 workflow 与 ref 为键',
  );
  check(/cancel-in-progress:\s*true/.test(text), 'concurrency 未设置 cancel-in-progress: true');
}

// ==================== 入口 ====================

function main() {
  if (!fs.existsSync(WORKFLOW_PATH)) {
    console.error(`ci-workflow: 找不到工作流 ${path.relative(REPO_ROOT, WORKFLOW_PATH).replace(/\\/g, '/')}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);

  checkTriggers(lines);
  checkForbiddenConstructs(raw);
  checkJobs(lines);
  checkConcurrency(lines);

  if (failures.length > 0) {
    failures.forEach((failure, index) => console.error(`ci-workflow: [${index + 1}] ${failure}`));
    process.exit(1);
  }
  console.log('ci-workflow: 全部断言通过（4 个 job 与工具链固定值一致，无 secrets/environment/paths）');
}

main();
