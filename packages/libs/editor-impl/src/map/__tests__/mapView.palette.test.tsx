import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapPalette, IMapPaletteProps } from '../components/MapPalette';
import {
  IMapDirections,
  IMapPaletteSelection,
  IMapTileEntry,
  IMapTileGroup,
  MapImageStatus,
  MapPaletteKind,
} from '../types';

configure({ testIdAttribute: 'data-test-id' });

// 图块调色板：三段结构、缺图占位、同组多格框选与最近使用分区。
// 组件只接 props，全部用例直接按受控 props 渲染；图片地址用假 blob 串，不做真实 I/O。

/**
 * 造一份四方向都可通行的通行属性
 * @returns 四方向都为 true 的通行属性
 */
function createDirections(): IMapDirections {
  return { up: true, right: true, down: true, left: true };
}

/**
 * 造一个图块条目，裁切矩形按「列 / 行 × 32 像素」推导
 * @param number 图块编号
 * @param column 图集列号
 * @param row 图集行号
 * @returns 图块条目
 */
function createTile(number: number, column: number, row: number): IMapTileEntry {
  return {
    number,
    column,
    row,
    crop: { x: column * 32, y: row * 32, width: 32, height: 32 },
    name: `草地${number}`,
    pass: { out: createDirections(), in: createDirections(), onlyEventLayer: false },
  };
}

/**
 * 造一个 2 × 2 的分组：编号 1..4
 * @param id 分组标识
 * @param name 分组名
 * @returns 两行两列的完整矩形分组
 */
function createSquareGroup(id: string, name: string): IMapTileGroup {
  return {
    id,
    name,
    imagePath: `content/map/${id}.png`,
    columns: 2,
    tiles: [createTile(1, 0, 0), createTile(2, 1, 0), createTile(3, 0, 1), createTile(4, 1, 1)],
  };
}

/**
 * 造一个 2 列 × 3 行的分组：编号 1..6
 * @returns 六格的完整矩形分组
 */
function createTallGroup(): IMapTileGroup {
  return {
    id: 'group-tall',
    name: '高分组',
    imagePath: 'content/map/tall.png',
    columns: 2,
    tiles: [
      createTile(1, 0, 0),
      createTile(2, 1, 0),
      createTile(3, 0, 1),
      createTile(4, 1, 1),
      createTile(5, 0, 2),
      createTile(6, 1, 2),
    ],
  };
}

/**
 * 造一个中间缺一格的分组：编号 1..5，缺 (1, 1)
 * @returns 带缺格的分组
 */
function createHoledGroup(): IMapTileGroup {
  return {
    id: 'group-holed',
    name: '缺角分组',
    imagePath: 'content/map/holed.png',
    columns: 2,
    tiles: [createTile(1, 0, 0), createTile(2, 1, 0), createTile(3, 0, 1), createTile(5, 0, 2), createTile(6, 1, 2)],
  };
}

/**
 * 造一个单行八格的分组：编号 1..8，供最近使用用例取图块
 * @returns 八格分组
 */
function createWideGroup(): IMapTileGroup {
  const tiles = [1, 2, 3, 4, 5, 6, 7, 8].map((number) => createTile(number, number - 1, 0));

  return { id: 'group-wide', name: '宽分组', imagePath: 'content/map/wide.png', columns: 8, tiles };
}

/**
 * 造一份 1×1 的图块选中
 * @param number 图块编号
 * @returns 1×1 选中
 */
function createTileSelection(number: number): IMapPaletteSelection {
  return {
    kind: MapPaletteKind.Tiles,
    pattern: { width: 1, height: 1, tiles: [number] },
    primaryTileNumber: number,
  };
}

/**
 * 造一份调色板 props，可按用例覆盖个别字段
 * @param overrides 覆盖的 props
 * @returns 调色板 props
 */
