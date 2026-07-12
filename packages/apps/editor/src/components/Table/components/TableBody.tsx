import { type FC } from 'react';
import type { TableNode } from '../types';
import { TableRow } from './TableRow';
import { GapRow } from './GapRow';
import { DataStore } from '../stores';

/**
 * TableBody 组件
 *
 * 递归渲染 TableNode 树结构：
 * - 对 isGap 节点渲染 GapRow（分隔行，可折叠）
 * - 对非 isGap 节点渲染 TableRow（叶节点，可编辑）
 *
 * 架构说明：
 * - TableRow 直接访问 DataStore 获取回调，无需通过 props 传递
 * - 简化的组件层级：TableBody -> TableRow（无 Wrapper）
 * - checkRange 验证在 TableRow 中统一处理
 *
 * @example
 * ```tsx
 * <tbody>
 *   <TableBody />
 * </tbody>
 * ```
 */
export const TableBody: FC = () => {
  const { rootNodes } = DataStore.useStore();

  return <>{renderNodes(rootNodes)}</>;
};

/**
 * 递归渲染节点列表
 */
function renderNodes(nodes: TableNode[]): React.ReactNode {
  return nodes.map((node) => renderNode(node));
}

/**
 * 渲染单个节点
 * - isGap 节点渲染为 GapRow，包含递归渲染的子节点
 * - 非 isGap 节点渲染为 TableRow（直接访问 DataStore）
 */
function renderNode(node: TableNode): React.ReactNode {
  if (node.isGap) {
    // 分隔行：渲染 GapRow，子节点作为 children
    return (
      <GapRow key={node.field} field={node.field} shortField={node.shortField}>
        {node.children && renderNodes(node.children)}
      </GapRow>
    );
  }

  // 叶节点：直接渲染 TableRow，传递 node prop
  // TableRow 内部直接访问 DataStore 获取回调
  return <TableRow key={node.field} node={node} />;
}
