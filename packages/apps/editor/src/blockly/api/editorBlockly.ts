/**
 * EditorBlockly 兼容层 API
 *
 * 提供与旧版 editor_blockly 兼容的接口
 * 用于与现有的表格编辑器集成
 */

import type { BlocklyWorkspaceRef } from '../components/BlocklyWorkspace';
import { getEntryBlockType } from '../parser';
import JSON5 from 'json5';
import { diagnoseBlocklyEvents } from '../diagnostics/asyncDiagnostics';
import type { ParseContext } from '../parser/types';

/**
 * 编辑回调接口
 */
export interface EditorBlocklyCallbacks {
  /** 确认回调，接收已解析的值 */
  onConfirm: (value: unknown) => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * 编辑上下文
 */
interface EditContext {
  /** 入口类型 */
  entryType: string;
  /** 原始数据 */
  originalValue: unknown;
  /** 回调函数 */
  callbacks: EditorBlocklyCallbacks;
  project?: ParseContext['project'];
}

export interface EditorBlocklyDependencies {
  hasUnparsedSource?(): boolean;
  confirm?(message: string): boolean | Promise<boolean>;
  report?(message: string, level: 'error' | 'warning' | 'info'): void;
  selectPoint?(): Promise<void>;
}

/**
 * 入口类型到期望的块类型映射
 * 用于验证工作区中的入口块类型是否正确
 */
function getExpectedBlockType(entryType: string): string {
  return getEntryBlockType(entryType);
}

/**
 * 判断是否为 "common" 类入口
 * 这些入口类型可以使用 common_m 块
 */
function isCommonEntry(entryType: string): boolean {
  const commonEntries = [
    'common',
    'commonEvent',
    'item',
    'beforeBattle',
    'afterBattle',
    'afterOpenDoor',
    'firstArrive',
    'eachArrive',
  ];
  return commonEntries.includes(entryType);
}

/**
 * EditorBlockly API 接口
 */
export interface EditorBlocklyApi {
  /** 导入事件数据 */
  import: (
    initialValue: unknown,
    options: { type?: string; contextId?: string; project?: ParseContext['project'] },
    callbacks: EditorBlocklyCallbacks
  ) => void;
  /** 确认/应用编辑 */
  confirm: (apply?: boolean) => Promise<void>;
  /** 取消编辑 */
  cancel: () => void;
  /** 解析代码为积木块 */
  parse: (source?: string) => boolean;
  /** 对当前选中块执行地图选点 */
  selectPointFromButton: () => Promise<void>;
  /** 触发中文名替换 - 未实现 */
  triggerReplace: () => void;
  /** 触发展开逻辑运算 - 未实现 */
  triggerExpandCompare: () => void;
}

/**
 * 创建 EditorBlockly 兼容层 API
 *
 * @param getWorkspaceRef - 获取 BlocklyWorkspace ref 的函数
 * @param showEditor - 显示编辑器的函数
 * @param hideEditor - 隐藏编辑器的函数
 */
export function createEditorBlocklyApi(
  getWorkspaceRef: () => BlocklyWorkspaceRef | null,
  showEditor: () => void,
  hideEditor: () => void,
  dependencies: EditorBlocklyDependencies = {},
): EditorBlocklyApi {
  // 当前编辑上下文
  let currentContext: EditContext | null = null;
  let importGeneration = 0;

  return {
    import(
      initialValue: unknown,
      options: { type?: string; contextId?: string; project?: ParseContext['project'] } = {},
      callbacks: EditorBlocklyCallbacks
    ) {
      const entryType = options.type || 'common';
      const generation = ++importGeneration;

      // 保存编辑上下文
      currentContext = {
        entryType,
        originalValue: initialValue,
        callbacks,
        project: options.project,
      };

      // 显示编辑器
      showEditor();

      // Provider 可能先于 BlocklyWorkspace ref 完成注册。每次重试都重新读取
      // ref，避免第一次快速打开时永久丢失 import 请求。
      const loadWhenReady = () => {
        if (!currentContext || generation !== importGeneration) return;
        const workspaceRef = getWorkspaceRef();
        const workspaceApi = workspaceRef?.getApi();
        if (workspaceRef && workspaceApi?.isReady) {
          if (options.project) workspaceRef.loadEntryData(initialValue, entryType, options.project);
          else workspaceRef.loadEntryData(initialValue, entryType);
          return;
        }
        setTimeout(loadWhenReady, 50);
      };
      loadWhenReady();
    },

    async confirm(apply = false) {
      if (!currentContext) {
        console.warn('[EditorBlockly] 没有活动的编辑上下文');
        return;
      }

      if (dependencies.hasUnparsedSource?.()) {
        dependencies.report?.('源码已修改但尚未解析，请先点击“解析”。', 'error');
        return;
      }

      // 从 Workspace 获取内容
      const workspaceRef = getWorkspaceRef();
      if (!workspaceRef) {
        console.warn('[EditorBlockly] Workspace 不可用');
        return;
      }

      const api = workspaceRef.getApi();
      const workspace = api?.getWorkspace();

      if (!api || !api.isReady || !workspace) {
        console.warn('[EditorBlockly] Workspace 未就绪');
        return;
      }

      // 获取顶层块
      const topBlocks = workspace.getTopBlocks(false);

      // 验证入口块数量
      if (topBlocks.length >= 2) {
        dependencies.report?.('入口方块只能有一个', 'error');
        return;
      }

      const validation = api.validate();
      if (!validation.valid) {
        dependencies.report?.(validation.errors.join('\n'), 'error');
        return;
      }

      // 验证入口块类型
      if (topBlocks.length === 1) {
        const blockType = topBlocks[0].type;
        const expectedType = getExpectedBlockType(currentContext.entryType);
        const isCommon = isCommonEntry(currentContext.entryType);

        // 检查类型是否匹配
        if (blockType !== expectedType && !(isCommon && blockType === 'mota_common_m')) {
          dependencies.report?.(`入口方块类型错误，期望 ${expectedType}，实际为 ${blockType}`, 'error');
          return;
        }
      }

      let resultValue: unknown;

      try {
        // 生成代码
        const code = api.generateCode();

        if (!code || !code.trim()) {
          // 空工作区，根据入口类型返回空值
          resultValue = currentContext.entryType === 'shop' ? [] : null;
        } else {
          // 入口块的 generator 直接输出完整的 JSON 结构
          // 清理末尾换行
          const cleanedCode = code.trim();

          // 解析 JSON，失败则阻止确认
          try {
            resultValue = JSON5.parse(cleanedCode);
          } catch (parseError) {
            console.warn('[EditorBlockly] JSON 解析失败:', parseError);
            dependencies.report?.('生成的代码不是有效的 JSON，无法保存', 'error');
            return;
          }
        }
      } catch (e) {
        console.warn('[EditorBlockly] 代码生成失败:', e);
        dependencies.report?.('代码生成失败: ' + (e as Error).message, 'error');
        return;
      }

      const asyncDiagnostics = diagnoseBlocklyEvents(resultValue);
      if (asyncDiagnostics.length) {
        const continueSave = await (dependencies.confirm?.(
          `${asyncDiagnostics.map((item) => item.message).join('\n')}\n仍然保存吗？`,
        ) ?? true);
        if (!continueSave) return;
      }

      // 调用回调，传递已解析的值
      try {
        await currentContext.callbacks.onConfirm(resultValue);
      } catch (error) {
        console.warn('[EditorBlockly] 保存失败:', error);
        dependencies.report?.('保存失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
        return;
      }

      // 如果是应用模式（不关闭编辑器），显示保存成功提示
      if (apply) {
        dependencies.report?.('保存成功！', 'info');
      } else {
        // 关闭编辑器
        currentContext = null;
        hideEditor();
      }
    },

    cancel() {
      importGeneration += 1;
      currentContext?.callbacks.onCancel?.();
      currentContext = null;
      hideEditor();
    },

    parse(source = '') {
      if (!currentContext) return false;
      try {
        const value = JSON5.parse(source || 'null');
        getWorkspaceRef()?.loadEntryData(value, currentContext.entryType, currentContext.project);
        return true;
      } catch (error) {
        dependencies.report?.('解析失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
        return false;
      }
    },

    async selectPointFromButton() {
      const handled = await getWorkspaceRef()?.getApi().runSelectedPointInteraction();
      if (!handled) {
        if (dependencies.selectPoint) await dependencies.selectPoint();
        else dependencies.report?.('当前选中的块没有可写入的地图坐标', 'info');
      }
    },

    triggerReplace() {
      // 中文名替换属于显示增强，不改变事件数据；现代实现后续由 autocomplete model 提供。
    },

    triggerExpandCompare() {
      // Typed value blocks 会自然表达比较结构，不再在这里重写 workspace。
    },
  };
}
