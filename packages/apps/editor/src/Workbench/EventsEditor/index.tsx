import type { FC } from "react";
import { useRef, useEffect, useState, useCallback } from "react";
import * as Blockly from "blockly";

import { BlocklyWorkspace } from "@/blockly/components/BlocklyWorkspace";
import { createEditorBlocklyApi } from "@/blockly/api/editorBlockly";
import type { BlocklyWorkspaceRef, BlocklyWorkspaceProps } from "@/blockly/components/BlocklyWorkspace";
import type { EditorBlocklyApi } from "@/blockly/api/editorBlockly";
import { useEventEditorRegistration, type EventEditorOpenRequest } from "./EventEditorContext";
import { useBlocklyInteractionCapabilities } from "./BlocklyCapabilitiesContext";
import {
  BlocklyEditorSession,
  blocklySessionStore,
} from "@/blockly/session/BlocklyEditorSession";
import { useConfigItem } from "@/stores/useEditorConfig";
import { projectData } from "@/project/data/projectData";
import { useCurrentFn } from "@motajs/react-hooks";
import { createPortal } from "react-dom";
import JSON5 from "json5";
import { Blocks } from "lucide-react";
import { setUnknownBlockRegistrationHandler } from "@/blockly/fields";
import {
  loadProjectBlockPack,
  subscribeProjectBlockPack,
} from "@/blockly/project";
import {
  CustomBlockManager,
  type CustomBlockRegistrationSeed,
} from "./CustomBlockManager";
import "./events-editor.css";

function currentEntryProjectContext() {
  const content = projectData.tower().content();
  const main = content.status === "loaded" ? content.value.main : undefined;
  const strings = (value: unknown): string[] => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
  return {
    bgms: strings(main?.bgms),
    sounds: strings(main?.sounds),
    images: strings(main?.images),
    animates: strings(main?.animates),
  };
}

/**
 * 事件编辑器组件
 *
 * 基于 Blockly V12 的事件编辑器，用于编辑 MotaAction JSON
 */
