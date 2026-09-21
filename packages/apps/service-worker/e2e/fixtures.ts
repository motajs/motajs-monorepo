/**
 * service-worker e2e 共享夹具。
 *
 * `editorRelease` 是一个**具名（非 auto）**夹具，用来替代原先的静默 skip
 * （D-16：缺前置必须 fail，而不是静默通过）。它读取 service worker 的
 * `editor.status` 消息——也就是 ProjectView 在渲染 `open-editor` 之前读取的
 * 同一个 `GetEditorHostStatusMessage`（`"editor.status"`）。该状态是全局 SW
 * 状态，在首页 `/` 就能读到，不需要先注册工程；因此夹具成功 ⟺ `open-editor`
 * 具备出现的条件。
 *
 * 具体做法与仓库既有的 `project-host.spec.ts#registerOpfsProject` 一致：
 * 等待 `navigator.serviceWorker.ready`（若页面尚未被控制则等待
 * `controllerchange`），取 controller，post `[requestId, "editor.status", null]`，
 * 等待 `[requestId, "editor.status", payload]` 回复。回复缺失或 `status !== "ready"`
 * 时抛出具名错误，并给出精确的补救命令。
 *
 * 绝不能依赖 `open-editor` 这个 test id 来判断是否已 stage：它只由
 * `ProjectView` 在 `service/:id/project/` 渲染，在 `/` 上无论是否 stage 都不存在。
 */
import { test as base, expect, type Page } from '@playwright/test';

export interface EditorReleaseFixture {
  buildId: string;
}

interface EditorHostStatusReply {
  status: string;
  buildId?: string;
  reason?: string;
  message?: string;
}

/** `editor.status` 回复的上限等待时间：无响应的 SW 必须让夹具失败而不是挂起。 */
const EDITOR_STATUS_TIMEOUT_MS = 30_000;

/** 缺失前置时给出的精确补救命令。 */
const EDITOR_RELEASE_REMEDIATION = 'pnpm --filter @motajs/service-worker build:with-editor';

/** 在应用根路由读取 service worker 的 `editor.status`（全局状态，与工程无关）。 */
async function readEditorStatus(page: Page, timeoutMs: number): Promise<EditorHostStatusReply | undefined> {
  await page.goto('/');
  return await page.evaluate(async (limit): Promise<EditorHostStatusReply | undefined> => {
    const reply = new Promise<unknown>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error(`editor.status did not answer within ${limit}ms`)), limit);
      const finish = (value: unknown) => {
        window.clearTimeout(timer);
        resolve(value);
      };
      const fail = (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      };
      void (async () => {
        try {
          const registration = await navigator.serviceWorker.ready;
          if (!navigator.serviceWorker.controller) {
            await new Promise<void>((resolveControl) =>
              navigator.serviceWorker.addEventListener('controllerchange', () => resolveControl(), { once: true }),
            );
          }
          const controller = navigator.serviceWorker.controller ?? registration.active;
          if (!controller) {
            fail(new Error('Service Worker did not activate'));
            return;
          }
          const requestId = Date.now();
          navigator.serviceWorker.addEventListener('message', function listener(event) {
            const [id, type, payload] = event.data ?? [];
            if (id !== requestId || type !== 'editor.status') return;
            navigator.serviceWorker.removeEventListener('message', listener);
            if (payload instanceof Error) fail(payload);
            else finish(payload);
          });
          controller.postMessage([requestId, 'editor.status', null]);
        } catch (error) {
          fail(error);
        }
      })();
    });
    return (await reply) as EditorHostStatusReply | undefined;
  }, timeoutMs);
}

export const test = base.extend<{ editorRelease: EditorReleaseFixture }>({
  // 第二个参数（Playwright 文档里的 `use`）在这里命名为 `provide`，避免
  // `react-hooks/rules-of-hooks` 把这个普通回调误判成 React Hook。
  editorRelease: async ({ page }, provide, testInfo) => {
    // 记录本次运行的配置，让报告里能直接看出 MOTA_WITH_EDITOR 的取值。
    testInfo.annotations.push({
      type: 'mota-with-editor',
      description: process.env.MOTA_WITH_EDITOR ?? '(unset — a staged Editor release is required)',
    });

    const status = await readEditorStatus(page, EDITOR_STATUS_TIMEOUT_MS);
    if (!status || status.status !== 'ready') {
      const detail = status
        ? `${status.status}${status.reason ? ` / ${status.reason}` : ''}${status.message ? `: ${status.message}` : ''}`
        : 'no reply from the service worker';
      // 缺失前置 = 失败，绝不是 skip。`MOTA_WITH_EDITOR=0` 也不是逃生舱。
      throw new Error(`Editor release is not staged (${detail}). Run \`${EDITOR_RELEASE_REMEDIATION}\` and retry.`);
    }
    await provide({ buildId: status.buildId ?? '' });
  },
});

export { expect };
