import { IEditorPanelFactoryParam, IEditorPanelType } from '@motajs/editor-core';
import { createElement, ReactNode } from 'react';
import { FileExplorerPanel } from './fileExplorerPanel';
import { IFileExplorerCapabilities } from './types';

// 资源管理器面板类型的工厂：把宿主注入的两项能力闭包进工厂，顶层注册时得到一个真正能用的面板类型。
// 资源管理器不把自己列为候选——它只负责浏览与打开，不解释任何文件格式。

/**
 * 生成资源管理器面板类型的内联 SVG 文件夹图标
 * @returns 16px 的内联 SVG 图标节点
 */
function createExplorerIcon(): ReactNode {
  return createElement(
    'svg',
    { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true },
    createElement('path', {
      d: 'M1.5 4.5A1 1 0 0 1 2.5 3.5H6L7.5 5H13.5A1 1 0 0 1 14.5 6V12A1 1 0 0 1 13.5 13H2.5A1 1 0 0 1 1.5 12V4.5Z',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
    }),
  );
}

/**
 * 用宿主注入的能力造出资源管理器面板类型；能力包只在顶层注册，不自行装配进 core
 * @param capabilities 资源管理器能力的注入面（列面板类型 + 打开面板）
 * @returns 冻结的资源管理器面板类型
 */
export function createFileExplorerPanelType(capabilities: IFileExplorerCapabilities): IEditorPanelType {
  return Object.freeze({
    id: 'explorer',
    name: '文件资源管理器',
    icon: createExplorerIcon(),
    create: (param: IEditorPanelFactoryParam): FileExplorerPanel => new FileExplorerPanel(param, capabilities),
  });
}
