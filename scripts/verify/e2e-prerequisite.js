#!/usr/bin/env node
/**
 * 证明 VERIFY-06 必需夹具的两种极性（`scripts/verify/e2e-prerequisite.js`）。
 *
 * 只证明「缺前置会失败」还不够：一个无条件抛错的夹具同样能通过那条断言。
 * 因此本脚本按顺序证明：
 *   1. 已 stage（默认配置，不设 MOTA_WITH_EDITOR）时，editor-dependent 测试必须
 *      **通过**（exit 0）——夹具在 release 存在时必须正常解析。
 *   2. 未 stage（`MOTA_WITH_EDITOR=0`）时，同一个测试必须**以具名消息**
 *      `Editor release is not staged` 失败（非零退出）——静默 skip 不能回来。
 *
 * 两次运行都设置 `CI=1`：`playwright.config.ts` 因此关闭 `reuseExistingServer`，
 * 每次都是全新构建 + 全新 preview server，未 stage 那次不会被上一次的服务器污染。
 *
 * 纯 Node ESM：只从仓库根运行、不导入任何 workspace 包、不安装依赖。
 */
import { spawn } from "node:child_process";
import process from "node:process";

const PLAYWRIGHT_TARGET = [
  "--filter",
  "@motajs/service-worker",
  "exec",
  "playwright",
  "test",
  "e2e/project-host.spec.ts",
  "--grep",
  "live Editor cache",
];

const NAMED_FAILURE = "Editor release is not staged";

/**
 * 运行一次 Playwright 并返回 { code, output }（stdout + stderr 合并）。
 * 不经过 shell 管道，避免第一段命令吞掉退出码。
 */
function runPlaywright(env) {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", PLAYWRIGHT_TARGET, {
      env,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, output }));
  });
}

/** 已 stage 极性的环境：CI=1，且显式去掉任何继承来的 MOTA_WITH_EDITOR 覆盖。 */
function stagedEnvironment() {
  const env = { ...process.env, CI: "1" };
  delete env.MOTA_WITH_EDITOR;
  return env;
}

const staged = await runPlaywright(stagedEnvironment());
if (staged.code !== 0) {
  console.error(
    `\n[e2e-prerequisite] staged polarity failed (exit ${staged.code}). The fixture threw even though a release should have been staged, or the editor-dependent test regressed. The combined output above is the cause.`,
  );
  process.exit(1);
}
console.log("\n[e2e-prerequisite] staged polarity passed (exit 0).");

const unstaged = await runPlaywright({ ...process.env, CI: "1", MOTA_WITH_EDITOR: "0" });
if (unstaged.code === 0) {
  console.error(
    "\n[e2e-prerequisite] unstaged polarity unexpectedly passed (exit 0): the silent-skip regression has returned — the test did not fail without a staged Editor release.",
  );
  process.exit(1);
}
if (!unstaged.output.includes(NAMED_FAILURE)) {
  console.error(
    `\n[e2e-prerequisite] unstaged polarity failed (exit ${unstaged.code}) for an unrecognised reason; expected the message "${NAMED_FAILURE}". The combined output above is the cause.`,
  );
  process.exit(1);
}

console.log(`\n[e2e-prerequisite] OK: staged run passed; unstaged run failed with "${NAMED_FAILURE}".`);
