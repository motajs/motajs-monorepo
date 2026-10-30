import { afterEach, describe, expect, it } from 'vitest';
import { createCoreHarness, FakeFileSystem } from '../../__tests__/fixtures';
import { EditorCore } from '../../core';

// 页面生命周期落盘点的测试：关闭页面时只有「有待写」才阻止卸载并弹浏览器原生确认，
// 页面即将卸载与窗口失焦各尽力发起一次写盘；释放外壳之后三条监听全部注销。
// 全部事件都挂在 window 上，绝不用 document（结构门禁覆盖 editor-core 含测试）。

/** 关闭页面与页面卸载用例共用的目标路径 */
const PATH = 'tables/demo.json';
/** 窗口失焦用例的目标路径 */
const OTHER_PATH = 'tables/other.json';
/** 磁盘上预置的旧内容 */
const OLD_CONTENT = '{"a":1}';
/** 写进缓冲的新内容 */
const NEW_CONTENT = '{"a":2}';

/** 当前用例装配出的编辑器内核，用例结束后统一释放 */
let active: EditorCore | null = null;

// 每个用例结束后释放编辑器，注销 window 监听器并清掉缓冲定时器，避免在用例之间累积
afterEach(async () => {
  const core = active;

  active = null;

  if (core !== null) await core.dispose();
});

/**
 * 在 window 上派发一次事件，并等一个宏任务让写盘链结算
 * @param type 事件名
 * @returns 派发出去的事件，供断言是否被阻止
 */
async function dispatchWindowEvent(type: string): Promise<Event> {
  const event = new Event(type, { cancelable: true });

  window.dispatchEvent(event);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  return event;
}

interface TestSystem {
  /** 已初始化的编辑器内核 */
  readonly core: EditorCore;
  /** 播种了旧内容的假文件系统，测试用它读原始磁盘内容 */
  readonly fs: FakeFileSystem;
}

// 组装一套已初始化的编辑器内核，并给两条路径播种旧内容
async function createSystem(): Promise<TestSystem> {
  const fs = new FakeFileSystem();

  fs.seed(PATH, OLD_CONTENT);
  fs.seed(OTHER_PATH, OLD_CONTENT);

  const core = await createCoreHarness(fs);

  active = core;
  return { core, fs };
}

describe('ShellSystem 页面生命周期', () => {
  // 有待写时关闭页面：事件被阻止，浏览器据此弹原生确认
  it('有待写时 beforeunload 事件被阻止', async () => {
    const system = await createSystem();

    await system.core.resourceSystem.writeContent(PATH, NEW_CONTENT);

    expect(system.core.resourceSystem.hasAnyPendingContent()).toBe(true);

    const event = await dispatchWindowEvent('beforeunload');

    expect(event.defaultPrevented).toBe(true);
  });

  // 无待写时关闭页面：不阻止，浏览器不弹确认
  it('无待写时 beforeunload 事件不被阻止', async () => {
    const system = await createSystem();

    expect(system.core.resourceSystem.hasAnyPendingContent()).toBe(false);

    const event = await dispatchWindowEvent('beforeunload');

    expect(event.defaultPrevented).toBe(false);
  });

  // 页面即将卸载：发起一次全量写盘，磁盘变成缓冲里的新值
  it('pagehide 事件发起一次全量写盘', async () => {
    const system = await createSystem();

    await system.core.resourceSystem.writeContent(PATH, NEW_CONTENT);

    await dispatchWindowEvent('pagehide');

    expect(await system.fs.readFile(PATH)).toBe(NEW_CONTENT);
    expect(system.core.resourceSystem.hasAnyPendingContent()).toBe(false);
  });

  // 窗口失焦：同样发起一次全量写盘
  it('窗口失焦事件发起一次全量写盘', async () => {
    const system = await createSystem();

    await system.core.resourceSystem.writeContent(OTHER_PATH, NEW_CONTENT);

    await dispatchWindowEvent('blur');

    expect(await system.fs.readFile(OTHER_PATH)).toBe(NEW_CONTENT);
    expect(system.core.resourceSystem.hasAnyPendingContent()).toBe(false);
  });

  // 释放外壳后再派发 pagehide：监听器已注销、磁盘保持旧值；随后手工写盘仍写得出，证明待写确实还在
  it('释放外壳后 pagehide 不再写盘', async () => {
    const system = await createSystem();

    await system.core.resourceSystem.writeContent(PATH, NEW_CONTENT);
    await system.core.shellSystem.dispose();

    await dispatchWindowEvent('pagehide');

    expect(await system.fs.readFile(PATH)).toBe(OLD_CONTENT);

    await system.core.resourceSystem.flushAllContent();

    expect(await system.fs.readFile(PATH)).toBe(NEW_CONTENT);
  });
});
