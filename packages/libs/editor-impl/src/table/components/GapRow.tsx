import { ReactElement, ReactNode, useEffect, useRef, useState } from 'react';
import { ITableRowNode } from '../types';
import { getShortField, parseFieldPath } from '../../shared/schemaForm/model/fieldPath';

/** 层级缩进步长（像素），约旧缩进 12px 的 3/4 */
const TREE_INDENT_STEP = 9;

export interface IGapRowProps {
  /** 分组行节点 */
  readonly row: ITableRowNode;
  /** 该行在行树中的深度（0 基），用于「条目」列的层级缩进与层级底色 */
  readonly level: number;
  /** 该行 gutter 内要渲染的增删按钮；为空时仅占位 */
  readonly gutter?: ReactNode;
  /** 展开时渲染的子行 */
  readonly children: ReactNode;
}

/**
 * 可折叠分组行：最左为折叠指示与对象名，其子行渲染在带缩进的容器内
 *
 * 分组行默认**折叠**——折叠子行不进入 DOM，使折叠项较多的表（如 schema）首屏只挂载顶层可见行，
 * 降低首屏挂载量（P29）。折叠行 header **首次进入视野时自动展开**：组件自持一个
 * `IntersectionObserver` 观察 header，首次相交即展开并断开观察器；打开时的首次回调即充当初始可见性
 * 判定。`IntersectionObserver` 不可用时（jsdom / 老浏览器）退化为立即展开，绝不把内容永久隐藏。
 *
 * 折叠状态是面板本地的界面状态，不进入撤销历史；展开时显示「折叠」，折叠时显示「展开」。分组行最左
 * 的折叠指示与紧随其后的对象名、以及子行容器的缩进，让「分组的作用范围」一眼可读（L2）。点该行任意
 * 处（gutter 增删按钮除外）都切换折叠，折叠箭头按钮自身只切换一次；用户一旦点过该行即视为接管，此后
 * 不再被自动展开。
 * @param props 行 props
 * @returns 分组行元素
 */
export function GapRow(props: IGapRowProps): ReactElement {
  const expandedState = useState(false);
  const expanded = expandedState[0];
  const setExpanded = expandedState[1];
  const autoRevealState = useState(true);
  const autoRevealPending = autoRevealState[0];
  const setAutoRevealPending = autoRevealState[1];
  const headerRef = useRef<HTMLDivElement>(null);
  const dataAttr = parseFieldPath(props.row.key).join('-');
  const shortField = getShortField(props.row.key);

  useEffect((): (() => void) | undefined => {
    const header = headerRef.current;

    if (header === null || !autoRevealPending) return undefined;

    // 缺少观察器（jsdom / 老浏览器）时退化：直接展开，保证内容不会永久隐藏
    if (typeof IntersectionObserver === 'undefined') {
      setAutoRevealPending(false);
      setExpanded(true);
      return undefined;
    }

    // 默认视口 root：祖先滚动容器 .etable-body 的 overflow 裁剪会让 isIntersecting 反映「在表体内可见」
    const observer = new IntersectionObserver((entries): void => {
      if (!entries.some((entry) => entry.isIntersecting)) return;

      setAutoRevealPending(false);
      setExpanded(true);
      observer.disconnect();
    });

    observer.observe(header);

    // 释放观察器，避免组件卸载后泄漏（T-02-34-01）
    return (): void => observer.disconnect();
  }, [autoRevealPending]);

  // 先标记用户已接管（不再自动展开），再切换折叠
  const toggleExpanded = (): void => {
    setAutoRevealPending(false);
    setExpanded(!expanded);
  };

  return (
    <>
      <div
        ref={headerRef}
        className="etable-row etable-row-group"
        data-level={props.level}
        data-test-id={`table-row-${dataAttr}`}
        onClick={toggleExpanded}
      >
        <div className="etable-gutter">{props.gutter}</div>
        <div className="etable-cell etable-cell-name" data-level={props.level} title={props.row.key}>
          {Array.from({ length: props.level }, (_, index) => (
            <span key={index} className="etable-tree-guide" style={{ width: TREE_INDENT_STEP }} />
          ))}
          <button
            type="button"
            className="etable-group-toggle"
            aria-label={expanded ? '折叠' : '展开'}
            aria-expanded={expanded}
            data-test-id={`gap-toggle-${dataAttr}`}
            onClick={(event): void => {
              event.stopPropagation();
              toggleExpanded();
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path
                d={expanded ? 'M1 3 L5 7 L9 3' : 'M3 1 L7 5 L3 9'}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              />
            </svg>
          </button>
          <span className="etable-group-name">{shortField}</span>
        </div>
        <div className="etable-cell etable-cell-comment" title={props.row.description ?? ''}>
          <span className="etable-cell-text">{props.row.description ?? ''}</span>
        </div>
        <div className="etable-cell etable-cell-value" />
        <div className="etable-cell etable-cell-action" />
      </div>
      {expanded ? <div className="etable-group-children">{props.children}</div> : null}
    </>
  );
}
