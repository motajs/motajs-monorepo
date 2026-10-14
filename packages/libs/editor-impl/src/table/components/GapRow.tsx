import { ReactElement, ReactNode, useState } from 'react';
import { ITableRowNode } from '../types';
import { getShortField, parseFieldPath } from '../model/fieldPath';

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
 * 折叠状态是面板本地的界面状态，不进入撤销历史；展开时显示「折叠」，折叠时显示「展开」。分组行
 * 最左的折叠指示与紧随其后的对象名、以及子行容器的缩进，让「分组的作用范围」一眼可读（L2）。
 * @param props 行 props
 * @returns 分组行元素
 */
export function GapRow(props: IGapRowProps): ReactElement {
  const expandedState = useState(true);
  const expanded = expandedState[0];
  const setExpanded = expandedState[1];
  const dataAttr = parseFieldPath(props.row.key).join('-');
  const shortField = getShortField(props.row.key);

  return (
    <>
      <div className="etable-row etable-row-group" data-level={props.level} data-test-id={`table-row-${dataAttr}`}>
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
            onClick={(): void => setExpanded(!expanded)}
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