export const EventsEditor: FC = () => {
  const workspaceRef = useRef<BlocklyWorkspaceRef>(null);
  const apiRef = useRef<EditorBlocklyApi | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  const [codePreview, setCodePreview] = useState("");
  const [sourceDirty, setSourceDirty] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customBlockManagerOpen, setCustomBlockManagerOpen] = useState(false);
  const [customBlockRegistration, setCustomBlockRegistration] = useState<CustomBlockRegistrationSeed | null>(null);
  const visibleRef = useRef(false);
  const customBlockRequestIdRef = useRef(0);
  const sessionRef = useRef<BlocklyEditorSession | null>(null);
  const requestRef = useRef<EventEditorOpenRequest | null>(null);
  const suppressDraftNotificationRef = useRef(false);
  const pendingImportRef = useRef<{
    revision: number;
    run(api: EditorBlocklyApi): void;
  } | null>(null);
  const nextImportRevisionRef = useRef(0);
  const [importRevision, setImportRevision] = useState(0);
  const registerEventEditor = useEventEditorRegistration();
  const capabilities = useBlocklyInteractionCapabilities();
  const confirmInteraction = useCurrentFn((message: string) => capabilities.confirm(message));
  const reportInteraction = useCurrentFn((message: string, level: "error" | "warning" | "info") => (
    capabilities.report(message, level)
  ));
  const selectPointInteraction = useCurrentFn(async () => {
    await capabilities.selectPoint({ multiple: true });
  });
  const [disableReplace, setDisableReplace] = useConfigItem("disableBlocklyReplace", false);
  const [disableExpandCompare, setDisableExpandCompare] = useConfigItem("disableBlocklyExpandCompare", false);

  useEffect(() => {
    setUnknownBlockRegistrationHandler((request) => {
      setCustomBlockRegistration({ raw: request.raw, requestId: ++customBlockRequestIdRef.current });
      setCustomBlockManagerOpen(true);
    });
    return () => setUnknownBlockRegistrationHandler(null);
  }, []);

  const saveSessionViewport = useCallback(() => {
    const session = sessionRef.current;
    const api = workspaceRef.current?.getApi();
    if (!session || !api) return;
    session.setViewport(api.getViewport(), api.getSelectedBlockId());
    blocklySessionStore.save(session);
  }, []);

  // 显示编辑器
  const showEditor = useCallback(() => {
    visibleRef.current = true;
    setIsVisible(true);
    // 更新 DOM 样式以兼容旧版样式
    const panel = document.getElementById("left6");
    if (panel) {
      panel.style.zIndex = "999";
      panel.style.opacity = "1";
    }
  }, []);

  // 隐藏编辑器
  const hideEditor = useCallback(() => {
    visibleRef.current = false;
    workspaceRef.current?.getApi().getWorkspace()?.hideChaff();
    Blockly.WidgetDiv.hide();
    Blockly.DropDownDiv.hideWithoutAnimation();
    setIsVisible(false);
    // 更新 DOM 样式以兼容旧版样式
    const panel = document.getElementById("left6");
    if (panel) {
      panel.style.zIndex = "-1";
      panel.style.opacity = "0";
    }
  }, []);

  // API 与 opener 必须在同一个 effect 中成对注册。否则 provider 可能在 API
  // 尚未就绪的间隙投递 open 请求，源码状态虽然更新了，Blockly import 却会被
  // 可选链静默丢弃。
  useEffect(() => {
    const api = createEditorBlocklyApi(
      () => workspaceRef.current,
      showEditor,
      hideEditor,
      {
        hasUnparsedSource: () => sessionRef.current?.hasUnparsedSource() ?? false,
        confirm: confirmInteraction,
        report: reportInteraction,
        selectPoint: selectPointInteraction,
      },
    );
    apiRef.current = api;
    const openRequest = (request: EventEditorOpenRequest) => {
      const isCommonEventWorkspace = request.contextId.startsWith("common-event-workspace:");
      // 公共事件源码允许保留暂时无法解析的 JSON5 草稿。重新切回该事件时，
      // 字符串本身就是源码，不能再次 JSON.stringify，否则会被包成字符串字面量。
      const source = isCommonEventWorkspace && typeof request.initialValue === "string"
        ? request.initialValue
        : JSON.stringify(request.initialValue ?? null, null, 2);
      const currentSession = sessionRef.current;
      const currentState = currentSession?.snapshot();
      if (
        currentSession
        && currentState?.contextId === request.contextId
        && currentState.entryType === request.entryType
        && currentState.sourceText === source
        && !currentSession.hasUnparsedSource()
        && visibleRef.current
      ) {
        // React StrictMode 和数据资源刷新都可能重复投递同一个 open。不要因此
        // 保存默认视口并重新导入，否则第二次导入会把入口块移出视口。
        requestRef.current = request;
        return;
      }
      saveSessionViewport();
      const session = new BlocklyEditorSession(request.contextId, request.entryType, source);
      const restoredSession = isCommonEventWorkspace
        ? blocklySessionStore.restoreViewport(session)
        : blocklySessionStore.restore(session);
      sessionRef.current = session;
      requestRef.current = request;
      suppressDraftNotificationRef.current = true;
      const restoredSource = session.snapshot().sourceText;
      setCodePreview(restoredSource);
      setSourceDirty(session.hasUnparsedSource());
      setEmbedded(isCommonEventWorkspace);
      let initialValue = request.initialValue;
      try {
        initialValue = JSON5.parse(restoredSource);
      } catch {
        // 保留原始值，源码区会继续显示未解析草稿。
      }
      const revision = ++nextImportRevisionRef.current;
      pendingImportRef.current = {
        revision,
        run: (currentApi) => currentApi.import(
          initialValue,
          {
            type: request.entryType,
            contextId: request.contextId,
            project: currentEntryProjectContext(),
          },
          {
            onConfirm: request.onConfirm,
            onCancel: request.onCancel,
            onLoaded: () => {
              if (sessionRef.current !== session) return;
              // 新 session 由 loadEntryData 将入口块居中；只有确实保存过视口时才
              // 恢复，否则默认 (0, 0) 会把刚加载的块重新推到可视区域之外。
              if (restoredSession) {
                const state = session.snapshot();
                workspaceRef.current?.getApi().restoreViewport(state.viewport, state.selectedBlockId);
              }
              suppressDraftNotificationRef.current = false;
            },
          },
        ),
      };
      setImportRevision(revision);
    };
    const unregister = registerEventEditor((request) => {
      void loadProjectBlockPack()
        .catch((error) => reportInteraction(
          `自定义事件块加载失败：${error instanceof Error ? error.message : String(error)}`,
          "error",
        ))
        .finally(() => openRequest(request));
    });

    return () => {
      unregister();
      if (apiRef.current === api) apiRef.current = null;
    };
  }, [
    confirmInteraction,
    hideEditor,
    registerEventEditor,
    reportInteraction,
    saveSessionViewport,
    selectPointInteraction,
    showEditor,
  ]);

  // embedded 状态会改变 portal 目标并重建 BlocklyWorkspace。等这次 render 的
  // 子组件 effect 完成后，再向当前 API 导入数据，避免加载到即将销毁的旧实例。
  useEffect(() => {
    const pending = pendingImportRef.current;
    if (!pending || pending.revision !== importRevision || !apiRef.current) return;
    pendingImportRef.current = null;
    pending.run(apiRef.current);
  }, [importRevision]);

  useEffect(() => subscribeProjectBlockPack(() => {
    const workspace = workspaceRef.current?.getApi();
    workspace?.refreshToolbox();
    const session = sessionRef.current;
    const api = apiRef.current;
    if (!workspace || !session || !api || session.hasUnparsedSource()) return;
    const state = session.snapshot();
    const viewport = workspace.getViewport();
    const selected = workspace.getSelectedBlockId();
    suppressDraftNotificationRef.current = true;
    if (api.parse(state.sourceText)) {
      requestAnimationFrame(() => {
        workspaceRef.current?.getApi().restoreViewport(viewport, selected);
        suppressDraftNotificationRef.current = false;
      });
    } else suppressDraftNotificationRef.current = false;
  }), []);

  // 处理工作区内容变化
  const handleChange: BlocklyWorkspaceProps["onChange"] = useCallback((json: string) => {
    // clear/load 会产生若干中间 change 事件。导入完成前完全忽略它们，避免将
    // [] 写入刚创建的 session；最终源码已由 open request 确定。
    if (suppressDraftNotificationRef.current) return;
    const session = sessionRef.current;
    if (!session || session.workspaceChanged(json)) setCodePreview(json);
    setSourceDirty(false);
    if (session) blocklySessionStore.save(session);
    if (!suppressDraftNotificationRef.current) {
      try {
        // Blockly generator 输出与确认/解析链一样是 JSON5，例如可能包含
        // 尾逗号。不能用 JSON.parse 失败后把整段源码当作事件值。
        requestRef.current?.onDraftChange?.(JSON5.parse(json));
      } catch {
        requestRef.current?.onDraftChange?.(json);
      }
    }
  }, []);

  // 处理确认按钮
  const handleConfirm = useCallback(() => {
    saveSessionViewport();
    void apiRef.current?.confirm();
  }, [saveSessionViewport]);

  // 处理应用按钮
  const handleApply = useCallback(() => {
    saveSessionViewport();
    void apiRef.current?.confirm(true);
  }, [saveSessionViewport]);

  // 处理取消按钮
  const handleCancel = useCallback(() => {
    saveSessionViewport();
    apiRef.current?.cancel();
  }, [saveSessionViewport]);

  // 将右侧源码重新解析到工作区。
  const handleParse = useCallback(() => {
    if (apiRef.current?.parse(codePreview)) {
      sessionRef.current?.parseSucceeded(codePreview);
      setSourceDirty(false);
    }
  }, [codePreview]);

  // 对当前选中块执行声明式选点交互。
  const handleSelectPoint = useCallback(() => {
    void apiRef.current?.selectPointFromButton();
  }, []);

  const handleSearchFlags = useCallback(() => {
    void capabilities.searchFlags();
  }, [capabilities]);

  // 修改展示偏好；重新解析时应用。
  const handleTriggerReplace = useCallback(() => {
    setDisableReplace(!disableReplace);
    capabilities.report("中文名替换偏好已更新，请点击“解析”重新构建当前工作区。", "info");
  }, [capabilities, disableReplace, setDisableReplace]);

  // 修改逻辑块展示偏好；重新解析时应用。
  const handleTriggerExpandCompare = useCallback(() => {
    setDisableExpandCompare(!disableExpandCompare);
    capabilities.report("比较展开偏好已更新，请点击“解析”重新构建当前工作区。", "info");
  }, [capabilities, disableExpandCompare, setDisableExpandCompare]);

  const editor = (
    <div
      id="left6"
      data-test-id="event-editor"
      className={embedded ? "leftTab eventEditorEmbedded" : "leftTab"}
      style={{ zIndex: isVisible ? (embedded ? 1 : 999) : -1, opacity: isVisible ? 1 : 0 }}
    >
      <div style={{ position: "relative", height: "95%" }}>
        {/* 工具栏 */}
        <h3 className="eventEditorToolbar">
          事件编辑器 (V12) &nbsp;&nbsp;
          {embedded ? (
            <button data-test-id="event-editor-save" onClick={handleApply}>保存</button>
          ) : (
            <>
              <button data-test-id="event-editor-confirm" onClick={handleConfirm}>确认</button>
              <button data-test-id="event-editor-apply" onClick={handleApply}>应用</button>
            </>
          )}
          <button id="blocklyParse" data-test-id="event-editor-parse" onClick={handleParse}>
            解析
          </button>
          {embedded ? null : <button data-test-id="event-editor-cancel" onClick={handleCancel}>取消</button>}
          <div
            style={{
              position: "relative",
              display: "inline-block",
              marginLeft: 10,
            }}
          >
            <div className="searchLogo" />
            <input
              type="text"
              id="searchBlock"
              data-test-id="event-editor-search"
              placeholder="搜索事件块..."
              value={searchQuery}
              onFocus={() => workspaceRef.current?.getApi().searchBlocks(searchQuery)}
              onChange={(event) => {
                const value = event.target.value;
                setSearchQuery(value);
                workspaceRef.current?.getApi().searchBlocks(value);
              }}
            />
          </div>
          <button
            className="cpPanel"
            data-test-id="event-editor-select-point"
            onClick={handleSelectPoint}
            style={{ marginLeft: 5 }}
          >
            地图选点
          </button>
          <button
            className="cpPanel"
            data-test-id="event-editor-search-flags"
            onClick={handleSearchFlags}
            style={{ marginLeft: 5 }}
          >
            变量搜索
          </button>
          <button
            className="cpPanel"
            data-test-id="custom-block-manager-open"
            onClick={() => {
              setCustomBlockRegistration(null);
              setCustomBlockManagerOpen(true);
            }}
            style={{ marginLeft: 5 }}
            title="管理和新增工程自定义事件块"
            type="button"
          >
            <Blocks aria-hidden size={15} /> 自定义块
          </button>
          <input
            type="checkbox"
            className="cpPanel"
            id="blocklyReplace"
            data-test-id="event-editor-replace"
            checked={!disableReplace}
            onChange={handleTriggerReplace}
            style={{ marginLeft: 10 }}
          />
          <span
            className="cpPanel"
            style={{ marginLeft: "-4px", fontSize: 13 }}
          >
            开启中文名替换
          </span>
          <input
            type="checkbox"
            className="cpPanel"
            id="blocklyExpandCompare"
            data-test-id="event-editor-expand-compare"
            checked={!disableExpandCompare}
            onChange={handleTriggerExpandCompare}
            style={{ marginLeft: 10 }}
          />
          <span
            className="cpPanel"
            style={{ marginLeft: "-4px", fontSize: 13 }}
          >
            展开值块逻辑运算
          </span>
        </h3>

        {/* Blockly 工作区和代码预览 */}
        <div style={{ position: "relative", height: "100%", display: "flex" }}>
          <div id="blocklyArea" style={{ flex: 1, position: "relative" }}>
            <BlocklyWorkspace
              ref={workspaceRef}
              onChange={handleChange}
              options={{ interactionCapabilities: capabilities }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
          <textarea
            id="codeArea"
            data-test-id="event-editor-source"
            spellCheck="false"
            value={codePreview}
            data-source-dirty={sourceDirty ? "true" : "false"}
            onChange={(event) => {
              sessionRef.current?.editSource(event.target.value);
              if (sessionRef.current) blocklySessionStore.save(sessionRef.current);
              requestRef.current?.onDraftChange?.(event.target.value);
              setCodePreview(event.target.value);
              setSourceDirty(true);
            }}
            style={{
              width: "300px",
              height: "100%",
              fontFamily: "monospace",
              fontSize: "12px",
            }}
          />
        </div>
      </div>
    </div>
  );
  const embeddedHost = embedded ? document.getElementById("common-event-editor-host") : null;
  const manager = (
    <CustomBlockManager
      open={customBlockManagerOpen}
      registration={customBlockRegistration}
      onClose={() => setCustomBlockManagerOpen(false)}
    />
  );
  return embeddedHost ? <>{createPortal(editor, embeddedHost)}{manager}</> : <>{editor}{manager}</>;
};
