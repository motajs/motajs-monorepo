import { PanelCloseChoice } from '@motajs/editor-core';
import { cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExternalChangeDialog } from '../ExternalChangeDialog';
import { PanelCloseDialog } from '../PanelCloseDialog';
import panelDialogsCss from '../panel-dialogs.css?inline';

configure({ testIdAttribute: 'data-test-id' });

// 两个共享面板弹窗的可见状态与回调：保存中 / 保存失败 / 超长原因 / 关闭三态 / 冲突两选项，共五条
afterEach(() => {
  cleanup();
});

/**
 * 不做任何事的关闭选择回调：只关心渲染的用例用它满足必填契约
 */
function ignoreChoice(): void {}

describe('PanelCloseDialog', () => {
  // 保存中：三个按钮全部禁用，主按钮文案换成「正在保存…」并带进度圈
  it('保存中三个按钮禁用且主按钮显示「正在保存…」', () => {
    render(<PanelCloseDialog open saving onChoose={ignoreChoice} />);

    expect(screen.getByTestId<HTMLButtonElement>('panel-close-save').disabled).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('panel-close-discard').disabled).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('panel-close-cancel').disabled).toBe(true);
    expect(screen.getByTestId('panel-close-save').textContent).toContain('正在保存…');
    expect(screen.getByTestId('panel-close-save').querySelector('.ant-spin')).not.toBeNull();
  });

  // 保存失败：错误行显示「保存失败：{原因}」，三个按钮恢复可用
  it('保存失败时显示错误行并恢复按钮可用', () => {
    render(<PanelCloseDialog open error="磁盘已满" onChoose={ignoreChoice} />);

    expect(screen.getByTestId('panel-close-error').textContent).toBe('保存失败：磁盘已满');
    expect(screen.getByTestId<HTMLButtonElement>('panel-close-save').disabled).toBe(false);
    expect(screen.getByTestId<HTMLButtonElement>('panel-close-discard').disabled).toBe(false);
    expect(screen.getByTestId<HTMLButtonElement>('panel-close-cancel').disabled).toBe(false);
  });

  // 超长失败原因完整留在 DOM 里，且样式表用 overflow-wrap 兜底（jsdom 不算布局，读 CSS 原文）
  it('超长失败原因完整渲染且样式以 overflow-wrap 兜底', () => {
    const reason = '磁盘已满'.repeat(50);

    render(<PanelCloseDialog open error={reason} onChoose={ignoreChoice} />);

    expect(screen.getByTestId('panel-close-error').textContent).toBe(`保存失败：${reason}`);
    expect(panelDialogsCss).toMatch(/\.edlg-note\s*\{[^}]*overflow-wrap:\s*anywhere/);
    expect(panelDialogsCss).toMatch(/\.edlg-error\s*\{[^}]*overflow-wrap:\s*anywhere/);
  });

  // 三个按钮分别回传 Save / Discard / Cancel
  it('三个按钮分别回传 Save / Discard / Cancel', () => {
    const onChoose = vi.fn();

    render(<PanelCloseDialog open onChoose={onChoose} />);

    fireEvent.click(screen.getByTestId('panel-close-save'));
    fireEvent.click(screen.getByTestId('panel-close-discard'));
    fireEvent.click(screen.getByTestId('panel-close-cancel'));

    expect(onChoose.mock.calls).toEqual([
      [PanelCloseChoice.Save],
      [PanelCloseChoice.Discard],
      [PanelCloseChoice.Cancel],
    ]);
  });
});

describe('ExternalChangeDialog', () => {
  // 两个选项分别回传 onDiscard / onKeep，且弹窗里没有第三个按钮
  it('两个选项分别回传 onDiscard / onKeep 且没有第三个按钮', () => {
    const onDiscard = vi.fn();
    const onKeep = vi.fn();

    render(<ExternalChangeDialog open onDiscard={onDiscard} onKeep={onKeep} />);

    expect(screen.getByTestId('panel-conflict-discard').textContent).toBe('放弃我的改动并刷新');
    expect(screen.getByTestId('panel-conflict-keep').textContent).toBe('保留我的改动，下次保存覆盖');
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByTestId('panel-conflict-cancel')).toBeNull();

    fireEvent.click(screen.getByTestId('panel-conflict-discard'));

    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onKeep).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('panel-conflict-keep'));

    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
