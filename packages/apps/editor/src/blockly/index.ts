/**
 * Blockly V12 模块入口
 *
 * 提供基于 Blockly V12 的事件编辑器组件和相关工具
 */

// 组件导出
export { BlocklyWorkspace } from './components/BlocklyWorkspace';
export type { BlocklyWorkspaceProps, BlocklyWorkspaceRef } from './components/BlocklyWorkspace';

// Hooks 导出
export { useBlocklyWorkspace } from './hooks/useBlocklyWorkspace';
export type { WorkspaceAPI, WorkspaceOptions, ValidationResult } from './hooks/useBlocklyWorkspace';

// 积木块导出
export { registerAllBlocks, isBlocksRegistered, blockRegistry } from './blocks';

// Registry 导出
export { blockRegistry as registry } from './registry';
export type { BlockSchema, FieldMapping, BlockParser, BlockGenerator } from './registry/types';
export type {
  DeclarativeInteraction,
  MaterialKind,
  BlocklyCompletionSourceId,
  BlocklyPreviewAdapterId,
} from './registry/types';
export * from './interactions';
export * from './diagnostics/asyncDiagnostics';
export * from './session/BlocklyEditorSession';

// Schema 导出
export { allSchemas, registerAllSchemas } from './schemas';

// Extensions 导出
export { registerAllExtensions, CHANGE_FLOOR_VISIBILITY_EXTENSION } from './extensions';

// 解析器导出
export { parseEventList, parseEvent, eventsToWorkspaceState } from './parser';
export type {
  EventData,
  EventObject,
  BlockState,
  ConnectionState,
  WorkspaceState,
  ParseContext,
} from './parser/types';

// API 导出
export { createEditorBlocklyApi } from './api/editorBlockly';
export type { EditorBlocklyApi } from './api/editorBlockly';
