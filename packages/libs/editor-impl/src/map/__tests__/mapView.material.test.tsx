import { cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapMaterialPanel } from '../components/MapMaterialPanel';
import {
  IMapDirections,
  IMapMaterialPanelProps,
  IMapTileEntry,
  IMapTileGroup,
  MapAutotileType,
  MapImageStatus,
  MapPaletteKind,
  MapTextureReadType,
  MapTileCategory,
} from '../types';

configure({ testIdAttribute: 'data-test-id' });

// 右侧素材区：分类导航、普通素材网格、Autotile 单格、帧数角标与缺图 / 加载 / 失败三态。
// 全部按受控 props 渲染真实组件；图片地址用假 blob 字符串，不读字节。

/**
 * 造一份四方向都可通行的通行属性
 * @returns 四方向都为 true 的通行属性
 */
function createDirections(): IMapDirections {
  return { up: true, right: true, down: true, left: true };
}

/**
 * 造一个图块条目；裁切矩形按「列 / 行 × 单格尺寸」推导
 * @param number 图块编号
 * @param column 图集列号
 * @param row 图集行号
 * @param cellWidth 素材单格宽
 * @param cellHeight 素材单格高
 * @returns 图块条目
 */
function createTile(number: number, column: number, row: number, cellWidth: number = 32, cellHeight: number = 32): IMapTileEntry {
  const directions = createDirections();

  return {
    number,
    column,
    row,
    crop: { x: column * cellWidth, y: row * cellHeight, width: cellWidth, height: cellHeight },
    name: `图块 ${number}`,
    pass: { out: directions, in: createDirections(), onlyEventLayer: false },
  };
}

/**
 * 造一个地形素材组：编号 1、2
 * @returns 地形分组
 */
function createTerrainGroup(): IMapTileGroup {
  return {
    id: 'group-terrain',
    name: '地形图集',
    imagePath: 'content/map/terrain.png',
    columns: 2,
    tiles: [createTile(1, 0, 0), createTile(2, 1, 0)],
    category: MapTileCategory.Terrain,
    read: MapTextureReadType.Grid,
    cellWidth: 32,
    cellHeight: 32,
    frames: 1,
  };
}

/**
 * 造一个横向动画素材组：单图块、3 帧
 * @returns 动画分组
 */
function createAnimateGroup(): IMapTileGroup {
  return {
    id: 'group-animate',
    name: '动画图集',
    imagePath: 'content/map/animate.png',
    columns: 3,
    tiles: [createTile(11, 0, 0)],
    category: MapTileCategory.Terrain,
    read: MapTextureReadType.RowAnimate,
    cellWidth: 32,
    cellHeight: 32,
    frames: 3,
  };
}

/**
 * 造一个敌人素材组：编号 101、102
 * @returns 敌人分组
 */
function createEnemyGroup(): IMapTileGroup {
  return {
    id: 'group-enemy',
    name: '敌人图集',
    imagePath: 'content/map/enemy.png',
    columns: 2,
    tiles: [createTile(101, 0, 0), createTile(102, 1, 0)],
    category: MapTileCategory.Enemy,
    read: MapTextureReadType.Grid,
    cellWidth: 32,
    cellHeight: 32,
    frames: 1,
  };
}

/**
 * 造一个 3×4 自动元件素材组：两帧、两个目录条目（只应渲染左上角那一格）
 * @returns 自动元件分组
 */
function createAutotileGroup(): IMapTileGroup {
  return {
    id: 'group-autotile',
    name: '自动元件图集',
    imagePath: 'content/map/autotile.png',
    columns: 2,
    tiles: [createTile(50, 0, 0, 64, 96), createTile(51, 1, 0, 64, 96)],
    category: MapTileCategory.Autotile,
    read: MapTextureReadType.Grid,
    cellWidth: 64,
    cellHeight: 96,
    frames: 2,
    autotile: { type: MapAutotileType.Big3x4, connections: [] },
  };
}

/**
 * 造一份素材区 props：默认给三组都可用的图片地址与状态
 * @param overrides 覆盖的 props
 * @returns 素材区 props
 */
