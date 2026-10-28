import { EditorEntryKind, IFileEntry } from '@motajs/editor-core';
import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { Button } from 'antd';
import { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { FileBrowser } from '../FileBrowser';

configure({ testIdAttribute: 'data-test-id' });

// 共用文件浏览器的行为契约：四个状态、面包屑导航、可换前缀与刷新不闪空态，共 14 条
afterEach(() => {
  cleanup();
});

/**
 * 造一个目录条目
 * @param path 目录完整路径
 * @returns 目录条目
 */
function directoryEntry(path: string): IFileEntry {
  return { path, name: path.slice(path.lastIndexOf('/') + 1), kind: EditorEntryKind.Directory };
}

/**
 * 造一个文件条目
 * @param path 文件完整路径
 * @returns 文件条目
 */
function fileEntry(path: string): IFileEntry {
  return { path, name: path.slice(path.lastIndexOf('/') + 1), kind: EditorEntryKind.File };
}

/**
 * 占位的打开回调：只关心列表渲染的用例用它满足必填契约
 */
function noopOpen(): void {}

/**
 * 造一个按路由表同步返回条目的读目录回调，并把每次请求的路径记下来
 * @param routes 目录路径到子条目的映射
 * @param requested 记录每次请求路径的数组
 * @returns 读目录回调
 */
function createLoader(
  routes: Record<string, readonly IFileEntry[]>,
  requested: string[],
): (path: string) => Promise<readonly IFileEntry[]> {
  return (path: string): Promise<readonly IFileEntry[]> => {
    requested.push(path);

    return Promise.resolve(routes[path] ?? []);
  };
}

describe('FileBrowser 的四种状态', () => {
  // 空目录：显示缺省文案与空态 test id，面包屑仍可导航、根目录没有 `..` 行
  it('空目录显示「该目录下没有文件」并保留面包屑', async () => {
    render(<FileBrowser directory="" loadChildren={createLoader({}, [])} onOpen={noopOpen} />);
    await act(async () => undefined);

    expect(screen.getByTestId('file-browser-empty').textContent).toBe('该目录下没有文件');
    expect(screen.getByTestId('file-browser-current').textContent).toBe('/');
    expect(screen.queryByTestId('file-browser-up')).toBeNull();
  });

  // 空态文案可由调用方覆盖（表格传「该目录下没有表格」）
  it('空态文案可由 emptyText 覆盖', async () => {
    render(
      <FileBrowser directory="" loadChildren={createLoader({}, [])} onOpen={noopOpen} emptyText="该目录下没有表格" />,
    );
    await act(async () => undefined);

    expect(screen.getByTestId('file-browser-empty').textContent).toBe('该目录下没有表格');
  });

  // 首次载入：先显示「正在读取目录…」，结果到达后换成行列表
  it('首次载入显示「正在读取目录…」，结果到达后变为行列表', async () => {
    const resolvers: Array<(entries: readonly IFileEntry[]) => void> = [];

    render(
      <FileBrowser
        directory=""
        loadChildren={(): Promise<readonly IFileEntry[]> =>
          new Promise((resolve) => {
            resolvers.push(resolve);
          })
        }
        onOpen={noopOpen}
      />,
    );

    expect(screen.getByTestId('file-browser-loading').textContent).toContain('正在读取目录…');

    await act(async () => {
      resolvers[0]([directoryEntry('content'), fileEntry('hero.json')]);
    });

    expect(screen.queryByTestId('file-browser-loading')).toBeNull();
    expect(screen.getByTestId('file-browser-entry-content')).not.toBeNull();
    expect(screen.getByTestId('file-browser-entry-hero.json')).not.toBeNull();
  });

  // 读取失败：显示缺省文案与「重试」，点重试后恢复行列表
  it('读取失败显示缺省文案与「重试」，重试成功后恢复行列表', async () => {
    let attempt = 0;
    const loader = async (): Promise<readonly IFileEntry[]> => {
      attempt += 1;

      if (attempt === 1) throw new Error('读取失败');

      return [fileEntry('hero.json')];
    };

    render(<FileBrowser directory="" loadChildren={loader} onOpen={noopOpen} />);
    await act(async () => undefined);

    expect(screen.getByTestId('file-browser-error').textContent).toContain('目录读取失败，请稍后重试。');
    expect(screen.getByTestId('file-browser-current').textContent).toBe('/');

    await act(async () => {
      fireEvent.click(screen.getByTestId('file-browser-retry'));
    });

    expect(screen.queryByTestId('file-browser-error')).toBeNull();
    expect(screen.getByTestId('file-browser-entry-hero.json')).not.toBeNull();
  });

  // 读取失败文案可由调用方覆盖，但「重试」按钮始终存在
  it('错误文案由 errorText 覆盖且「重试」按钮始终存在', async () => {
    const loader = async (): Promise<readonly IFileEntry[]> => {
      throw new Error('读取失败');
    };

    render(<FileBrowser directory="" loadChildren={loader} onOpen={noopOpen} errorText="读取目录出错" />);
    await act(async () => undefined);

    expect(screen.getByTestId('file-browser-error').textContent).toContain('读取目录出错');
    expect(screen.getByTestId('file-browser-retry')).not.toBeNull();
  });
});

describe('FileBrowser 的列表渲染', () => {
  // 典型目录：目录行与文件行用不同类名区分子重，每行 title 为完整路径
  it('目录行与文件行用类名区分，且 title 为完整路径', async () => {
    const loader = createLoader({ content: [directoryEntry('content/map'), fileEntry('content/hero.json')] }, []);

    render(<FileBrowser directory="content" loadChildren={loader} onOpen={noopOpen} />);
    await act(async () => undefined);

    const directoryRow = screen.getByTestId('file-browser-entry-content/map');

    expect(directoryRow.className).toContain('efb-row-directory');
    expect(directoryRow.getAttribute('title')).toBe('content/map');

    const fileRow = screen.getByTestId('file-browser-entry-content/hero.json');

    expect(fileRow.className).toContain('efb-row-file');
    expect(fileRow.getAttribute('title')).toBe('content/hero.json');
  });

  // filter 只影响文件行：目录行永不过滤，被过滤的文件不出现
  it('filter 只过滤文件，目录永远显示', async () => {
    const entries = [directoryEntry('content'), fileEntry('hero.json'), fileEntry('notes.txt')];
    const loader = (): Promise<readonly IFileEntry[]> => Promise.resolve(entries);

    render(
      <FileBrowser
        directory=""
        loadChildren={loader}
        onOpen={noopOpen}
        filter={(path): boolean => path.endsWith('.json')}
      />,
    );
    await act(async () => undefined);

    expect(screen.getByTestId('file-browser-entry-content')).not.toBeNull();
    expect(screen.getByTestId('file-browser-entry-hero.json')).not.toBeNull();
    expect(screen.queryByTestId('file-browser-entry-notes.txt')).toBeNull();
  });

  // 过滤后完全为空（含无子目录）时走空态，而不是空白框
  it('过滤后完全没有条目时显示空态', async () => {
    const loader = (): Promise<readonly IFileEntry[]> => Promise.resolve([fileEntry('notes.txt')]);

    render(
      <FileBrowser
        directory=""
        loadChildren={loader}
        onOpen={noopOpen}
        filter={(path): boolean => path.endsWith('.json')}
      />,
    );
    await act(async () => undefined);

    expect(screen.getByTestId('file-browser-empty')).not.toBeNull();
  });

  // `..` 行：子目录渲染并点击回父目录，回到根目录后消失
  it('`..` 行只在非根目录出现，点击回到父目录', async () => {
    const requested: string[] = [];
    const loader = createLoader({}, requested);

    render(<FileBrowser directory="content" loadChildren={loader} onOpen={noopOpen} />);
    await act(async () => undefined);

    const upRow = screen.getByTestId('file-browser-up');

    expect(upRow.getAttribute('title')).toBe('返回上级目录');

    await act(async () => {
      fireEvent.click(upRow);
    });

    expect(requested[requested.length - 1]).toBe('');
    expect(screen.queryByTestId('file-browser-up')).toBeNull();
  });

  // renderRowAction 渲染在行右侧的动作槽里（表格删除态用）
  it('renderRowAction 渲染在 {P}-row-action-{path} 插槽内', async () => {
    const loader = (): Promise<readonly IFileEntry[]> => Promise.resolve([fileEntry('hero.json')]);

    render(
      <FileBrowser
        directory=""
        loadChildren={loader}
        onOpen={noopOpen}
        renderRowAction={(): ReactNode => (
          <Button size="small" data-test-id="row-delete">
            删除
          </Button>
        )}
      />,
    );
    await act(async () => undefined);

    const slot = screen.getByTestId('file-browser-row-action-hero.json');

    expect(slot.querySelector('[data-test-id="row-delete"]')).not.toBeNull();
  });
});

describe('FileBrowser 的面包屑', () => {
  // 根段 / 中间段可点并导航到对应路径；当前段是非交互文本且标了 aria-current
  it('根段与中间段点击导航，当前段是带 aria-current 的非交互文本', async () => {
    const requested: string[] = [];
    const loader = createLoader({}, requested);

    render(<FileBrowser directory="content/map" loadChildren={loader} onOpen={noopOpen} />);
    await act(async () => undefined);

    const current = screen.getByTestId('file-browser-current');

    expect(current.textContent).toBe('map');
    expect(current.getAttribute('aria-current')).toBe('location');
    expect(current.tagName).not.toBe('BUTTON');

    await act(async () => {
      fireEvent.click(screen.getByTestId('file-browser-crumb-content'));
    });

    expect(requested[requested.length - 1]).toBe('content');

    await act(async () => {
      fireEvent.click(screen.getByTestId('file-browser-crumb-root'));
    });

    expect(requested[requested.length - 1]).toBe('');
  });

  // 面包屑每段的 title 为对应路径，长名称可据此揭示完整路径
  it('面包屑每段的 title 为对应路径', async () => {
    const loader = createLoader({}, []);

    render(<FileBrowser directory="content/map" loadChildren={loader} onOpen={noopOpen} />);
    await act(async () => undefined);

    expect(screen.getByTestId('file-browser-crumb-content').getAttribute('title')).toBe('content');
    expect(screen.getByTestId('file-browser-current').getAttribute('title')).toBe('content/map');
  });
});

describe('FileBrowser 的刷新与前缀', () => {
  // reloadToken 变化时重读当前目录，旧行保留到新结果到达，不闪空态 / 不闪加载态
  it('reloadToken 变化时重读并保留旧行直到新结果到达', async () => {
    const resolvers: Array<(entries: readonly IFileEntry[]) => void> = [];
    const loader = (): Promise<readonly IFileEntry[]> =>
      new Promise((resolve) => {
        resolvers.push(resolve);
      });
    const view = render(<FileBrowser directory="" loadChildren={loader} onOpen={noopOpen} reloadToken={0} />);

    await act(async () => {
      resolvers[0]([fileEntry('a.json')]);
    });

    expect(screen.getByTestId('file-browser-entry-a.json')).not.toBeNull();

    view.rerender(<FileBrowser directory="" loadChildren={loader} onOpen={noopOpen} reloadToken={1} />);

    expect(resolvers.length).toBe(2);
    expect(screen.getByTestId('file-browser-entry-a.json')).not.toBeNull();
    expect(screen.queryByTestId('file-browser-loading')).toBeNull();
    expect(screen.queryByTestId('file-browser-empty')).toBeNull();

    await act(async () => {
      resolvers[1]([fileEntry('b.json')]);
    });

    expect(screen.queryByTestId('file-browser-entry-a.json')).toBeNull();
    expect(screen.getByTestId('file-browser-entry-b.json')).not.toBeNull();
  });

  // testIdPrefix 可换：传 table-list 后全部 id 变成 table-list-*，缺省前缀不再出现
  it('testIdPrefix 换成 table-list 后全部 test id 跟着换', async () => {
    const loader = (): Promise<readonly IFileEntry[]> => Promise.resolve([fileEntry('a.json')]);

    render(<FileBrowser directory="content" loadChildren={loader} onOpen={noopOpen} testIdPrefix="table-list" />);
    await act(async () => undefined);

    expect(screen.getByTestId('table-list')).not.toBeNull();
    expect(screen.getByTestId('table-list-toolbar')).not.toBeNull();
    expect(screen.getByTestId('table-list-list')).not.toBeNull();
    expect(screen.getByTestId('table-list-reload')).not.toBeNull();
    expect(screen.getByTestId('table-list-up')).not.toBeNull();
    expect(screen.getByTestId('table-list-current').textContent).toBe('content');
    expect(screen.getByTestId('table-list-entry-a.json')).not.toBeNull();
    expect(screen.queryByTestId('file-browser')).toBeNull();
  });
});
