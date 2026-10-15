import { IEditorPanelFactoryParam, IEditorPanelType } from '@motajs/editor-core';
import { createElement, ReactNode } from 'react';
import { TableListPanel } from './tableListPanel';

/**
 * 生成「打开表格」列表面板类型的内联 SVG 图标
 * @returns 16px 的内联 SVG 图标节点
 */
function createTableListIcon(): ReactNode {
  return createElement(
    'svg',
    { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true },
    createElement('rect', {
      x: 2.5,
      y: 2.5,
      width: 11,
      height: 11,
      rx: 1.5,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
    }),
    createElement('path', {
      d: 'M4.5 5.5H11.5M4.5 8H11.5M4.5 10.5H9',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
    }),
  );
}

export const tableListPanelType: IEditorPanelType = Object.freeze({
  id: 'table-list',
  name: '打开表格',
  icon: createTableListIcon(),
  create: (param: IEditorPanelFactoryParam): TableListPanel => new TableListPanel(param),
});