function createProps(overrides: Partial<IMapMaterialPanelProps> = {}): IMapMaterialPanelProps {
  const groups = overrides.groups ?? [createTerrainGroup(), createAnimateGroup(), createEnemyGroup(), createAutotileGroup()];
  const groupUrls: Record<string, string | undefined> = {};
  const groupStatus: Record<string, MapImageStatus | undefined> = {};

  for (const group of groups) {
    groupUrls[group.id] = `blob:${group.id}`;
    groupStatus[group.id] = MapImageStatus.Ready;
  }

  return {
    groups,
    groupUrls,
    groupStatus,
    imageStatus: MapImageStatus.Ready,
    activeCategory: MapTileCategory.Terrain,
    tilesetOpen: false,
    selection: {
      kind: MapPaletteKind.Empty,
      pattern: { width: 1, height: 1, tiles: [0] },
      primaryTileNumber: 0,
    },
    showFrameCount: false,
    onSelectPattern: vi.fn(),
    onRetryImages: vi.fn(),
    onSelectCategory: vi.fn(),
    onToggleTileset: vi.fn(),
    onToggleFrameCount: vi.fn(),
    ...overrides,
  };
}

/**
 * 按 DOM 顺序取普通图块按钮的编号
 * @returns 图块按钮上的编号
 */