function createPaletteProps(overrides: Partial<IMapPaletteProps> = {}): IMapPaletteProps {
  return {
    groups: [
      createSquareGroup('group-a', '分组 A'),
      { ...createSquareGroup('group-b', '分组 B'), tiles: [createTile(5, 0, 0), createTile(6, 1, 0)] },
    ],
    groupUrls: {
      'group-a': 'blob:group-a',
      'group-b': 'blob:group-b',
      'group-tall': 'blob:group-tall',
      'group-holed': 'blob:group-holed',
      'group-wide': 'blob:group-wide',
    },
    groupStatus: {
      'group-a': MapImageStatus.Ready,
      'group-b': MapImageStatus.Ready,
      'group-tall': MapImageStatus.Ready,
      'group-holed': MapImageStatus.Ready,
      'group-wide': MapImageStatus.Ready,
    },
    imageStatus: MapImageStatus.Ready,
    selection: {
      kind: MapPaletteKind.Empty,
      pattern: { width: 1, height: 1, tiles: [0] },
      primaryTileNumber: 0,
    },
    recentTiles: [],
    recentStatus: MapImageStatus.Ready,
    onSelectPattern: vi.fn(),
    onRetryImages: vi.fn(),
    onClearRecent: vi.fn(),
    ...overrides,
  };
}

/**
 * 按 DOM 顺序取最近使用分区里的图块编号
 * @returns 最近使用按钮上的编号
 */
function recentButtonNumbers(): readonly number[] {
  const buttons = screen.queryAllByTestId(/^map-recent-/);

  return buttons
    .map((button) => button.dataset.testId ?? '')
    .filter((id) => /^map-recent-\d+$/.test(id))
    .map((id) => Number(id.replace('map-recent-', '')));
}

/**
 * 把一次框选完整走一遍：按下 → 移动到 → 松开
 * @param fromTestId 起点图块的 test id
 * @param toTestId 终点图块的 test id
 */
