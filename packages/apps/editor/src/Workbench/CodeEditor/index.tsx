import { useCurrentFn } from "@motajs/react-hooks";
import { useConfigItem } from "@/stores/useEditorConfig";
import { useState, useCallback, type FC, useRef, useEffect } from "react";
import CodeMirror from "codemirror";
// CodeMirror addon 和 CSS 导入
import "./setup";
import { JSHINT } from "jshint";
import beautifier from "js-beautify";
import {
  commandsName,
  getShortcutKeys,
  DEFAULT_CODEMIRROR_OPTIONS,
  PERSISTENT_SEARCH_KEYS,
  FONT_SIZE_CONFIG_KEY,
  DEFAULT_FONT_SIZE,
  API_DOCS_PATH,
  PLUGINS_URL,
  JSHINT_OPTIONS,
} from "./config/commands";
import type { TernServerInstance } from "./utils/createTernServer";
import { type EditContext, type EditorConfig } from "./contexts";
import type { CodeMirrorInstance } from "./types";
import type { OpenConfig, OpenCallbacks } from "./contexts";
import { isString } from "es-toolkit";
import { TernServerInitializer } from "./components";
import {
  useCodeEditorRegistration,
  type CodeEditorOpenRequest,
} from "./CodeEditorContext";
import { notifyError, notifySuccess } from "@/utils/notify";
import { editorDocsEndpoint } from "@/environment";
import { Modal } from "antd";

