/**
 * Blockly Workspace React 组件
 *
 * 封装 Blockly V12 工作区，提供 React 友好的接口
 */

import type { FC } from 'react';
import { useRef, useImperativeHandle, useEffect } from 'react';
import type * as Blockly from 'blockly';

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
  /** Rebuild the toolbox after project block definitions change. */
  refreshToolbox: () => void;
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
      refreshToolbox: api.refreshToolbox,
    }),
    [api],
  );

  // 监听变化（如果提供了 onChange）
  useEffect(() => {
    if (!api.isReady || !onChange) return;

    const workspace = api.getWorkspace();
    if (!workspace) return;
    let pendingFrame: number | undefined;

    const handleChange = (event: Blockly.Events.Abstract) => {
      // Selection, viewport and toolbox changes do not alter the event data.
      // Treating them as draft changes makes a freshly switched document dirty
      // after centerOnBlock restores its viewport.
      if (event.isUiEvent) return;
      // clear + serialization.load 会在同一轮中产生多个变化事件。
      // 只在帧尾读取最终状态，不要把中间的空工作区当成用户草稿。
      if (pendingFrame !== undefined) window.cancelAnimationFrame(pendingFrame);
      pendingFrame = window.requestAnimationFrame(() => {
        pendingFrame = undefined;
        const code = api.generateCode();
        const trimmedCode = code.trim();
        onChange(trimmedCode || '[]');
      });
    };

    workspace.addChangeListener(handleChange);

    return () => {
      if (pendingFrame !== undefined) window.cancelAnimationFrame(pendingFrame);
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
