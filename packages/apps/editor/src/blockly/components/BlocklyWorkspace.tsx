/**
 * Blockly Workspace React 组件
 *
 * 封装 Blockly V12 工作区，提供 React 友好的接口
 */

import type { FC } from 'react';
import { useRef, useImperativeHandle, useEffect } from 'react';

import { useBlocklyWorkspace } from '../hooks/useBlocklyWorkspace';
import type { WorkspaceAPI, WorkspaceOptions } from '../hooks/useBlocklyWorkspace';
import type { EventData, ParseContext } from '../parser/types';

/**
 * BlocklyWorkspace 组件 Props
 */
export interface BlocklyWorkspaceProps {
  /** Ref 引用（React 19 中 ref 作为标准 prop） */
  ref?: React.Ref<BlocklyWorkspaceRef>;
  /** 容器样式 */
  style?: React.CSSProperties;
  /** 容器 className */
  className?: string;
  /** Workspace 配置选项 */
  options?: WorkspaceOptions;
  /** 内容变化回调 */
  onChange?: (json: string) => void;
}

/**
 * BlocklyWorkspace 组件 Ref 接口
 */
export interface BlocklyWorkspaceRef {
  /** 获取 Workspace API */
  getApi: () => WorkspaceAPI;
  /** 加载事件数据（解析为细粒度块） */
  loadEventData: (events: EventData[]) => void;
  /** 加载带入口块的数据 */
  loadEntryData: (data: unknown, entryType: string, project?: ParseContext['project']) => void;
  /** 获取顶层入口块类型 */
  getTopBlockType: () => string | null;
}

/**
 * Blockly Workspace React 组件
 *
 * 提供一个可嵌入的 Blockly 编辑器
 */
export function BlocklyWorkspace(props: BlocklyWorkspaceProps) {
  const { ref, style, className, options, onChange } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const api = useBlocklyWorkspace(containerRef, options);

  // 暴露 ref 方法
  useImperativeHandle(
    ref,
    () => ({
      getApi: () => api,
      loadEventData: api.loadEventData,
      loadEntryData: api.loadEntryData,
      getTopBlockType: api.getTopBlockType,
    }),
    [api],
  );

  // 监听变化（如果提供了 onChange）
  useEffect(() => {
    if (!api.isReady || !onChange) return;

    const workspace = api.getWorkspace();
    if (!workspace) return;

    const handleChange = () => {
      // 使用代码生成器获取实际的 JSON 输出
      const code = api.generateCode();
      // 代码可能包含末尾换行，清理一下
      const trimmedCode = code.trim();
      onChange(trimmedCode || '[]');
    };

    workspace.addChangeListener(handleChange);

    // 初始触发一次，确保加载数据后能更新 preview
    handleChange();

    return () => {
      workspace.removeChangeListener(handleChange);
    };
  }, [api.isReady, api, onChange]);

  return (
    <div
      ref={containerRef}
      data-test-id="event-editor-workspace"
      style={{
        width: '100%',
        height: '100%',
        ...style,
      }}
      className={className}
    />
  );
}

// 为了兼容 FC 类型导出
export const BlocklyWorkspaceFC: FC<BlocklyWorkspaceProps> = BlocklyWorkspace as FC<BlocklyWorkspaceProps>;
