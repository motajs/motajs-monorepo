import { IEditorPanelFactoryParam, IEditorPanelType } from '@motajs/editor-core';
import { createElement, ReactNode } from 'react';
import { IAssetCategory, IAssetEditorCapabilities } from '../react';
import { AssetPanel } from './assetPanel';
import { resolveAssetName } from './model';
import { IAssetPanelTarget } from './types';

// 素材面板类型的工厂：把注入的分类清单闭包进工厂，顶层注册时得到一个真正能用的面板类型。
// 面板类在切入时才需要分类清单，而 core 创建面板时不传能力，故用工厂而非常量导出（INTERFACE-NAME §03-10 偏离 2）。

/** 素材面板类型标识符，供装配方引用避免各写各的字符串 */
export const ASSET_PANEL_TYPE_ID = 'asset';

/**
 * 生成素材面板类型的内联 SVG 图标
 * @returns 16px 的内联 SVG 图标节点
 */
function createAssetIcon(): ReactNode {
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
    createElement('circle', { cx: 5, cy: 6, r: 1.2, fill: 'currentColor' }),
    createElement('path', {
      d: 'M2.5 12.5L6.5 8.5L9 11L11.5 8.5L13.5 10.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
    }),
  );
}

/**
 * 判断一个未知值是否为素材面板目标：非 null 对象，且 `categoryId` / `assetName` 若存在则为字符串
 * @param value 待判断的值，来自打开参数的不透明记录
 * @returns 形状符合素材面板目标时为 true
 */
function isAssetPanelTarget(value: unknown): value is IAssetPanelTarget {
  if (typeof value !== 'object' || value === null) return false;
  if ('categoryId' in value && typeof value.categoryId !== 'string') return false;
  if ('assetName' in value && typeof value.assetName !== 'string') return false;

  return true;
}

/**
 * 判断路径是否等于分类的清单 / schema / 默认值文件
 * @param category 素材分类
 * @param path 完整路径
 * @returns 命中任一约定文件时为 true
 */
function isCategoryDocument(category: IAssetCategory, path: string): boolean {
  if (path === category.listPath) return true;
  if (category.schemaPath !== undefined && path === category.schemaPath) return true;
  if (category.defaultsPath !== undefined && path === category.defaultsPath) return true;

  return false;
}

/**
 * 判断路径是否位于分类的字节目录之下
 * @param category 素材分类
 * @param path 完整路径
 * @returns 位于该分类目录之下时为 true
 */
function isCategoryAsset(category: IAssetCategory, path: string): boolean {
  return path.startsWith(`${category.dir}/`);
}

/**
 * 判断分类是否认领该路径
 * @param category 素材分类
 * @param path 完整路径
 * @returns 认领清单 / schema / 默认值文件与分类目录内的文件时为 true
 */
function categoryClaims(category: IAssetCategory, path: string): boolean {
  return isCategoryDocument(category, path) || isCategoryAsset(category, path);
}

/**
 * 取路径的最后一段文件名
 * @param path 完整路径
 * @returns 最后一段名字
 */
function fileNameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/**
 * 由分类与完整路径造出打开参数：清单 / schema / 默认值文件只带分类，字节文件再带素材名
 * @param category 命中的分类
 * @param path 完整路径
 * @returns 素材面板的打开参数
 */
function createTargetOf(category: IAssetCategory, path: string): Record<string, unknown> {
  // 素材名必须与列表条目里的 `name` 一致：只把最后一段文件名交给 `resolveAssetName`，
  // 它会按分类的 `extension` 决定是否去后缀（没有 `extension` 的分类原样保留，如 `hero.png`）
  if (isCategoryAsset(category, path)) {
    return { assetName: resolveAssetName(category, fileNameOf(path)), categoryId: category.id };
  }

  return { categoryId: category.id };
}

/**
 * 用注入的分类清单造出素材面板类型；能力包只在顶层注册，不自行装配进 core
 * @param capabilities 素材能力的注入面（分类清单 + 选择器）
 * @returns 冻结的素材面板类型
 */
export function createAssetPanelType(capabilities: IAssetEditorCapabilities): IEditorPanelType {
  const categories = capabilities.categories ?? [];

  return Object.freeze({
    id: 'asset',
    name: '素材管理器',
    icon: createAssetIcon(),
    create: (param: IEditorPanelFactoryParam): AssetPanel => {
      const panel = new AssetPanel(param, capabilities);
      const openParam = param.openParam;

      if (openParam !== undefined) {
        const target = openParam.target;

        if (isAssetPanelTarget(target)) panel.setTarget(target);
      }

      return panel;
    },
    reuseTab: true,
    canOpen: (path: string): boolean => categories.some((category) => categoryClaims(category, path)),
    createOpenParam: (path: string): Record<string, unknown> => {
      const category = categories.find((candidate) => categoryClaims(candidate, path));

      // 未命中时交给既有 `isAssetPanelTarget` 收窄后落回无目标，不在本层猜目录约定（D-32）
      if (category === undefined) return { target: null };

      return { target: createTargetOf(category, path) };
    },
  });
}
