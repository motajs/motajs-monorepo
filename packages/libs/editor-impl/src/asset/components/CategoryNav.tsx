import { ReactElement } from 'react';
import { IAssetCategory } from '../../react';

export interface ICategoryNavProps {
  /** 可选的分类清单，按注入顺序渲染 */
  readonly categories: readonly IAssetCategory[];
  /** 当前选中的分类标识；未选中时为 undefined */
  readonly currentId?: string;
  /**
   * 点击某个分类项
   * @param id 目标分类标识
   */
  onSelect(id: string): void;
}

/**
 * 素材分类导航：按注入顺序渲染固定项，当前项带 `aria-current`
 * @param props 分类导航 props
 * @returns 分类导航元素
 */
export function CategoryNav(props: ICategoryNavProps): ReactElement {
  if (props.categories.length === 0) {
    return (
      <div className="asset-nav" data-test-id="asset-nav">
        <div className="asset-nav-empty">尚无可用分类</div>
      </div>
    );
  }

  return (
    <div className="asset-nav" data-test-id="asset-nav">
      {props.categories.map((category) => (
        <button
          key={category.id}
          type="button"
          className={category.id === props.currentId ? 'asset-nav-item is-selected' : 'asset-nav-item'}
          aria-current={category.id === props.currentId ? 'true' : undefined}
          title={category.label}
          data-test-id={`asset-category-${category.id}`}
          onClick={(): void => props.onSelect(category.id)}
        >
          {category.label}
        </button>
      ))}
    </div>
  );
}
