import { IEditorPanelFactoryParam, IEditorPanelType } from '@motajs/editor-core';
import { createElement, ReactNode } from 'react';
import { TablePanel } from './tablePanel';
import { ITablePanelTarget } from './types';

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

/**
 * 判断一个未知值是否为表格面板目标：非 null 对象且 `data` / `schema` 均为资源标识
 * @param value 待判断的值，来自打开参数的不透明记录
 * @returns 两个键均为带数值 `type` 与字符串 `id` 的对象时为 true
 */
function isTablePanelTarget(value: unknown): value is ITablePanelTarget {
  if (typeof value !== 'object' || value === null) return false;

  if (!('data' in value) || !('schema' in value)) return false;

  const data = value.data;
  const schema = value.schema;

  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    typeof data.type === 'number' &&
    'id' in data &&
    typeof data.id === 'string' &&
    typeof schema === 'object' &&
    schema !== null &&
    'type' in schema &&
    typeof schema.type === 'number' &&
    'id' in schema &&
    typeof schema.id === 'string'
  );
}

export const tablePanelType: IEditorPanelType = Object.freeze({
  id: 'table',
  name: '表格面板',
  icon: createTableIcon(),
  create: (param: IEditorPanelFactoryParam): TablePanel => {
    const panel = new TablePanel(param);
    const openParam = param.openParam;

    if (openParam !== undefined) {
      const target = openParam.target;

      if (isTablePanelTarget(target)) panel.setTable(target);
    }

    return panel;
  },
});
