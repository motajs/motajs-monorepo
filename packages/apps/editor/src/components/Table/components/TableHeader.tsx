import type { FC } from 'react';

/**
 * 表格头部组件
 *
 * 渲染表格的标题行，包含四列：条目、注释、值、操作
 */
export const TableHeader: FC = () => {
  return (
    <tr>
      <td>条目</td>
      <td>注释</td>
      <td>值</td>
      <td>操作</td>
    </tr>
  );
};
