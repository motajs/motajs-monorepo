import { IEditorPanelFactoryParam, IEditorPanelType } from '@motajs/editor-core';
import { createElement, ReactNode } from 'react';
import { TablePanel } from './tablePanel';

/**
 * 生成表格面板类型的内联 SVG 图标
 * @returns 16px 的内联 SVG 图标节点
 */
function createTableIcon(): ReactNode {
  return createElement(
    'svg',
    { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true },
    createElement('rect', {
      x: 1.5,
      y: 2.5,
      width: 13,
      height: 11,
      rx: 1.5,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
    }),
    createElement('path', {
      d: 'M1.5 6.5H14.5M1.5 10.5H14.5M6 2.5V13.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
    }),
  );
}

export const tablePanelType: IEditorPanelType = Object.freeze({
  id: 'table',
  name: '表格面板',
  icon: createTableIcon(),
  create: (param: IEditorPanelFactoryParam): TablePanel => new TablePanel(param),
});
