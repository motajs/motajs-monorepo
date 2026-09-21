/**
 * Blockly Workspace 管理 Hook
 *
 * 封装 Blockly V12 Workspace 的初始化、销毁和常用操作
 */

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import * as Zh from 'blockly/msg/zh-hans';

import { registerAllBlocks } from '../blocks';
import { dataToWorkspaceStateWithEntry, eventsToWorkspaceState } from '../parser';
import type { EventData, ParseContext } from '../parser/types';
import { generateToolboxConfig } from '../toolbox';
import { registerToolboxCallbacks } from '../toolbox/callbacks';
import { addRecentBlock, getSearchBlockTypes, setBlockSearchQuery } from '../toolbox/callbacks';
import { createBlocklyInteractionController, type BlocklyInteractionController } from '../interactions';
import type { BlocklyInteractionCapabilities } from '@/Workbench/EventsEditor/BlocklyCapabilitiesContext';
import type { BlocklyViewport } from '../session/BlocklyEditorSession';
import { editorConfigService } from '@/services/editorConfig';
import { isKeyboardInputTarget, isVisibleKeyboardScope } from '@/utils/keyboard';
import { EditorStore } from '@/stores/EditorStore';
import { withDisabledBlocksEnabled } from '../registry';
import { blocklyDarkTheme, blocklyLightTheme } from '../theme';

/**
 * Workspace 配置选项
 */
export interface WorkspaceOptions {
  /** 是否只读模式 */
  readOnly?: boolean;
  /** 是否显示工具箱 */
  showToolbox?: boolean;
  /** Blockly 媒体资源路径 */
  mediaPath?: string;
  /** 当前编辑的入口类型（用于动态筛选入口块） */
  entryType?: string;
  interactionCapabilities?: BlocklyInteractionCapabilities;
}

/**
 * 校验结果
 */
export interface ValidationResult {
  /** 是否通过校验 */
  valid: boolean;
  /** 错误信息列表 */
  errors: string[];
  /** 未连接的块数量 */
  disconnectedBlockCount: number;
}

/**
 * Workspace API
 */
export interface WorkspaceAPI {
  /** 获取 Blockly Workspace 实例（在回调/Effect中调用） */
  getWorkspace: () => Blockly.WorkspaceSvg | null;
  /** 是否已初始化 */
  isReady: boolean;
  /** 加载 JSON 状态到工作区 */
  loadState: (state: object) => void;
  /** 保存工作区状态为 JSON */
  saveState: () => object;
  /** 生成代码（只生成与入口块相连的块） */
  generateCode: () => string;
  /** 清空工作区 */
  clear: () => void;
  /** 加载事件数据到工作区（解析为细粒度块） */
  loadEventData: (events: EventData[]) => void;
  /** 加载带入口块的数据到工作区 */
  loadEntryData: (data: unknown, entryType: string, project?: ParseContext['project']) => void;
  /** 获取顶层入口块类型 */
  getTopBlockType: () => string | null;
  /** 校验工作区（检查是否有未连接的块） */
  validate: () => ValidationResult;
  /** 更新搜索分类并刷新当前 flyout */
  searchBlocks: (query: string) => void;
  runSelectedPointInteraction: () => Promise<boolean>;
  getViewport: () => BlocklyViewport;
  restoreViewport: (viewport: BlocklyViewport, selectedBlockId?: string) => void;
  getSelectedBlockId: () => string | undefined;
  refreshToolbox: () => void;
}

// 用于追踪积木块是否已注册
let blocksRegistered = false;

/**
 * 检查块是否为入口块（_m 后缀的顶级块）
 */
function isEntryBlock(block: Blockly.Block): boolean {
  return block.type.endsWith('_m');
}

/**
 * 获取所有入口块
 */
function getEntryBlocks(workspace: Blockly.WorkspaceSvg): Blockly.Block[] {
  const topBlocks = workspace.getTopBlocks(false);
  return topBlocks.filter(isEntryBlock);
}

/**
 * 获取未连接到入口块的顶级块
 */
function getDisconnectedBlocks(workspace: Blockly.WorkspaceSvg): Blockly.Block[] {
  const topBlocks = workspace.getTopBlocks(false);
  return topBlocks.filter((block) => !isEntryBlock(block));
}

