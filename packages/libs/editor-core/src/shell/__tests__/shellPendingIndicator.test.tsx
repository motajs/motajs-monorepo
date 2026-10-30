import { act, cleanup, configure, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCoreHarness, FakeFileSystem } from '../../__tests__/fixtures';
import { EditorCore } from '../../core';

// 右上角待写提示的四条语义：有 pending 才渲染一条固定文案；无 pending 不渲染任何元素（不是空串元素）；
// 写盘完成后提示消失；文案里绝不出现被写入的路径，避免把文件名泄露到界面。

configure({ testIdAttribute: 'data-test-id' });

/** 被写入的目标路径；最后一条用例用它验证提示文案不泄露路径 */
const TARGET_PATH = 'tables/demo.json';
/** 待写内容，只用来制造一条 pending */
const CONTENT = '{"a":1}';
/** 提示的固定文案，逐字取自 D-17 */
const PENDING_TEXT = '正在等待保存，请勿关闭页面或浏览器';

/** 当前用例装配出的编辑器内核，用例结束后统一释放 */
let active: EditorCore | null = null;

// 每个用例结束后卸载已挂载的组件、释放内核并恢复真定时器，避免 DOM 与悬挂定时器在用例之间累积
afterEach(async () => {
  cleanup();

  const core = active;

  active = null;

  if (core !== null) await core.dispose();

  vi.useRealTimers();
});

// 装配一套已初始化并已渲染外壳的编辑器内核
async function renderShell(): Promise<EditorCore> {
  const fs = new FakeFileSystem();
  const core = await createCoreHarness(fs);

  active = core;
  render(createElement(core.shellSystem.render()));
  return core;
}

describe('外壳右上角待写提示', () => {
  // 有任意路径待写时，菜单行末尾渲染提示元素，文本逐字等于固定文案
  it('有待写时渲染固定文案的提示元素', async () => {
    const core = await renderShell();

    await act(async () => {
      await core.resourceSystem.writeContent(TARGET_PATH, CONTENT);
    });

    expect(screen.getByTestId('editor-shell-pending').textContent).toBe(PENDING_TEXT);
  });

  // 缓冲为空时提示元素完全不渲染：queryByTestId 为 null，而不是一个空串元素
  it('无待写时不渲染任何提示元素', async () => {
    await renderShell();

    expect(screen.queryByTestId('editor-shell-pending')).toBeNull();
  });

  // 待写出现后立刻写盘，提示元素随缓冲清空一起消失
  it('写盘完成后提示元素消失', async () => {
    const core = await renderShell();

    await act(async () => {
      await core.resourceSystem.writeContent(TARGET_PATH, CONTENT);
    });

    expect(screen.queryByTestId('editor-shell-pending')).not.toBeNull();

    await act(async () => {
      await core.resourceSystem.flushAllContent();
    });

    expect(screen.queryByTestId('editor-shell-pending')).toBeNull();
  });

  // 提示只表达「有内容在等写盘」，文本里不出现被写入的路径，也不出现文件名
  it('提示文案不包含被写入的路径', async () => {
    const core = await renderShell();

    await act(async () => {
      await core.resourceSystem.writeContent(TARGET_PATH, CONTENT);
    });

    const text = screen.getByTestId('editor-shell-pending').textContent ?? '';

    expect(text).toBe(PENDING_TEXT);
    expect(text.includes(TARGET_PATH)).toBe(false);
    expect(text.includes('demo.json')).toBe(false);
  });
});