function dragBetween(fromTestId: string, toTestId: string): void {
  fireEvent.pointerDown(screen.getByTestId(fromTestId));
  fireEvent.pointerMove(screen.getByTestId(toTestId));
  fireEvent.pointerUp(screen.getByTestId(toTestId));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('图块调色板骨架', () => {
  // 目录为空：只留擦除格与空态文案，渲染不出任何图块按钮
  it('目录为空时显示暂无可用的图块且没有图块按钮', () => {
    render(<MapPalette {...createPaletteProps({ groups: [] })} />);

    expect(screen.getByTestId('map-palette-empty').textContent).toBe('暂无可用的图块');
    expect(screen.queryAllByTestId(/^map-tile-/).length).toBe(0);
    expect(screen.getByTestId('map-palette-erase')).not.toBeNull();
  });

  // 两个分组：两个标题都渲染，默认全部展开
  it('两个分组渲染两个标题且默认展开', () => {
    render(<MapPalette {...createPaletteProps()} />);

    expect(screen.getByTestId('map-palette-group-0').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('map-palette-group-1').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('map-tile-1')).not.toBeNull();
    expect(screen.getByTestId('map-tile-5')).not.toBeNull();
  });

  // 点分组标题折叠：aria-expanded 变 false，该组图块从 DOM 消失
  it('点分组标题折叠后该组图块消失', () => {
    render(<MapPalette {...createPaletteProps()} />);

    fireEvent.click(screen.getByTestId('map-palette-group-0'));

    expect(screen.getByTestId('map-palette-group-0').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('map-tile-1')).toBeNull();
    expect(screen.getByTestId('map-tile-5')).not.toBeNull();
  });

  // 图块按钮的可访问名与 title 逐字为「图块 {名称}（编号 {编号}）」
  it('图块的可访问名与 title 都是图块名称加编号', () => {
    render(<MapPalette {...createPaletteProps()} />);

    const button = screen.getByTestId('map-tile-1');

    expect(button.getAttribute('aria-label')).toBe('图块 草地1（编号 1）');
    expect(button.getAttribute('title')).toBe('图块 草地1（编号 1）');
  });

  // 缺图的分组：图块带 data-missing 与固定提示，但仍可点击选中
  it('缺图图块带占位标记与提示且仍可选择', () => {
    const onSelectPattern = vi.fn();

    render(
      <MapPalette
        {...createPaletteProps({
          groupUrls: { 'group-a': 'blob:group-a' },
          groupStatus: { 'group-a': MapImageStatus.Ready, 'group-b': MapImageStatus.Error },
          onSelectPattern,
        })}
      />,
    );

    const broken = screen.getByTestId('map-tile-5');

    expect(broken.getAttribute('data-missing')).toBe('true');
    expect(broken.getAttribute('title')).toContain('该图块的图片不可用');
    expect(screen.getByTestId('map-tile-1').getAttribute('data-missing')).toBe('false');

    fireEvent.click(broken);

    expect(onSelectPattern).toHaveBeenCalledWith(createTileSelection(5));
  });

  // 点图块把 1×1 图案与主编号交回，不自己存选中
  it('点图块回调带正确编号的 1×1 图案', () => {
    const onSelectPattern = vi.fn();

    render(<MapPalette {...createPaletteProps({ onSelectPattern })} />);
    fireEvent.click(screen.getByTestId('map-tile-2'));

    expect(onSelectPattern).toHaveBeenCalledWith({
      kind: MapPaletteKind.Tiles,
      pattern: { width: 1, height: 1, tiles: [2] },
      primaryTileNumber: 2,
    });
  });

  // 擦除格的 aria-pressed 随选中变化：空选中为 true，选中图块后为 false
  it('擦除格的按下态跟随当前选中', () => {
    const view = render(<MapPalette {...createPaletteProps()} />);

    expect(screen.getByTestId('map-palette-erase').getAttribute('aria-pressed')).toBe('true');

    view.rerender(<MapPalette {...createPaletteProps({ selection: createTileSelection(2) })} />);

    expect(screen.getByTestId('map-palette-erase').getAttribute('aria-pressed')).toBe('false');
  });

  // 空分组展开后显示固定文案
  it('空分组展开显示该分组暂无图块', () => {
    const emptyGroup: IMapTileGroup = {
      id: 'group-empty',
      name: '空分组',
      imagePath: 'content/map/empty.png',
      columns: 1,
      tiles: [],
    };

    render(<MapPalette {...createPaletteProps({ groups: [createSquareGroup('group-a', '分组 A'), emptyGroup] })} />);

    expect(screen.getByText('该分组暂无图块')).not.toBeNull();
  });

  // 图片读取中：分组标题仍在，网格位置显示指示器与固定文案，且没有图块按钮
  it('图片读取中显示指示器与正在加载文案', () => {
    render(<MapPalette {...createPaletteProps({ imageStatus: MapImageStatus.Loading })} />);

    const loading = screen.getByTestId('map-palette-loading');

    expect(loading.textContent).toContain('正在加载图块…');
    expect(loading.querySelector('.ant-spin')).not.toBeNull();
    expect(screen.getByTestId('map-palette-group-0')).not.toBeNull();
    expect(screen.queryAllByTestId(/^map-tile-/).length).toBe(0);
  });

  // 全部图片失败：破坏性标题 + 重试；重试只上报，不触发选择（落笔不受图片状态影响）
  it('图片全部失败显示失败标题与重试按钮', () => {
    const onRetryImages = vi.fn();
    const onSelectPattern = vi.fn();

    render(
      <MapPalette
        {...createPaletteProps({
          groupUrls: {},
          groupStatus: { 'group-a': MapImageStatus.Error, 'group-b': MapImageStatus.Error },
          imageStatus: MapImageStatus.Error,
          onRetryImages,
          onSelectPattern,
        })}
      />,
    );

    expect(screen.getByTestId('map-palette-error').textContent).toContain('图块加载失败');

    fireEvent.click(screen.getByTestId('map-palette-retry'));

    expect(onRetryImages).toHaveBeenCalledTimes(1);
    expect(onSelectPattern).not.toHaveBeenCalled();
  });

  // 重试按钮不会顺带改选中：只回调一次、选中回调零次、不弹清除确认
  it('点重试只回调重试且不改变选中', () => {
    const onRetryImages = vi.fn();
    const onSelectPattern = vi.fn();

    render(
      <MapPalette
        {...createPaletteProps({
          groupUrls: {},
          imageStatus: MapImageStatus.Error,
          onRetryImages,
          onSelectPattern,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('map-palette-retry'));

    expect(onRetryImages).toHaveBeenCalledTimes(1);
    expect(onSelectPattern).not.toHaveBeenCalled();
    expect(screen.queryByTestId('map-recent-clear-dialog')).toBeNull();
  });
});

describe('调色板多格框选', () => {
  // 组内拖出 2×3：图案宽高与行主序编号都对
  it('组内拖出 2×3 生成对应图案', () => {
    const onSelectPattern = vi.fn();

    render(<MapPalette {...createPaletteProps({ groups: [createTallGroup()], onSelectPattern })} />);
    dragBetween('map-tile-1', 'map-tile-6');

    expect(onSelectPattern).toHaveBeenCalledWith({
      kind: MapPaletteKind.Tiles,
      pattern: { width: 2, height: 3, tiles: [1, 2, 3, 4, 5, 6] },
      primaryTileNumber: 1,
    });
  });

  // 拖到别的分组上不生效：图案始终夹在起点分组范围内
  it('拖到组外被夹取在起点分组内', () => {
    const onSelectPattern = vi.fn();

    render(<MapPalette {...createPaletteProps({ onSelectPattern })} />);
    fireEvent.pointerDown(screen.getByTestId('map-tile-1'));
    fireEvent.pointerMove(screen.getByTestId('map-tile-6'));
    fireEvent.pointerMove(screen.getByTestId('map-tile-4'));
    fireEvent.pointerUp(screen.getByTestId('map-tile-4'));

    const selection = onSelectPattern.mock.calls[0][0] as IMapPaletteSelection;

    expect(selection.pattern.width).toBe(2);
    expect(selection.pattern.height).toBe(2);
    expect(selection.pattern.tiles).toEqual([1, 2, 3, 4]);
  });

  // 框选过程中显示尺寸标签，释放后消失
  it('框选过程中显示宽高尺寸标签', () => {
    render(<MapPalette {...createPaletteProps({ groups: [createTallGroup()] })} />);

    fireEvent.pointerDown(screen.getByTestId('map-tile-1'));
    fireEvent.pointerMove(screen.getByTestId('map-tile-6'));

    expect(screen.getByTestId('map-palette-select-size').textContent).toBe('2×3');

    fireEvent.pointerUp(screen.getByTestId('map-tile-6'));

    expect(screen.queryByTestId('map-palette-select-size')).toBeNull();
  });

  // 单击（没有拖动）保持 1×1，不产生多格选择
  it('单击不产生多格选择', () => {
    const onSelectPattern = vi.fn();

    render(<MapPalette {...createPaletteProps({ onSelectPattern })} />);
    fireEvent.click(screen.getByTestId('map-tile-3'));

    expect(onSelectPattern).toHaveBeenCalledWith({
      kind: MapPaletteKind.Tiles,
      pattern: { width: 1, height: 1, tiles: [3] },
      primaryTileNumber: 3,
    });
  });

  // 选中「空」：种类为擦除、图案固定 1×1 全 0
  it('选中空时图案为 1×1 全 0', () => {
    const onSelectPattern = vi.fn();

    render(<MapPalette {...createPaletteProps({ onSelectPattern })} />);
    fireEvent.click(screen.getByTestId('map-palette-erase'));

    expect(onSelectPattern).toHaveBeenCalledWith({
      kind: MapPaletteKind.Empty,
      pattern: { width: 1, height: 1, tiles: [0] },
      primaryTileNumber: 0,
    });
  });

  // 组内缺格：图案里对应位置是 0，其余位置按列 / 行查表
  it('组内缺格在图案里是 0', () => {
    const onSelectPattern = vi.fn();

    render(<MapPalette {...createPaletteProps({ groups: [createHoledGroup()], onSelectPattern })} />);
    dragBetween('map-tile-1', 'map-tile-6');

    expect(onSelectPattern).toHaveBeenCalledWith({
      kind: MapPaletteKind.Tiles,
      pattern: { width: 2, height: 3, tiles: [1, 2, 3, 0, 5, 6] },
      primaryTileNumber: 1,
    });
  });
});

describe('调色板最近使用', () => {
  // 没有记录：显示两句连排空态文案，下方分组图块不受影响
  it('没有记录时显示两句空态文案', () => {
    render(<MapPalette {...createPaletteProps({ groups: [createWideGroup()] })} />);

    expect(screen.getByTestId('map-recent-empty').textContent).toBe(
      '暂无最近使用的图块。在画布上绘制后，用过的图块会出现在这里。',
    );
    expect(screen.getByTestId('map-tile-1')).not.toBeNull();
  });

  // 八条记录：只渲染八个按钮，顺序与传入列表一致
  it('有记录时按传入顺序渲染全部条目', () => {
    render(
      <MapPalette {...createPaletteProps({ groups: [createWideGroup()], recentTiles: [3, 1, 8, 2, 7, 4, 6, 5] })} />,
    );

    expect(recentButtonNumbers()).toEqual([3, 1, 8, 2, 7, 4, 6, 5]);
  });

  // 目录里已不存在的编号不渲染（面板过滤后传入，组件再兜一层）
  it('目录里不存在的编号不渲染', () => {
    render(<MapPalette {...createPaletteProps({ groups: [createWideGroup()], recentTiles: [2, 99, 1] })} />);

    expect(recentButtonNumbers()).toEqual([2, 1]);
    expect(screen.queryByTestId('map-recent-99')).toBeNull();
  });

  // 点最近使用条目：种类为最近使用，图案 1×1
  it('点最近使用条目回调对应编号', () => {
    const onSelectPattern = vi.fn();

    render(<MapPalette {...createPaletteProps({ groups: [createWideGroup()], recentTiles: [5], onSelectPattern })} />);

    fireEvent.click(screen.getByTestId('map-recent-5'));

    expect(onSelectPattern).toHaveBeenCalledWith({
      kind: MapPaletteKind.Recent,
      pattern: { width: 1, height: 1, tiles: [5] },
      primaryTileNumber: 5,
    });
  });

  // 清除记录：必须经确认弹窗；确认回调一次，取消不再回调
  it('清除记录经确认弹窗且取消不生效', async () => {
    const onClearRecent = vi.fn();

    render(<MapPalette {...createPaletteProps({ groups: [createWideGroup()], recentTiles: [1], onClearRecent })} />);

    fireEvent.click(screen.getByTestId('map-recent-clear'));

    await waitFor(() => expect(screen.getByTestId('map-recent-clear-dialog')).not.toBeNull());
    expect(screen.getByTestId('map-recent-clear-dialog').textContent).toBe(
      '将清空本项目的最近使用记录，此操作不可撤销。',
    );

    fireEvent.click(screen.getByTestId('map-recent-clear-cancel'));

    await waitFor(() => expect(screen.queryByTestId('map-recent-clear-dialog')).toBeNull());

    expect(onClearRecent).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('map-recent-clear'));
    await waitFor(() => expect(screen.getByTestId('map-recent-clear-dialog')).not.toBeNull());
    fireEvent.click(screen.getByTestId('map-recent-clear-confirm'));

    await waitFor(() => expect(screen.queryByTestId('map-recent-clear-dialog')).toBeNull());

    expect(onClearRecent).toHaveBeenCalledTimes(1);
  });

  // 没有记录时清除按钮禁用
  it('没有记录时清除按钮禁用', () => {
    render(<MapPalette {...createPaletteProps({ groups: [createWideGroup()] })} />);

    expect(screen.getByTestId<HTMLButtonElement>('map-recent-clear').disabled).toBe(true);
  });
});
