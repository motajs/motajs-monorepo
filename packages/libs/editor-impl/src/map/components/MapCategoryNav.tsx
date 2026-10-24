import { ReactElement } from 'react';
import { IMapCategoryNavProps, MapTileCategory } from '../types';

// 右侧素材区的分类导航：五个普通分类竖排，Tileset 作为独立开关放在最后。
// 只吃 props（当前分类、Tileset 是否展开、两个回调），不持有状态、不读目录、不生成图片地址。

/** 分类导航里的一项：分类、显示名与拼进 data-test-id 的稳定标识 */
interface IMapCategoryNavItem {
  /** 该按钮代表的素材分类 */
  readonly category: MapTileCategory;
  /** 按钮上的显示名 */
  readonly label: string;
  /** 拼进 data-test-id 的稳定英文标识 */
  readonly slug: string;
}

/** 五个普通分类的显示顺序；Tileset 不在其中，它是独立开关 */
const MAP_CATEGORY_NAV_ITEMS: readonly IMapCategoryNavItem[] = [
  { category: MapTileCategory.Terrain, label: '地形', slug: 'terrain' },
  { category: MapTileCategory.Enemy, label: '敌人', slug: 'enemy' },
  { category: MapTileCategory.Npc, label: '人物', slug: 'npc' },
  { category: MapTileCategory.Item, label: '物品', slug: 'item' },
  { category: MapTileCategory.Autotile, label: '自动元件', slug: 'autotile' },
];

/**
 * 求一个分类按钮的类名：基础类 + 选中标记
 * @param selected 该按钮是否为当前分类
 * @returns 按钮类名
 */
function itemClassName(selected: boolean): string {
  return selected ? 'emap-category-item is-selected' : 'emap-category-item';
}

/**
 * 素材分类导航：五类竖排 + 独立 Tileset 开关
 *
 * 点普通分类会顺手收起 Tileset 视图；再点一次 Tileset 开关同样收起，
 * 这样六类素材都能到达，不会卡在 Tileset 视图里。
 * @param props 分类导航 props
 * @returns 分类导航元素
 */
export function MapCategoryNav(props: IMapCategoryNavProps): ReactElement {
  return (
    <div className="emap-category-nav" data-test-id="map-category-nav">
      {MAP_CATEGORY_NAV_ITEMS.map((item) => {
        const selected = !props.tilesetOpen && item.category === props.activeCategory;

        return (
          <button
            key={item.slug}
            type="button"
            className={itemClassName(selected)}
            data-test-id={`map-category-${item.slug}`}
            aria-pressed={selected}
            title={item.label}
            onClick={(): void => {
              props.onSelectCategory(item.category);

              if (props.tilesetOpen) props.onToggleTileset(false);
            }}
          >
            {item.label}
          </button>
        );
      })}
      <button
        type="button"
        className={
          props.tilesetOpen ? 'emap-category-item emap-category-tileset is-selected' : 'emap-category-item emap-category-tileset'
        }
        data-test-id="map-tileset-toggle"
        aria-pressed={props.tilesetOpen}
        title="Tileset"
        onClick={(): void => props.onToggleTileset(!props.tilesetOpen)}
      >
        Tileset
      </button>
    </div>
  );
}