function tileNumbers(): readonly number[] {
  return screen
    .queryAllByTestId(/^map-tile-\d+$/)
    .map((button) => Number((button.dataset.testId ?? '').replace('map-tile-', '')));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('素材区分类导航', () => {
  // 五类按钮、Tileset 开关与「显示帧数」勾选框都在
  it('渲染五类导航、Tileset 开关与显示帧数勾选框', () => {
    render(<MapMaterialPanel {...createProps()} />);

    expect(screen.getByTestId('map-category-terrain')).not.toBeNull();
    expect(screen.getByTestId('map-category-enemy')).not.toBeNull();
    expect(screen.getByTestId('map-category-npc')).not.toBeNull();
    expect(screen.getByTestId('map-category-item')).not.toBeNull();
    expect(screen.getByTestId('map-category-autotile')).not.toBeNull();
    expect(screen.getByTestId('map-tileset-toggle')).not.toBeNull();
    expect(screen.getByTestId('map-frame-count')).not.toBeNull();
  });

  // 点分类把目标分类交回；点 Tileset 开关把新的展开状态交回
  it('点分类与 Tileset 开关各自上报目标值', () => {
    const onSelectCategory = vi.fn();
    const onToggleTileset = vi.fn();

    render(<MapMaterialPanel {...createProps({ onSelectCategory, onToggleTileset })} />);

    fireEvent.click(screen.getByTestId('map-category-enemy'));
    fireEvent.click(screen.getByTestId('map-tileset-toggle'));

    expect(onSelectCategory).toHaveBeenCalledWith(MapTileCategory.Enemy);
    expect(onToggleTileset).toHaveBeenCalledWith(true);
  });

  // 切换分类后只显示该分类的图块
  it('切换分类后只显示该类的图块', () => {
    const view = render(<MapMaterialPanel {...createProps()} />);

    expect(tileNumbers()).toEqual([1, 2, 11]);

    view.rerender(<MapMaterialPanel {...createProps({ activeCategory: MapTileCategory.Enemy })} />);

    expect(tileNumbers()).toEqual([101, 102]);
  });

  // 目录里没有普通素材时提示「暂无可用分类」；某类为空时提示「该分类暂无素材」
  it('目录为空与分类为空分别给出不同提示', () => {
    const view = render(<MapMaterialPanel {...createProps({ groups: [] })} />);

    expect(screen.getByTestId('map-material-empty').textContent).toBe('暂无可用分类');

    view.rerender(<MapMaterialPanel {...createProps({ activeCategory: MapTileCategory.Npc })} />);

    expect(screen.getByTestId('map-material-empty').textContent).toBe('该分类暂无素材');
  });
});

describe('素材区普通网格', () => {
  // Autotile 只渲染左上角一格，背景矩形是第一帧的完整素材格
  it('Autotile 只渲染一格且背景矩形是第一帧整格', () => {
    render(<MapMaterialPanel {...createProps({ activeCategory: MapTileCategory.Autotile })} />);

    expect(tileNumbers()).toEqual([50]);
    expect(screen.queryByTestId('map-tile-51')).toBeNull();

    const button = screen.getByTestId('map-tile-50');

    expect(button.getAttribute('data-frame-rect')).toBe('0,0,64,96');
    expect(button.style.backgroundPosition).toBe('0px 0px');
  });

  // 素材框是直角：内联圆角为 0
  it('素材框不带圆角', () => {
    render(<MapMaterialPanel {...createProps()} />);

    expect(['0', '0px']).toContain(screen.getByTestId('map-tile-1').style.borderRadius);
  });

  // 点图块把带正确编号的 1×1 图案交回
  it('点图块上报 1×1 图案', () => {
    const onSelectPattern = vi.fn();

    render(<MapMaterialPanel {...createProps({ onSelectPattern })} />);
    fireEvent.click(screen.getByTestId('map-tile-2'));

    expect(onSelectPattern).toHaveBeenCalledWith({
      kind: MapPaletteKind.Tiles,
      pattern: { width: 1, height: 1, tiles: [2] },
      primaryTileNumber: 2,
    });
  });

  // 显示帧数勾选框：关着不出角标；点一下把 true 交回，打开后角标出现；再点把 false 交回
  it('显示帧数勾选框驱动角标出现与消失', () => {
    const onToggleFrameCount = vi.fn();
    const view = render(<MapMaterialPanel {...createProps({ onToggleFrameCount })} />);

    expect(screen.queryByTestId('map-tile-frames-11')).toBeNull();

    fireEvent.click(screen.getByTestId('map-frame-count'));

    expect(onToggleFrameCount).toHaveBeenCalledWith(true);

    view.rerender(<MapMaterialPanel {...createProps({ showFrameCount: true, onToggleFrameCount })} />);

    expect(screen.getByTestId('map-tile-frames-11').textContent).toBe('3');
    expect(screen.queryByTestId('map-tile-frames-1')).toBeNull();

    fireEvent.click(screen.getByTestId('map-frame-count'));

    expect(onToggleFrameCount).toHaveBeenLastCalledWith(false);

    view.rerender(<MapMaterialPanel {...createProps({ showFrameCount: false, onToggleFrameCount })} />);

    expect(screen.queryByTestId('map-tile-frames-11')).toBeNull();
  });

  // 图片读取中：出现加载条，失败条不出现
  it('图片读取中显示加载条', () => {
    render(
      <MapMaterialPanel
        {...createProps({
          groupUrls: {},
          groupStatus: { 'group-terrain': MapImageStatus.Loading, 'group-animate': MapImageStatus.Loading },
          groups: [createTerrainGroup(), createAnimateGroup()],
        })}
      />,
    );

    expect(screen.getByTestId('map-material-loading').textContent).toContain('正在加载图块…');
    expect(screen.queryByTestId('map-material-error')).toBeNull();
  });

  // 图片全部失败：缺图占位仍在、失败条出现；点重试只回调重试
  it('图片失败显示占位与重试', () => {
    const onRetryImages = vi.fn();
    const onSelectPattern = vi.fn();

    render(
      <MapMaterialPanel
        {...createProps({
          groups: [createTerrainGroup()],
          groupUrls: {},
          groupStatus: { 'group-terrain': MapImageStatus.Error },
          onRetryImages,
          onSelectPattern,
        })}
      />,
    );

    expect(screen.getByTestId('map-material-error').textContent).toContain('图块加载失败');
    expect(screen.getByTestId('map-tile-1').getAttribute('data-missing')).toBe('true');

    fireEvent.click(screen.getByTestId('map-material-retry'));

    expect(onRetryImages).toHaveBeenCalledTimes(1);
    expect(onSelectPattern).not.toHaveBeenCalled();
  });
});
