import { ReactElement } from 'react';
import { IMapCategoryNavProps, MapTileCategory } from '../types';

// 右侧素材区的分类导航：地形 / 敌人 / 人物 / 物品 / 自动元件 / Tileset 六类同一排，放不下自动换行。
// 只吃 props（当前分类与选择回调），不持有状态、不读目录、不生成图片地址。

/** 分类导航里的一项：分类、显示名与拼进 data-test-id 的稳定标识 */
interface IMapCategoryNavItem {
  /** 该按钮代表的素材分类 */
  readonly category: MapTileCategory;
  /** 按钮上的显示名 */
  readonly label: string;
  /** 拼进 data-test-id 的稳定英文标识 */
  readonly slug: string;
}

/** 六类素材的显示顺序；Tileset 与其余五类同等对待，不再有独立开关 */
const MAP_CATEGORY_NAV_ITEMS = Object.freeze<readonly IMapCategoryNavItem[]>([
  { category: MapTileCategory.Terrain, label: '地形', slug: 'terrain' },
  { category: MapTileCategory.Enemy, label: '敌人', slug: 'enemy' },
  { category: MapTileCategory.Npc, label: '人物', slug: 'npc' },
  { category: MapTileCategory.Item, label: '物品', slug: 'item' },
  { category: MapTileCategory.Autotile, label: '自动元件', slug: 'autotile' },
  { category: MapTileCategory.Tileset, label: 'Tileset', slug: 'tileset' },
]);

/**
 * 求一个分类按钮的类名：基础类 + 选中标记
 * @param selected 该按钮是否为当前分类
 * @returns 按钮类名
 */
function itemClassName(selected: boolean): string {
  return selected ? 'emap-category-item is-selected' : 'emap-category-item';
}

/**
 * 素材分类导航：六类同一排、每项等宽铺满、相邻按钮之间一条竖线，放不下自动换行
 *
 * `activeCategory` 是当前素材视图的唯一真源：选中的按钮就是素材区正在显示的分类，
 * `activeCategory === MapTileCategory.Tileset` 即 Tileset 视图。点任意一类都会把该类交回，
 * 因此六类素材都能到达，不会卡在 Tileset 视图里。
 * @param props 分类导航 props
 * @returns 分类导航元素
 */
export function MapCategoryNav(props: IMapCategoryNavProps): ReactElement {
  return (
    <div className="emap-category-nav" data-test-id="map-category-nav">
      {MAP_CATEGORY_NAV_ITEMS.map((item) => {
        const selected = item.category === props.activeCategory;

        return (
          <button
            key={item.slug}
            type="button"
            className={itemClassName(selected)}
            data-test-id={`map-category-${item.slug}`}
            aria-pressed={selected}
            title={item.label}
            onClick={(): void => props.onSelectCategory(item.category)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
