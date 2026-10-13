import { Button } from 'antd';
import { ReactElement, ReactNode, useState } from 'react';
import { ITableRowNode } from '../types';
import { getShortField, parseFieldPath } from '../model/fieldPath';

export interface IGapRowProps {
  /** 分组行节点 */
  readonly row: ITableRowNode;
  /** 展开时渲染的子行 */
  readonly children: ReactNode;
}

/**
 * 可折叠分组行：显示 `---- | ---- | ['field'] | [折叠/展开]`，切换其子行是否进入 DOM
 *
 * 折叠状态是面板本地的界面状态，不进入撤销历史；展开时显示「折叠」，折叠时显示「展开」。
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
      <div className="etable-row etable-row-group" data-test-id={`table-row-${dataAttr}`}>
        <div className="etable-cell etable-cell-name">----</div>
        <div className="etable-cell etable-cell-comment">----</div>
        <div className="etable-cell etable-cell-value">{`['${shortField}']`}</div>
        <div className="etable-cell etable-cell-action">
          <Button size="small" type="text" autoInsertSpace={false} onClick={(): void => setExpanded(!expanded)}>
            {expanded ? '折叠' : '展开'}
          </Button>
        </div>
      </div>
      {expanded ? <div className="etable-group-children">{props.children}</div> : null}
    </>
  );
}
