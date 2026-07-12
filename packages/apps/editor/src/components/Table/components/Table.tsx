import type { FC } from 'react';
import type { TableProps } from '../types';
import { FoldStore, DataStore } from '../stores';
import { TableHeader } from './TableHeader';
import { TableBody } from './TableBody';

/**
 * Table 主组件
 *
 * 动态表格组件，根据数据对象和注释配置对象渲染可编辑的表格。
 * 嵌套 FoldStore.Provider 和 DataStore.Provider 提供状态管理。
 *
 * @example
 * ```tsx
 * <Table
 *   data={gameData}
 *   commentObj={commentConfig}
 *   onChange={(action) => save([action])}
 *   editMode="change"
 * />
 * ```
 */
export const Table: FC<TableProps> = (props) => {
  const { data, commentObj, onChange, onOpenExternalEditor, editMode } = props;

  return (
    <div className="etable" data-test-id="data-table">
      <FoldStore.Provider>
        <DataStore.Provider
          argument={{
            data,
            commentObj,
            onChange,
            onOpenExternalEditor,
            editMode,
          }}
        >
          <table data-test-id="data-table-grid">
            <thead>
              <TableHeader />
            </thead>
            <tbody>
              <TableBody />
            </tbody>
          </table>
        </DataStore.Provider>
      </FoldStore.Provider>
    </div>
  );
};
