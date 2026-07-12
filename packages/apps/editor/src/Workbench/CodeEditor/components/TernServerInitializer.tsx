/**
 * TernServerInitializer - Tern 服务器初始化组件
 *
 * 无 UI 的逻辑组件，用于订阅工程定义模型并创建 TernServer 实例。
 *
 * 职责：
 * - 从 ProjectModel 获取静态工程定义
 * - 创建 TernServer 实例
 * - 设置 CodeMirror 事件监听（cursorActivity, keyup）
 * - 在 cleanup 时移除事件监听
 */

import { useEffect, type RefObject } from "react";
import type { Editor } from "codemirror";
import {
  addTernDocument,
  createTernServer,
  type TernServerInstance,
} from "../utils/createTernServer";
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
  onReady,
  onError,
}: TernServerInitializerProps) {
  const resource = projectModel.ternDefinitions();
  const content = useSignal(resource.content);
  const signalReady = useCurrentFn(() => onReady?.());
  const signalError = useCurrentFn((error: Error) => onError?.(error));

  useEffect(() => {
    if (content.status !== "idle") return;
    void resource.reload().catch((error) => {
      signalError(error instanceof Error ? error : new Error(String(error)));
    });
  }, [content.status, resource, signalError]);

  // ========== 创建 TernServer 并设置事件 ==========
  useEffect(() => {
    if (content.status === "error") {
      signalError(content.error);
      return;
    }
    if (content.status !== "loaded") return;

    let ternServer: TernServerInstance;
    try {
      ternServer = createTernServer({
        ternDefs: content.value.defs,
        documents: content.value.documents,
      });
      addTernDocument(ternServer, "doc", codeEditor.getValue());
    } catch (error) {
      signalError(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    ref.current = ternServer;

    // ========== Tern 相关事件（原 setupEditorEvents）==========
    let ctrlRelease = Date.now();

    // 光标活动事件 - 更新参数提示和文档
    const handleCursorActivity = (cm: Editor) => {
      const cursor = cm.getCursor();
      if (getAutocomplete() && !(cursor.line === 0 && cursor.ch === 0)) {
        ternServer.updateArgHints(cm);
        ternServer.showDocs(cm);
      }
    };

    // 键盘释放事件 - 触发自动补全
    const handleKeyup = (cm: Editor, event: KeyboardEvent) => {
      if (!event) return;
      const now = Date.now();

      // 记录 Ctrl/Cmd 键释放时间
      if (event.keyCode === 17 || event.keyCode === 91) {
        // 17 = Ctrl, 91 = Cmd
        ctrlRelease = now;
        return;
      }

      // 自动补全触发条件：
      // 1. 自动补全已启用
      // 2. 没有按住 Ctrl
      // 3. 距离上次 Ctrl 释放超过 1 秒
      // 4. 按下的是字母键、点号或下划线
      if (
        getAutocomplete() &&
        !event.ctrlKey &&
        now - ctrlRelease >= 1000 &&
        ((event.keyCode >= 65 && event.keyCode <= 90) || // A-Z
          (!event.shiftKey && event.keyCode === 190) || // .
          (event.shiftKey && event.keyCode === 189)) // _
      ) {
        try {
          ternServer.complete(cm);
        } catch {
          // 忽略补全错误
        }
      }
    };

    // 注册事件监听
    codeEditor.on("cursorActivity", handleCursorActivity);
    codeEditor.on("keyup", handleKeyup);

    // 调用就绪回调
    signalReady();

    // cleanup：移除事件监听
    return () => {
      codeEditor.off("cursorActivity", handleCursorActivity);
      codeEditor.off("keyup", handleKeyup);
      ref.current = null;
    };
  }, [codeEditor, content, getAutocomplete, ref, signalError, signalReady]);

  // 无 UI 的逻辑组件
  return null;
}
