import { act, cleanup, configure, fireEvent, render } from '@testing-library/react';
import { EditorEntryKind, IFileEntry } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableCreateForm } from '..';

configure({ testIdAttribute: 'data-test-id' });

// 新建表格表单的组件级用例：确认入口（新建按钮 / 名称输入）在渲染顺序上先于目录浏览器，
// 且既有新建行为（目录行切换、去空白名称回调）保持不变。

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(cleanup);

// 取容器内按 data-test-id 定位的元素；缺失时抛错，避免断言落空
function testId(container: HTMLElement, id: string): Element {
  const element = container.querySelector(`[data-test-id="${id}"]`);

  if (element === null) throw new Error(`元素缺失: ${id}`);

  return element;
}

// 当前目录的直接子条目：一个子目录与一个数据文件，供表单渲染目录区
function sampleEntries(): IFileEntry[] {
  return [
    { path: 'sub', name: 'sub', kind: EditorEntryKind.Directory },
    { path: 'a.json', name: 'a.json', kind: EditorEntryKind.File },
  ];
}

// 判断 first 是否在文档顺序上位于 second 之前（本用例的「顶部」即此先后关系）
function precedes(first: Element, second: Element): boolean {
  return (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

describe('新建表格表单确认入口位置', () => {
  // 确认入口（新建按钮）在目录浏览器之上
  it('确认入口（新建按钮）在目录浏览器之上', () => {
    const onNavigate = vi.fn();
    const onCreate = vi.fn();
    const { container } = render(
      createElement(TableCreateForm, { directory: '', entries: sampleEntries(), onNavigate, onCreate }),
    );

    const createButton = testId(container, 'table-list-create');
    const location = testId(container, 'table-create-location');

    expect(precedes(createButton, location)).toBe(true);
  });

  // 点开后名称输入同样在目录浏览器之上
  it('点开后名称输入也在目录浏览器之上', () => {
    const onNavigate = vi.fn();
    const onCreate = vi.fn();
    const { container } = render(
      createElement(TableCreateForm, { directory: '', entries: sampleEntries(), onNavigate, onCreate }),
    );

    act(() => {
      fireEvent.click(testId(container, 'table-list-create'));
    });

    const input = testId(container, 'table-list-create-input');
    const location = testId(container, 'table-create-location');

    expect(precedes(input, location)).toBe(true);
  });

  // 既有行为不变：目录行点击经 onNavigate；回车按去空白名称回调 onCreate
  it('既有行为不变：目录行点击经 onNavigate、回车按去空白名回调 onCreate', () => {
    const onNavigate = vi.fn();
    const onCreate = vi.fn();
    const { container } = render(
      createElement(TableCreateForm, { directory: '', entries: sampleEntries(), onNavigate, onCreate }),
    );

    act(() => {
      fireEvent.click(testId(container, 'table-list-entry-sub'));
    });

    expect(onNavigate).toHaveBeenCalledWith('sub');

    act(() => {
      fireEvent.click(testId(container, 'table-list-create'));
    });

    const input = testId(container, 'table-list-create-input');

    act(() => {
      fireEvent.change(input, { target: { value: '  hero  ' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(onCreate).toHaveBeenCalledWith('', 'hero');
  });
});
