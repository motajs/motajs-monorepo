import { IResourceAccess } from '@motajs/editor-core';
import { ReactElement, ReactNode, useRef, useState } from 'react';
import {
  CapabilityProvider,
  IAssetCategory,
  IAssetEditorCapabilities,
  IAssetPickerOpener,
  IAssetPickerOpenRequest,
  IAssetPickerResult,
  IMultiSelectItem,
  ITableEditorCapabilities,
  MultiSelectModal,
} from '../react';
import { loadPickerItems } from './picker';

// 素材能力 Provider：在既有 CapabilityProvider 之上补出「素材能力」（分类清单 + 默认选择器），装配方包一层即可。
// 默认选择器按分类读列表（与面板同一套模型）并挂共享多选弹窗；确认 / 取消都结束 Promise 并回收本次 blob: 地址。

/** 待解决的素材选择器请求的 resolve 函数 */
type AssetPickerResolver = (result: IAssetPickerResult | null) => void;

/** 请求的分类在清单里找不到时的错误文案 */
const PICKER_NO_CATEGORY_MESSAGE = '该分类不存在';

/** 候选素材加载失败时的错误文案 */
const PICKER_LOAD_FAILED_MESSAGE = '素材加载失败';

/**
 * 按标识（缺省时取首个分类）定位选择器要列出的分类
 * @param categories 分类清单
 * @param categoryId 请求指定的分类标识；未指定时为 undefined
 * @returns 命中的分类；清单为空或标识不匹配时为 undefined
 */
function findPickerCategory(
  categories: readonly IAssetCategory[],
  categoryId: string | undefined,
): IAssetCategory | undefined {
  if (categoryId === undefined) return categories.length === 0 ? undefined : categories[0];

  return categories.find((category) => category.id === categoryId);
}

export interface IAssetCapabilityProviderProps {
  /** 资源访问口，供默认选择器读取素材列表与字节 */
  readonly access: IResourceAccess;
  /** 默认选择器列出的分类清单 */
  readonly categories: readonly IAssetCategory[];
  /** 显式注入的素材选择器；缺省时用默认实现 */
  readonly picker?: IAssetPickerOpener;
  /** 透传给既有能力包的其他能力（如代码编辑器 / 事件编辑器） */
  readonly capabilities?: ITableEditorCapabilities;
  /** Provider 包裹的子树 */
  readonly children: ReactNode;
}

/**
 * 素材能力 Provider：把素材能力并入既有能力包，并按需挂载共享的默认选择器弹窗
 * @param props Provider props（资源访问口 / 分类 / 可选注入选择器 / 既有能力包 / 子树）
 * @returns Provider 元素
 */
export function AssetCapabilityProvider(props: IAssetCapabilityProviderProps): ReactElement {
  const requestState = useState<IAssetPickerOpenRequest | undefined>(undefined);
  const request = requestState[0];
  const setRequest = requestState[1];

  const itemsState = useState<readonly IMultiSelectItem[] | undefined>(undefined);
  const items = itemsState[0];
  const setItems = itemsState[1];

  const errorState = useState<string | undefined>(undefined);
  const error = errorState[0];
  const setError = errorState[1];

  const resolver = useRef<AssetPickerResolver | undefined>(undefined);
  const objectUrls = useRef<readonly string[]>([]);
  const token = useRef(0);

  const loadIntoItems = async (next: IAssetPickerOpenRequest, current: number): Promise<void> => {
    const category = findPickerCategory(props.categories, next.categoryId);

    if (category === undefined) {
      setError(PICKER_NO_CATEGORY_MESSAGE);
      return;
    }

    try {
      const loaded = await loadPickerItems(props.access, category);

      if (token.current !== current) {
        for (const url of loaded.objectUrls) URL.revokeObjectURL(url);
        return;
      }

      objectUrls.current = [...objectUrls.current, ...loaded.objectUrls];
      setItems(loaded.items);
    } catch {
      if (token.current === current) setError(PICKER_LOAD_FAILED_MESSAGE);
    }
  };

  const openPicker = (next: IAssetPickerOpenRequest, resolve: AssetPickerResolver): void => {
    const current = token.current + 1;

    token.current = current;
    resolver.current = resolve;
    setError(undefined);
    setItems(undefined);
    setRequest(next);
    void loadIntoItems(next, current);
  };

  const finishPicker = (result: IAssetPickerResult | null): void => {
    const resolve = resolver.current;

    token.current += 1;
    resolver.current = undefined;
    setRequest(undefined);
    setItems(undefined);
    setError(undefined);

    for (const url of objectUrls.current) URL.revokeObjectURL(url);

    objectUrls.current = [];

    if (resolve !== undefined) resolve(result);
  };

  const defaultPicker: IAssetPickerOpener = {
    open: (next) =>
      new Promise<IAssetPickerResult | null>((resolve) => {
        openPicker(next, resolve);
      }),
  };

  const asset: IAssetEditorCapabilities = { categories: props.categories, picker: props.picker ?? defaultPicker };
  const merged: ITableEditorCapabilities = { ...props.capabilities, asset };

  return (
    <CapabilityProvider capabilities={merged}>
      {props.children}
      {request === undefined ? null : (
        <MultiSelectModal
          open
          title={request.title}
          items={items ?? []}
          selectedIds={request.selectedIds ?? []}
          loading={items === undefined && error === undefined}
          error={error}
          onConfirm={(ids): void => finishPicker({ ids })}
          onCancel={(): void => finishPicker(null)}
        />
      )}
    </CapabilityProvider>
  );
}