/**
 * Replacing an editor document is not a user edit. Keep Blockly from emitting
 * draft changes or recording the previous document in the next document's
 * undo stack.
 */
function replaceWorkspaceContents(workspace: Blockly.WorkspaceSvg, load: () => void): void {
  const eventsWereEnabled = Blockly.Events.isEnabled();
  if (eventsWereEnabled) Blockly.Events.disable();
  try {
    workspace.clear();
    load();
  } finally {
    if (eventsWereEnabled) Blockly.Events.enable();
  }
  workspace.clearUndo();
}

/**
 * Blockly Workspace 管理 Hook
 *
 * @param containerRef - 容器元素的 ref
 * @param options - 配置选项
 * @returns Workspace API
 */
export function useBlocklyWorkspace(
  containerRef: RefObject<HTMLDivElement | null>,
  options: WorkspaceOptions = {},
): WorkspaceAPI {
  const { theme: editorTheme } = EditorStore.useStore();
  const blocklyTheme = editorTheme === 'editor_color_dark' ? blocklyDarkTheme : blocklyLightTheme;
  const initialBlocklyThemeRef = useRef(blocklyTheme);
  const {
    readOnly = false,
    showToolbox = true,
    mediaPath = new URL('assets/blockly-media/', document.baseURI).href,
    entryType,
  } = options;

  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const interactionControllerRef = useRef<BlocklyInteractionController | null>(null);
  // ready 必须属于当前 hook 实例。全局 ready 会让新建的
  // BlocklyWorkspace 借用已销毁实例的 true，从而在 inject 之前吞掉 import。
  const [isReady, setIsReady] = useState(false);

  // 初始化 Workspace
  useEffect(() => {
    if (!containerRef.current) return;

    // 注册积木块（只注册一次）
    if (!blocksRegistered) {
      registerAllBlocks();
      blocksRegistered = true;
      // @ts-expect-error 类型推导有问题
      Blockly.setLocale(Zh);
    }

    // 创建工具箱配置
    const toolbox = showToolbox ? generateToolboxConfig(entryType) : undefined;

    // 创建 Workspace
    const workspace = Blockly.inject(containerRef.current, {
      toolbox,
      media: mediaPath,
      theme: initialBlocklyThemeRef.current,
      readOnly,
      zoom: {
        controls: true,
        wheel: false,
        startScale: 1.0,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2,
      },
      trashcan: !readOnly,
      move: {
        scrollbars: true,
        drag: true,
        wheel: true,
      },
    });

    workspaceRef.current = workspace;
    setIsReady(true);

    const trackCreatedBlocks = (event: Blockly.Events.Abstract) => {
      if (event.type !== Blockly.Events.BLOCK_CREATE) return;
      const ids = (event as Blockly.Events.BlockCreate).ids ?? [];
      for (const id of ids) {
        const type = workspace.getBlockById(id)?.type;
        if (type && !type.endsWith('_m')) addRecentBlock(type);
      }
    };
    const trackToolboxCategory = (event: Blockly.Events.Abstract) => {
      if (event.type !== Blockly.Events.TOOLBOX_ITEM_SELECT) return;
      const selected = (event as Blockly.Events.ToolboxItemSelect).newItem;
      if (selected) editorConfigService.set('blocklyLastToolboxCategory', selected);
    };
    workspace.addChangeListener(Blockly.Events.disableOrphans);
    workspace.addChangeListener(trackCreatedBlocks);
    workspace.addChangeListener(trackToolboxCategory);

    const handleToolboxShortcut = (event: KeyboardEvent) => {
      if (!isVisibleKeyboardScope(containerRef.current) || isKeyboardInputTarget(event.target)) return;
      const toolbox = workspace.getToolbox();
      if (!toolbox) return;
      if (event.key === 'Escape') {
        toolbox.clearSelection();
        return;
      }
      if (!/^[1-9]$/.test(event.key)) return;
      const item = (toolbox as Blockly.Toolbox).getToolboxItems()[Number(event.key) - 1];
      if (!item) return;
      event.preventDefault();
      toolbox.setSelectedItem(item);
    };
    window.addEventListener('keydown', handleToolboxShortcut);

    // 注册工具箱动态分类回调
    if (showToolbox) {
      registerToolboxCallbacks(workspace, entryType);
      window.requestAnimationFrame(() => {
        const toolbox = workspace.getToolbox() as Blockly.Toolbox | null;
        const selectedId = editorConfigService.get<string>('blocklyLastToolboxCategory', '');
        const selected = toolbox?.getToolboxItems().find((item) => item.getId() === selectedId);
        if (selected) toolbox?.setSelectedItem(selected);
      });
    }

    // 清理函数
    return () => {
      workspace.removeChangeListener(Blockly.Events.disableOrphans);
      workspace.removeChangeListener(trackCreatedBlocks);
      workspace.removeChangeListener(trackToolboxCategory);
      window.removeEventListener('keydown', handleToolboxShortcut);
      workspace.dispose();
      workspaceRef.current = null;
      setIsReady(false);
    };
  }, [containerRef, readOnly, showToolbox, mediaPath, entryType]);

  // Changing the editor theme must not recreate the workspace: doing so would
  // discard Blockly's selection, viewport and undo state. Blockly can refresh
  // all themed components in place.
  useEffect(() => {
    workspaceRef.current?.setTheme(blocklyTheme);
  }, [blocklyTheme, isReady]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace || !options.interactionCapabilities) return;
    const controller = createBlocklyInteractionController(workspace, options.interactionCapabilities);
    interactionControllerRef.current = controller;
    return () => {
      controller.dispose();
      if (interactionControllerRef.current === controller) interactionControllerRef.current = null;
    };
  }, [isReady, options.interactionCapabilities]);

  // 加载状态
  const loadState = useCallback((state: object) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    Blockly.serialization.workspaces.load(state, workspace);
    interactionControllerRef.current?.refresh();
  }, []);

  // 保存状态
  const saveState = useCallback((): object => {
    const workspace = workspaceRef.current;
    if (!workspace) return {};

    return Blockly.serialization.workspaces.save(workspace);
  }, []);

  // 生成代码（只生成与入口块相连的块）
  const generateCode = useCallback((): string => {
    const workspace = workspaceRef.current;
    if (!workspace) return '';

    // 获取所有入口块
    const entryBlocks = getEntryBlocks(workspace);

    if (entryBlocks.length === 0) {
      return '';
    }

    // 只为入口块生成代码
    return withDisabledBlocksEnabled(workspace, () => {
      javascriptGenerator.init(workspace);
      const codeBlocks: string[] = [];
      for (const block of entryBlocks) {
        const code = javascriptGenerator.blockToCode(block);
        if (code) {
          // blockToCode 可能返回 [code, order] 数组或字符串
          const codeStr = Array.isArray(code) ? code[0] : code;
          if (codeStr) {
            codeBlocks.push(codeStr);
          }
        }
      }
      return codeBlocks.join('\n');
    });
  }, []);

  // 清空工作区
  const clear = useCallback(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    workspace.clear();
  }, []);

  // 加载事件数据（解析为细粒度块）
  const loadEventData = useCallback((events: EventData[]) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    const state = eventsToWorkspaceState(events);
    replaceWorkspaceContents(workspace, () => {
      Blockly.serialization.workspaces.load(state, workspace);
    });
    interactionControllerRef.current?.refresh();
  }, []);

  // 加载带入口块的数据
  const loadEntryData = useCallback((data: unknown, entryType: string, project?: ParseContext['project']) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    const state = dataToWorkspaceStateWithEntry(data, entryType, project);
    replaceWorkspaceContents(workspace, () => {
      Blockly.serialization.workspaces.load(state, workspace);
    });
    interactionControllerRef.current?.refresh();

    // clear/load 不会重置 Blockly 的平移位置。新事件的入口块固定生成在
    // (50, 50)，如果沿用上一个大事件的视口，看起来就会像“内容为空”。
    const entryBlock = workspace.getTopBlocks(false)[0];
    if (entryBlock) {
      window.requestAnimationFrame(() => {
        if (!workspaceRef.current || workspaceRef.current !== workspace) return;
        workspace.centerOnBlock(entryBlock.id);
      });
    }
  }, []);

  // 获取顶层入口块类型
  const getTopBlockType = useCallback((): string | null => {
    const workspace = workspaceRef.current;
    if (!workspace) return null;

    const topBlocks = workspace.getTopBlocks(false);
    if (topBlocks.length === 0) return null;

    return topBlocks[0].type;
  }, []);

  // 获取 Workspace 实例（应在回调或 Effect 中调用）
  const getWorkspace = useCallback((): Blockly.WorkspaceSvg | null => workspaceRef.current, []);

  // 校验工作区（检查是否有未连接的块）
  const validate = useCallback((): ValidationResult => {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return { valid: true, errors: [], disconnectedBlockCount: 0 };
    }

    const disconnectedBlocks = getDisconnectedBlocks(workspace);
    const errors: string[] = [];

    if (disconnectedBlocks.length > 0) {
      errors.push(`存在 ${disconnectedBlocks.length} 个未连接到入口块的块，请将它们连接到入口块或删除`);

      // 添加具体的块类型信息（可选）
      const blockTypes = [...new Set(disconnectedBlocks.map((b) => b.type))];
      if (blockTypes.length <= 5) {
        errors.push(`未连接的块类型: ${blockTypes.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      disconnectedBlockCount: disconnectedBlocks.length,
    };
  }, []);

  const searchBlocks = useCallback((query: string) => {
    setBlockSearchQuery(query);
    const toolbox = workspaceRef.current?.getToolbox() as Blockly.Toolbox | null;
    if (!toolbox) return;
    const searchCategory = toolbox
      .getToolboxItems()
      .find(
        (item) =>
          item.isSelectable() &&
          'getName' in item &&
          typeof item.getName === 'function' &&
          item.getName() === '最近使用事件',
      );
    if (searchCategory) {
      toolbox.setSelectedItem(searchCategory);
      const div = searchCategory.getDiv();
      div?.setAttribute('data-test-id', 'event-editor-search-results');
      div?.setAttribute('data-search-active', 'true');
      div?.setAttribute('data-result-count', String(getSearchBlockTypes(query).length));
    }
    toolbox.refreshSelection();
  }, []);

  const refreshToolbox = useCallback(() => {
    const workspace = workspaceRef.current;
    if (!workspace || !showToolbox) return;
    const previous = workspace.getToolbox() as Blockly.Toolbox | null;
    const selectedId = previous?.getSelectedItem()?.getId();
    workspace.updateToolbox(generateToolboxConfig(entryType));
    if (!selectedId) return;
    const next = workspace.getToolbox() as Blockly.Toolbox | null;
    const selected = next?.getToolboxItems().find((item) => item.getId() === selectedId);
    if (selected) next?.setSelectedItem(selected);
  }, [entryType, showToolbox]);

  const runSelectedPointInteraction = useCallback(
    async () => interactionControllerRef.current?.runSelectedPointInteraction() ?? false,
    [],
  );

  const getViewport = useCallback((): BlocklyViewport => {
    const workspace = workspaceRef.current;
    return workspace
      ? { x: workspace.scrollX, y: workspace.scrollY, scale: workspace.scale }
      : { x: 0, y: 0, scale: 1 };
  }, []);

  const restoreViewport = useCallback((viewport: BlocklyViewport, selectedBlockId?: string) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    workspace.setScale(viewport.scale);
    workspace.scroll(viewport.x, viewport.y);
    const selected = selectedBlockId ? workspace.getBlockById(selectedBlockId) : null;
    selected?.select();
  }, []);
  const getSelectedBlockId = useCallback(() => Blockly.getSelected()?.id, []);

  // 使用 useMemo 稳定返回对象的引用
  return useMemo<WorkspaceAPI>(
    () => ({
      getWorkspace,
      isReady,
      loadState,
      saveState,
      generateCode,
      clear,
      loadEventData,
      loadEntryData,
      getTopBlockType,
      validate,
      searchBlocks,
      runSelectedPointInteraction,
      getViewport,
      restoreViewport,
      getSelectedBlockId,
      refreshToolbox,
    }),
    [
      getWorkspace,
      isReady,
      loadState,
      saveState,
      generateCode,
      clear,
      loadEventData,
      loadEntryData,
      getTopBlockType,
      validate,
      searchBlocks,
      runSelectedPointInteraction,
      getViewport,
      restoreViewport,
      getSelectedBlockId,
      refreshToolbox,
    ],
  );
}
