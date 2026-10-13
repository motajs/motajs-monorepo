import { createContext, useContext } from 'react';
import { ITableEditorCapabilities } from './capabilities';

// 能力包的 React Context 与读取 hook：表格组件经此读取注入的外部编辑器能力并按缺省优雅降级。
// 本文件只声明 Context 与读取 hook，具体的 Provider（挂载弹窗）由 @motajs/editor-impl/react 的消费者提供。

export const TableCapabilitiesContext = createContext<ITableEditorCapabilities>({});

/**
 * 读取当前注入的表格能力包
 * @returns 最近一层 Provider 注入的能力包；无 Provider 时为空能力包
 */
export function useTableCapabilities(): ITableEditorCapabilities {
  return useContext(TableCapabilitiesContext);
}
