import { cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapEmptyState, IMapEmptyStateProps } from '../components/MapEmptyState';
import { IMapSummary, MapPanelStatus } from '../types';

configure({ testIdAttribute: 'data-test-id' });

// 首次打开面板的地图清单：加载 / 失败 / 无地图 / 未打开四态与内联清单。
// 组件只接 props，全部用例直接按受控 props 渲染。

/**
 * 造一份空态 props，可按用例覆盖个别字段
 * @param overrides 覆盖的 props
 * @returns 空态 props
 */
function createEmptyStateProps(overrides: Partial<IMapEmptyStateProps> = {}): IMapEmptyStateProps {
  const mapSummaries: readonly IMapSummary[] = [
    { id: 'm1', name: '地图一' },
    { id: 'm2', name: '地图二' },
  ];

  return {
    listStatus: MapPanelStatus.NotOpened,
    mapSummaries,
    canCreateMap: true,
    onSelectMap: vi.fn(),
    onOpenCreate: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('地图清单空态', () => {
  // 清单加载中：指示器 +「正在读取地图清单…」
  it('加载中显示正在读取地图清单', () => {
    render(<MapEmptyState {...createEmptyStateProps({ listStatus: MapPanelStatus.ListLoading })} />);

    expect(screen.getByTestId('map-empty').getAttribute('data-state')).toBe('loading');
    expect(screen.getByText('正在读取地图清单…')).not.toBeNull();
  });

  // 清单失败：破坏性标题 + 说明 + 重试；重试回调只上报一次
  it('清单失败显示标题说明与重试', () => {
    const onRetry = vi.fn();

    render(
      <MapEmptyState
        {...createEmptyStateProps({ listStatus: MapPanelStatus.ListError, error: '目录不可读', onRetry })}
      />,
    );

    expect(screen.getByTestId('map-empty').getAttribute('data-state')).toBe('error');
    expect(screen.getByText('地图清单读取失败')).not.toBeNull();
    expect(screen.getByText('请稍后重试。')).not.toBeNull();

    fireEvent.click(screen.getByTestId('map-empty-retry'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // 无地图：固定文案 + 新建入口，不渲染空列表
  it('无地图时给出提示与新建入口且没有空列表', () => {
    render(<MapEmptyState {...createEmptyStateProps({ listStatus: MapPanelStatus.NoMaps, mapSummaries: [] })} />);

    expect(screen.getByTestId('map-empty').getAttribute('data-state')).toBe('empty');
    expect(screen.getByText('项目中还没有地图')).not.toBeNull();
    expect(screen.getByText('点击「新建地图」创建第一张地图。')).not.toBeNull();
    expect(screen.queryByTestId('map-empty-list')).toBeNull();
  });

  // 有条目未打开：标题 + 正文 + 可滚动清单
  it('有条目未打开时显示标题正文与清单', () => {
    render(<MapEmptyState {...createEmptyStateProps()} />);

    expect(screen.getByTestId('map-empty').getAttribute('data-state')).toBe('list');
    expect(screen.getByText('尚未打开地图')).not.toBeNull();
    expect(screen.getByText('从下方列表选择一张地图开始编辑，或新建一张地图。')).not.toBeNull();
    expect(screen.getByTestId('map-empty-list').className).toContain('emap-empty-list');
  });

  // 点清单条目把正确的 mapId 交回
  it('点清单条目回报对应的地图标识', () => {
    const onSelectMap = vi.fn();

    render(<MapEmptyState {...createEmptyStateProps({ onSelectMap })} />);
    fireEvent.click(screen.getByTestId('map-empty-item-m2'));

    expect(onSelectMap).toHaveBeenCalledWith('m2');
  });

  // 地图名过长时按钮 title 暴露全名
  it('地图名过长时 title 等于全名', () => {
    const longName = '一张名字很长很长需要省略显示的地图';

    render(<MapEmptyState {...createEmptyStateProps({ mapSummaries: [{ id: 'm-long', name: longName }] })} />);

    expect(screen.getByTestId('map-empty-item-m-long').getAttribute('title')).toBe(longName);
  });

  // 宿主没有新建能力：清单态的新建按钮禁用且不触发回调
  it('无新建能力时清单态新建按钮禁用且不回调', () => {
    const onOpenCreate = vi.fn();

    render(<MapEmptyState {...createEmptyStateProps({ canCreateMap: false, onOpenCreate })} />);

    const button = screen.getByTestId<HTMLButtonElement>('map-empty-create');

    expect(button.disabled).toBe(true);
    expect(button.title).toBe('当前项目不支持新建地图。');

    fireEvent.click(button);

    expect(onOpenCreate).not.toHaveBeenCalled();
  });

  // 宿主没有新建能力：无地图态的新建按钮同样禁用且不触发回调
  it('无新建能力时无地图态新建按钮禁用且不回调', () => {
    const onOpenCreate = vi.fn();

    render(
      <MapEmptyState
        {...createEmptyStateProps({
          listStatus: MapPanelStatus.NoMaps,
          mapSummaries: [],
          canCreateMap: false,
          onOpenCreate,
        })}
      />,
    );

    const button = screen.getByTestId<HTMLButtonElement>('map-empty-create');

    expect(button.disabled).toBe(true);

    fireEvent.click(button);

    expect(onOpenCreate).not.toHaveBeenCalled();
  });
});