export const CodeEditor: FC = () => {
  // ========== React State ==========
  const [visible, setVisible] = useState(false);
  const [fontSize, setFontSize] = useConfigItem(FONT_SIZE_CONFIG_KEY, DEFAULT_FONT_SIZE);
  const [fontBold, setFontBold] = useState(false);
  const [lintEnabled, setLintEnabled] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [codeMirrorReady, setCodeMirrorReady] = useState(false);
  const [ternStatus, setTernStatus] = useState<"loading" | "ready" | "error">("loading");

  // ========== Refs ==========
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const codeEditorRef = useRef<CodeMirrorInstance>(null);
  const ternServerRef = useRef<TernServerInstance>(null);
  const extraKeysRef = useRef<CodeMirror.KeyMap>(null);
  const initialFontSizeRef = useRef(fontSize);
  const disposeRef = useRef<(() => void) | null>(null);
  const disposeTimerRef = useRef<number | null>(null);
  const registerCodeEditor = useCodeEditorRegistration();

  // 当前编辑上下文
  const contextRef = useRef<EditContext | null>(null);

  // 状态 ref（供 legacy API 访问）
  const stateRef = useRef({
    lintAutocomplete: false,
    preview: null as unknown,
  });

  // ========== useCurrentFn 包装的回调 ==========
  const show = useCurrentFn(() => {
    setVisible(true);
  });

  const hide = useCurrentFn(() => {
    setVisible(false);
  });

  const updateShowPreview = useCurrentFn((showValue: boolean) => {
    setShowPreview(showValue);
  });

  const updateLintEnabled = useCurrentFn((enabled: boolean) => {
    setLintEnabled(enabled);
  });

  const openUrl = useCurrentFn((url: string) => {
    window.open(url, "_blank");
  });

  // ========== 编辑器核心函数 ==========

  /**
   * 设置编辑器值并更新 Tern 文档
   */
  const setValue = useCurrentFn((val: string) => {
    const codeEditor = codeEditorRef.current;
    if (!codeEditor) return;

    codeEditor.setValue(val || "");
  });

  /**
   * 获取编辑器值
   */
  const getValue = useCurrentFn(() => codeEditorRef.current?.getValue() || "");

  /**
   * 格式化代码
   */
  const format = useCurrentFn(() => {
    if (!stateRef.current.lintAutocomplete) return;
    const codeEditor = codeEditorRef.current;
    if (!codeEditor) return;

    const offset = codeEditor.getScrollInfo().top || 0;
    setValue(beautifier.js(getValue(), {
      brace_style: "collapse" as const,
      indent_with_tabs: true,
      jslint_happy: true,
    }));
    codeEditor.scrollTo(0, offset);
  });

  /**
   * 设置 lint 状态
   */
  const setLint = useCurrentFn((enabled?: boolean) => {
    const codeEditor = codeEditorRef.current;
    if (!codeEditor) return;

    if (typeof enabled === "boolean") {
      stateRef.current.lintAutocomplete = enabled;
    }

    if (stateRef.current.lintAutocomplete) {
      codeEditor.setOption("lint", JSHINT_OPTIONS);
    } else {
      codeEditor.setOption("lint", false);
    }
    // autocomplete 是插件添加的配置项
    (codeEditor as { setOption: (name: string, value: unknown) => void }).setOption("autocomplete", stateRef.current.lintAutocomplete);
    updateLintEnabled(stateRef.current.lintAutocomplete);
  });

  // ========== Event Handlers ==========
  const handleLintToggle = useCallback(() => {
    const newValue = !lintEnabled;
    setLintEnabled(newValue);
    stateRef.current.lintAutocomplete = newValue;
    setLint(newValue);
  }, [lintEnabled, setLint]);

  const handleFontSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      setFontSize(value);
      if (codeEditorRef.current) {
        const wrapper = codeEditorRef.current.getWrapperElement();
        if (wrapper) {
          wrapper.style.fontSize = `${value}px`;
          wrapper.style.fontWeight = fontBold ? "bold" : "normal";
        }
      }
    },
    [fontBold, setFontSize]
  );

  const handleFontBoldChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      setFontBold(checked);
      if (codeEditorRef.current) {
        const wrapper = codeEditorRef.current.getWrapperElement();
        if (wrapper) {
          wrapper.style.fontSize = `${fontSize}px`;
          wrapper.style.fontWeight = checked ? "bold" : "normal";
        }
      }
    },
    [fontSize]
  );

  const handleCommandChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      e.target.selectedIndex = 0;
      if (!extraKeysRef.current || !codeEditorRef.current) return;
      const extraKeys = extraKeysRef.current;
      if (extraKeys[value]) {
        if (isString(extraKeys[value])) {
          codeEditorRef.current.execCommand(extraKeys[value]);
        } else {
          extraKeys[value](codeEditorRef.current);
        }
      }
    },
    []
  );

  // ========== Handler ref（在 useEditor 中初始化）==========

  const handleConfirm = useCallback(async (keep?: boolean) => {
    const context = contextRef.current;
    if (!context) return;

    // 统一的错误检查
    if (stateRef.current.lintAutocomplete) {
      const value = codeEditorRef.current?.getValue() ?? "";
      JSHINT(value, JSHINT_OPTIONS.options);
      const hasErrors = JSHINT.errors?.filter((e) => e?.code?.startsWith("E")).length > 0;
      if (hasErrors) {
        const first = JSHINT.errors?.find((error) => error?.code?.startsWith("E"));
        Modal.error({
          title: "代码无法保存",
          content: first
            ? `第 ${first.line} 行，第 ${first.character} 列：${first.reason}`
            : "当前代码存在语法错误，请修改后再保存。",
          okText: "返回修改",
        });
        return;
      }
    }

    try {
      await context.confirm(keep);
      if (!keep && contextRef.current === context) {
        contextRef.current = null;
      }
    } catch (error) {
      notifyError(error);
    }
  }, []);

  const handleCancel = useCallback(() => {
    const context = contextRef.current;
    if (!context) return;

    context.cancel();
    contextRef.current = null;
  }, []);

  const handleFormat = useCallback(() => {
    if (!stateRef.current.lintAutocomplete) {
      alert("只有代码才能进行格式化操作！");
      return;
    }
    format();
  }, [format]);

  const handlePreview = useCallback(() => {
    const preview = stateRef.current.preview;
    const value = codeEditorRef.current?.getValue() ?? "";
    if (preview) {
      if (contextRef.current?.onPreview) {
        void contextRef.current.onPreview(value);
      }
    }
  }, []);

  // 获取自动补全状态（供 TernServerInitializer 使用）
  const getAutocomplete = useCallback(() => stateRef.current.lintAutocomplete, []);

  // ========== 初始化 ==========
  useEffect(() => {
    if (disposeTimerRef.current != null) {
      window.clearTimeout(disposeTimerRef.current);
      disposeTimerRef.current = null;
    }

    const scheduleDispose = () => {
      disposeTimerRef.current = window.setTimeout(() => {
        disposeTimerRef.current = null;
        disposeRef.current?.();
        disposeRef.current = null;
      }, 0);
    };

    // React StrictMode immediately runs setup-cleanup-setup. Reuse the live instance
    // during that probe and only dispose when no replacement setup follows.
    if (disposeRef.current) return scheduleDispose;
    if (!textareaRef.current) return;

    // 创建 extraKeys 配置
    const docsUrl = editorDocsEndpoint(API_DOCS_PATH);
    const extraKeys: CodeMirror.KeyMap = {
      "Ctrl-/": (cm) => {
        cm.toggleComment();
      },
      "Ctrl-B": (cm) => {
        ternServerRef.current?.jumpToDef(cm);
      },
      "Ctrl-Q": (cm) => {
        ternServerRef.current?.rename(cm);
      },
      ...PERSISTENT_SEARCH_KEYS,
      "Ctrl-R": CodeMirror.commands.replaceAll,
      "Ctrl-D": (cm) => {
        const cursor = cm.getCursor();
        cm.foldCode(cursor);
      },
      ...(docsUrl ? { "Ctrl-O": () => openUrl(docsUrl) } : {}),
      "Ctrl-P": () => openUrl(PLUGINS_URL),
    };
    extraKeysRef.current = extraKeys;

    // 创建 CodeMirror 实例
    const codeEditor = CodeMirror.fromTextArea(textareaRef.current, {
      ...DEFAULT_CODEMIRROR_OPTIONS,
      extraKeys,
    });
    codeEditor.getInputField().setAttribute("data-test-id", "code-editor-input");
    codeEditorRef.current = codeEditor as unknown as CodeMirrorInstance;

    // 应用保存的字体大小
    const wrapper = codeEditor.getWrapperElement();
    if (wrapper) {
      wrapper.setAttribute("data-test-id", "code-editor-content");
      wrapper.style.fontSize = `${initialFontSizeRef.current}px`;
    }

    // 标记 CodeMirror 已就绪，触发 TernServerInitializer 渲染
    setCodeMirrorReady(true);

    // 注意：TernServer 的创建已移至 TernServerInitializer 组件
    // 该组件使用 Suspense 实现细粒度响应，在数据未就绪时挂起

    // ========== 创建 Handler ==========

    /**
     * 打开编辑器并设置上下文（内部接口，接收 EditContext）
     */
    const openWithContext = (context: EditContext, config: EditorConfig) => {
      // 设置上下文
      contextRef.current = context;

      // 设置状态
      stateRef.current.lintAutocomplete = config.lint ?? false;
      stateRef.current.preview = config.preview ?? null;

      // 设置编辑器值
      setValue(config.initialValue);

      // 更新 UI 状态
      updateShowPreview(!!config.preview);

      // 检查是否为函数代码
      if (config.initialValue.slice(0, 8) === "function") {
        stateRef.current.lintAutocomplete = true;
      }

      // 应用 lint 设置
      setLint();

      // 显示编辑器
      show();

      // 恢复滚动位置
      if (config.scrollTop) {
        codeEditorRef.current?.scrollTo(0, config.scrollTop);
      }
    };

    /**
     * 新的简洁 open 接口
     * 调用方负责准备初始值和处理回调
     */
    const open = (initialValue: string, config: OpenConfig, callbacks: OpenCallbacks) => {
      // 创建通用的 EditContext（内联对象，存储 callbacks）
      const context: EditContext = {
        id: config.contextId ?? "open",
        async confirm(keep?: boolean) {
          format();
          const value = getValue() || "";
          await callbacks.onConfirm(value);
          if (!keep) {
            hide();
          } else {
            notifySuccess("写入成功！");
          }
        },
        cancel() {
          callbacks.onCancel?.();
          hide();
        },
        onPreview: callbacks.onPreview,
      };

      // 调用内部 open 函数
      openWithContext(context, {
        initialValue,
        lint: config.lint,
        preview: config.preview,
        scrollTop: config.scrollTop,
      });
    };

    const unregister = registerCodeEditor((request: CodeEditorOpenRequest) => {
      open(
        request.initialValue,
        {
          contextId: request.contextId,
          lint: request.lint,
          preview: request.preview,
          scrollTop: request.scrollTop,
        },
        {
          onConfirm: request.onConfirm,
          onCancel: request.onCancel,
          onPreview: request.onPreview,
        },
      );
    });

    disposeRef.current = () => {
      unregister();
      ternServerRef.current = null;
      extraKeysRef.current = null;
      const fromTextArea = codeEditor as CodeMirror.EditorFromTextArea;
      fromTextArea.toTextArea?.();
      codeEditorRef.current = null;
    };
    return scheduleDispose;
    // All captured helpers are stable current-value callbacks; initialize exactly once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      id="left7"
      data-test-id="code-editor"
      data-tern-status={ternStatus}
      className={visible ? "" : "hidden-panel"}
      style={visible ? undefined : { zIndex: -1, opacity: 0 }}
    >
      {/* 多行文本编辑器 */}
      <div>
        <button data-test-id="code-editor-confirm" onClick={() => void handleConfirm()}>确认</button>
        <button data-test-id="code-editor-cancel" onClick={() => handleCancel()}>取消</button>
        <button data-test-id="code-editor-apply" onClick={() => void handleConfirm(true)}>应用</button>
        <button onClick={() => handleFormat()}>格式化</button>
        <button
          id="editor_multi_preview"
          data-test-id="code-editor-preview"
          style={{ display: showPreview ? "inline" : "none" }}
          onClick={handlePreview}
        >
          预览
        </button>
        <input
          type="checkbox"
          checked={lintEnabled}
          onChange={handleLintToggle}
          id="lintCheckbox"
          style={{ verticalAlign: "middle", marginLeft: 6 }}
        />
        <span style={{ verticalAlign: "middle", marginLeft: "-3px" }}>
          语法检查
        </span>
        <select
          id="codemirrorCommands"
          onChange={handleCommandChange}
          style={{ verticalAlign: "middle", marginLeft: 6 }}
        >
          <option value="">常用命令</option>
          {getShortcutKeys().map((key) => (
            <option key={key} value={key}>
              {commandsName[key]}
            </option>
          ))}
        </select>
        <span>字体大小</span>
        <input
          style={{ width: 40 }}
          type="number"
          value={fontSize}
          onChange={handleFontSizeChange}
          id="editor_multi_fontsize"
        />
        <span>字体加粗</span>
        <input
          type="checkbox"
          checked={fontBold}
          onChange={handleFontBoldChange}
          id="editor_multi_fontweight"
        />
      </div>
      <textarea
        ref={textareaRef}
        id="multiLineCode"
        data-test-id="code-editor-source"
        name="multiLineCode"
        defaultValue={""}
      />
      {/* Tern data loads independently and never blocks the editor surface. */}
      {codeMirrorReady && codeEditorRef.current && (
        <TernServerInitializer
          codeEditor={codeEditorRef.current}
          ref={ternServerRef}
          getAutocomplete={getAutocomplete}
          onReady={() => setTernStatus("ready")}
          onError={(error) => {
            console.warn("Tern initialization failed", error);
            setTernStatus("error");
          }}
        />
      )}
    </div>
  );
}
