import { IEditorPanelFactoryParam, IEditorPanelType } from '@motajs/editor-core';
import { createElement, ReactNode } from 'react';
import { MAP_PANEL_TYPE_ID } from './constants';
import { MapPanel } from './mapPanel';
import { IMapEditorCapabilities, IMapPanelTarget } from './types';

// 地图面板类型的工厂：把注入的地图能力闭包进来，顶层注册时得到一个真正能用的面板类型。
// core 创建面板实例时不传能力，故用工厂而非常量导出；能力包自己在顶层装配，本文件不提供 install。

/**
 * 生成地图面板类型的内联 SVG 图标
 * @returns 16px 的内联 SVG 图标节点
 */
function createMapIcon(): ReactNode {
  return createElement(
    'svg',
    { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true },
    createElement('rect', {
      x: 1.5,
      y: 1.5,
      width: 13,
      height: 13,
      rx: 1.5,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
    }),
    createElement('path', {
      d: 'M1.5 5.5H14.5M1.5 10.5H14.5M5.5 1.5V14.5M10.5 1.5V14.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.2,
    }),
  );
}

/**
 * 判断一个未知值是否为地图面板目标：非 null 对象且 `mapId` 为字符串
 * @param value 待判断的值，来自打开参数的不透明记录
 * @returns 形状符合地图面板目标时为 true
 */
function isMapPanelTarget(value: unknown): value is IMapPanelTarget {
  if (typeof value !== 'object' || value === null) return false;

  return 'mapId' in value && typeof value.mapId === 'string';
}

/**
 * 用注入的地图能力造出地图面板类型；能力包只在顶层注册，不自行装配进 core
 * @param capabilities 地图能力的注入面
 * @returns 冻结的地图面板类型
 */
export function createMapPanelType(capabilities: IMapEditorCapabilities): IEditorPanelType {
  return Object.freeze({
    id: MAP_PANEL_TYPE_ID,
    name: '地图编辑器',
    icon: createMapIcon(),
    create: (param: IEditorPanelFactoryParam): MapPanel => {
      const panel = new MapPanel(param, capabilities);
      const openParam = param.openParam;

      if (openParam !== undefined) {
        const target = openParam.target;

        if (isMapPanelTarget(target)) panel.setMap(target);
      }

      return panel;
    },
  });
}
