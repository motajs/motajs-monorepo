import { ReactElement, useRef, useState } from 'react';
import {
  IMultiSelectOpener,
  IPointSelectOpener,
  ITableCapabilitiesProviderProps,
  ITableEditorCapabilities,
} from '../capabilities';
import { TableCapabilitiesContext } from '../capabilitiesContext';
import { IMultiSelectOpenRequest, IMultiSelectResult, IPointSelectOpenRequest, IPointSelectResult } from '../types';
import { MultiSelectModal } from './MultiSelectModal';
import { PointPickerModal } from './PointPickerModal';

/** 待解决的多选弹窗请求的 resolve 函数 */
type MultiSelectResolver = (result: IMultiSelectResult | null) => void;

/** 待解决的坐标弹窗请求的 resolve 函数 */
type PointSelectResolver = (result: IPointSelectResult | null) => void;

/**
 * 能力 Provider：把注入的能力包经 Context 提供给子树，并挂载共享的通用多选 / 坐标弹窗
 *
 * 未注入多选 / 坐标打开器时，本组件以「默认走弹窗」的打开器补齐，因此表格无需宿主注入弹窗即可
 * 工作；传入的打开器优先。缺少本 Provider 时上下文为空能力包，相应动作在表格侧优雅降级。
 * @param props Provider props，携带能力包与子树
 * @returns Provider 元素
 */
export function CapabilityProvider(props: ITableCapabilitiesProviderProps): ReactElement {
  const multiState = useState<IMultiSelectOpenRequest | undefined>(undefined);
  const multiRequest = multiState[0];
  const setMultiRequest = multiState[1];
  const multiResolver = useRef<MultiSelectResolver | undefined>(undefined);

  const pointState = useState<IPointSelectOpenRequest | undefined>(undefined);
  const pointRequest = pointState[0];
  const setPointRequest = pointState[1];
  const pointResolver = useRef<PointSelectResolver | undefined>(undefined);

  const provided = props.capabilities;

  const openMultiSelect: IMultiSelectOpener = {
    open: (request) =>
      new Promise<IMultiSelectResult | null>((resolve) => {
        multiResolver.current = resolve;
        setMultiRequest(request);
      }),
  };

  const openPointSelect: IPointSelectOpener = {
    open: (request) =>
      new Promise<IPointSelectResult | null>((resolve) => {
        pointResolver.current = resolve;
        setPointRequest(request);
      }),
  };

  const capabilities: ITableEditorCapabilities = {
    codeEditor: provided?.codeEditor,
    eventEditor: provided?.eventEditor,
    multiSelect: provided?.multiSelect ?? openMultiSelect,
    pointSelect: provided?.pointSelect ?? openPointSelect,
    tablePanel: provided?.tablePanel,
    tablePresets: provided?.tablePresets,
    copy: provided?.copy,
  };

  const handleMultiConfirm = (ids: readonly string[]): void => {
    const resolve = multiResolver.current;

    multiResolver.current = undefined;
    setMultiRequest(undefined);

    if (resolve !== undefined) resolve({ ids });
  };

  const handleMultiCancel = (): void => {
    const resolve = multiResolver.current;

    multiResolver.current = undefined;
    setMultiRequest(undefined);

    if (resolve !== undefined) resolve(null);
  };

  const handlePointConfirm = (point: IPointSelectResult): void => {
    const resolve = pointResolver.current;

    pointResolver.current = undefined;
    setPointRequest(undefined);

    if (resolve !== undefined) resolve(point);
  };

  const handlePointCancel = (): void => {
    const resolve = pointResolver.current;

    pointResolver.current = undefined;
    setPointRequest(undefined);

    if (resolve !== undefined) resolve(null);
  };

  return (
    <TableCapabilitiesContext.Provider value={capabilities}>
      {props.children}
      {multiRequest === undefined ? null : (
        <MultiSelectModal
          open
          title={multiRequest.title}
          items={multiRequest.items}
          selectedIds={multiRequest.selectedIds}
          onConfirm={handleMultiConfirm}
          onCancel={handleMultiCancel}
        />
      )}
      {pointRequest === undefined ? null : (
        <PointPickerModal
          open
          title={pointRequest.title}
          x={pointRequest.x}
          y={pointRequest.y}
          onConfirm={handlePointConfirm}
          onCancel={handlePointCancel}
        />
      )}
    </TableCapabilitiesContext.Provider>
  );
}
