import { useMemo, type FC } from 'react';
import type { GapRowProps } from '../types';
import { useFold } from '../hooks/useFold';

/**
 * GapRow 组件
 *
 * 渲染表格的分隔行（非叶节点），用于显示嵌套数据的折叠/展开控制。
 *
 * 功能：
 * - 显示分隔行，包含字段路径信息
 * - 提供折叠/展开按钮
 * - 条件渲染子节点（展开时显示，折叠时隐藏）
 *
 * @example
 * ```tsx
 * <GapRow field="['main']" shortField="main">
 *   <TableRow ... />
 *   <TableRow ... />
 * </GapRow>
 * ```
 */
export const GapRow: FC<GapRowProps> = (props) => {
  const { field, shortField, children } = props;

  // 使用 useFold Hook 管理折叠状态
  const { isFolded, toggleFold } = useFold(field);

  // 生成 data-gap 属性值
  // "['main']['floorIds']" => "main-floorIds"
  const dataGap = useMemo(
    () => field.slice(2, -2).split("']['").join('-'),
    [field],
  );

  // 生成 data-field 属性值（父级路径）
  // "['main']['floorIds']" => "main"
  const dataField = useMemo(() => {
    const tokenlist = field.slice(2, -2).split("']['");
    tokenlist.pop();
    return tokenlist.join('-');
  }, [field]);

  return (
    <>
      {/* 分隔行 */}
      <tr data-gap={dataGap} data-field={dataField}>
        <td>----</td>
        <td>----</td>
        <td>['{shortField}']</td>
        <td>
          <button
            className="editorTableFoldBtn"
            data-fold={isFolded ? 'true' : 'false'}
            onClick={toggleFold}
          >
            {isFolded ? '展开' : '折叠'}
          </button>
        </td>
      </tr>

      {/* 条件渲染子节点 */}
      {!isFolded && children}
    </>
  );
};
