/**
 * TernServerInitializer - Tern 服务器初始化组件
 *
 * 无 UI 的逻辑组件，用于订阅工程定义模型并创建 TernServer 实例。
 *
 * 职责：
 * - 从 ProjectModel 获取静态工程定义
 * - 创建 TernServer 实例
 * - 设置 CodeMirror 事件监听（cursorActivity, inputRead）
 * - 在 cleanup 时移除事件监听
 */

import { useEffect, type RefObject } from "react";
import {
  createTernServer,
  destroyTernServer,
  type TernServerInstance,
} from "../utils/createTernServer";
import { attachTernEditorInteractions } from "../utils/ternEditorInteractions";
import type { CodeMirrorInstance } from "../types";
import { projectModel } from "@/project/model/projectModel";
import { useSignal } from "@/hooks/useFs";
import { useCurrentFn } from "@motajs/react-hooks";

/**
 * TernServerInitializer 组件属性
 */
interface TernServerInitializerProps {
  /** CodeMirror 编辑器实例 */
  codeEditor: CodeMirrorInstance;
  /** TernServer 实例的 ref，由父组件提供 */
  ref: RefObject<TernServerInstance | null>;
  /** 获取当前自动补全状态的函数 */
  getAutocomplete: () => boolean;
  /** Registers application-owned Docs before editor interactions start. */
  registerDocuments?: (server: TernServerInstance) => void;
  /** Releases an application-owned server reference during cleanup. */
  unregisterDocuments?: (server: TernServerInstance) => void;
  /** TernServer 就绪时的回调 */
  onReady?: () => void;
  /** TernServer 加载或创建失败时的回调 */
  onError?: (error: Error) => void;
}

/**
 * TernServerInitializer - Tern 服务器初始化组件
 *
 * 数据加载不会挂起父级 UI；定义就绪后创建 TernServer 并设置监听。
 *
 * @example
 * ```tsx
 * <TernServerInitializer
 *   codeEditor={codeEditorRef.current}
 *   ref={ternServerRef}
 *   getAutocomplete={() => stateRef.current.lintAutocomplete}
 * />
 * ```
 */
export function TernServerInitializer({
  codeEditor,
  ref,
  getAutocomplete,
  registerDocuments,
  unregisterDocuments,
  onReady,
  onError,
}: TernServerInitializerProps) {
  const resource = projectModel.ternDefinitions();
  const content = useSignal(resource.content);
  const loadedBundle = content.status === "loaded" ? content.value : null;
  const signalReady = useCurrentFn(() => onReady?.());
  const signalError = useCurrentFn((error: Error) => onError?.(error));
  const autocompleteEnabled = useCurrentFn(() => getAutocomplete());

  useEffect(() => {
    if (content.status !== "idle") return;
    void resource.ensureLoaded().catch((error) => {
      signalError(error instanceof Error ? error : new Error(String(error)));
    });
  }, [content.status, resource, signalError]);

  useEffect(() => {
    if (content.status === "error") {
      signalError(content.error);
    }
  }, [content, signalError]);

  // ========== 创建 TernServer 并设置事件 ==========
  useEffect(() => {
    if (!loadedBundle) return;

    let ternServer: TernServerInstance;
    try {
      ternServer = createTernServer({
        ternDefs: loadedBundle.defs,
        documents: loadedBundle.documents,
      });
      if (registerDocuments) registerDocuments(ternServer);
      else ternServer.addDoc("doc", codeEditor.getDoc());
    } catch (error) {
      signalError(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    ref.current = ternServer;

    const detachInteractions = attachTernEditorInteractions({
      editor: codeEditor,
      server: ternServer,
      getAutocomplete: autocompleteEnabled,
    });

    // 调用就绪回调
    signalReady();

    // cleanup：移除事件监听
    return () => {
      detachInteractions();
      unregisterDocuments?.(ternServer);
      destroyTernServer(ternServer);
      if (ref.current === ternServer) ref.current = null;
    };
  }, [
    autocompleteEnabled,
    codeEditor,
    loadedBundle,
    ref,
    registerDocuments,
    signalError,
    signalReady,
    unregisterDocuments,
  ]);

  // 无 UI 的逻辑组件
  return null;
}
