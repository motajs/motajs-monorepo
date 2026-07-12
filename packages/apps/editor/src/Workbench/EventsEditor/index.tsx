import type { FC } from 'react';
import { useRef, useEffect, useState, useCallback } from 'react';
import * as Blockly from 'blockly';

import { BlocklyWorkspace } from '@/blockly/components/BlocklyWorkspace';
import { createEditorBlocklyApi } from '@/blockly/api/editorBlockly';
import type { BlocklyWorkspaceRef, BlocklyWorkspaceProps } from '@/blockly/components/BlocklyWorkspace';
import type { EditorBlocklyApi } from '@/blockly/api/editorBlockly';
import { useEventEditorRegistration } from './EventEditorContext';
import { useBlocklyInteractionCapabilities } from './BlocklyCapabilitiesContext';
import {
  BlocklyEditorSession,
  blocklySessionStore,
} from '@/blockly/session/BlocklyEditorSession';
import { useConfigItem } from '@/stores/useEditorConfig';
import { projectData } from '@/project/data/projectData';
import { useCurrentFn } from '@/hooks/useCurrentFn';

function currentEntryProjectContext() {
  const content = projectData.tower().content();
  const main = content.status === 'loaded' ? content.value.main : undefined;
  const strings = (value: unknown): string[] => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
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
  const [codePreview, setCodePreview] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const sessionRef = useRef<BlocklyEditorSession | null>(null);
  const registerEventEditor = useEventEditorRegistration();
  const capabilities = useBlocklyInteractionCapabilities();
  const confirmInteraction = useCurrentFn((message: string) => capabilities.confirm(message));
  const reportInteraction = useCurrentFn((message: string, level: 'error' | 'warning' | 'info') => (
    capabilities.report(message, level)
  ));
  const selectPointInteraction = useCurrentFn(async () => {
    await capabilities.selectPoint({});
  });
  const [disableReplace, setDisableReplace] = useConfigItem('disableBlocklyReplace', false);
  const [disableExpandCompare, setDisableExpandCompare] = useConfigItem('disableBlocklyExpandCompare', false);

  const saveSessionViewport = useCallback(() => {
    const session = sessionRef.current;
    const api = workspaceRef.current?.getApi();
    if (!session || !api) return;
    session.setViewport(api.getViewport(), api.getSelectedBlockId());
    blocklySessionStore.save(session);
  }, []);

  // 显示编辑器
  const showEditor = useCallback(() => {
    setIsVisible(true);
    // 更新 DOM 样式以兼容旧版样式
    const panel = document.getElementById('left6');
    if (panel) {
      panel.style.zIndex = '999';
      panel.style.opacity = '1';
    }
  }, []);

  // 隐藏编辑器
  const hideEditor = useCallback(() => {
    workspaceRef.current?.getApi().getWorkspace()?.hideChaff();
    Blockly.WidgetDiv.hide();
    Blockly.DropDownDiv.hideWithoutAnimation();
    setIsVisible(false);
    // 更新 DOM 样式以兼容旧版样式
    const panel = document.getElementById('left6');
    if (panel) {
      panel.style.zIndex = '-1';
      panel.style.opacity = '0';
    }
  }, []);

  // 初始化当前编辑器实例使用的 API。
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

    return () => {
      if (apiRef.current === api) apiRef.current = null;
    };
  }, [showEditor, hideEditor, confirmInteraction, reportInteraction, selectPointInteraction]);

  useEffect(() => registerEventEditor((request) => {
    const source = JSON.stringify(request.initialValue ?? null, null, 2);
    const session = new BlocklyEditorSession(request.contextId, request.entryType, source);
    blocklySessionStore.restore(session);
    sessionRef.current = session;
    setCodePreview(source);
    apiRef.current?.import(
      request.initialValue,
      {
        type: request.entryType,
        contextId: request.contextId,
        project: currentEntryProjectContext(),
      },
      { onConfirm: request.onConfirm, onCancel: request.onCancel },
    );
    window.setTimeout(() => {
      if (sessionRef.current !== session) return;
      const state = session.snapshot();
      workspaceRef.current?.getApi().restoreViewport(state.viewport, state.selectedBlockId);
    }, 80);
  }), [registerEventEditor]);

  // 处理工作区内容变化
  const handleChange: BlocklyWorkspaceProps['onChange'] = useCallback((json: string) => {
    const session = sessionRef.current;
    if (!session || session.workspaceChanged(json)) setCodePreview(json);
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
    if (apiRef.current?.parse(codePreview)) sessionRef.current?.parseSucceeded(codePreview);
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
    capabilities.report('中文名替换偏好已更新，请点击“解析”重新构建当前工作区。', 'info');
  }, [capabilities, disableReplace, setDisableReplace]);

  // 修改逻辑块展示偏好；重新解析时应用。
  const handleTriggerExpandCompare = useCallback(() => {
    setDisableExpandCompare(!disableExpandCompare);
    capabilities.report('比较展开偏好已更新，请点击“解析”重新构建当前工作区。', 'info');
  }, [capabilities, disableExpandCompare, setDisableExpandCompare]);

  return (
    <div
      id="left6"
      data-test-id="event-editor"
      className="leftTab"
      style={{ zIndex: isVisible ? 999 : -1, opacity: isVisible ? 1 : 0 }}
    >
      <div style={{ position: 'relative', height: '95%' }}>
        {/* 工具栏 */}
        <h3>
          事件编辑器 (V12) &nbsp;&nbsp;
          <button data-test-id="event-editor-confirm" onClick={handleConfirm}>确认</button>
          <button data-test-id="event-editor-apply" onClick={handleApply}>应用</button>
          <button id="blocklyParse" data-test-id="event-editor-parse" onClick={handleParse}>
            解析
          </button>
          <button data-test-id="event-editor-cancel" onClick={handleCancel}>取消</button>
          <div
            style={{
              position: 'relative',
              display: 'inline-block',
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
            style={{ marginLeft: '-4px', fontSize: 13 }}
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
            style={{ marginLeft: '-4px', fontSize: 13 }}
          >
            展开值块逻辑运算
          </span>
        </h3>

        {/* Blockly 工作区和代码预览 */}
        <div style={{ position: 'relative', height: '100%', display: 'flex' }}>
          <div id="blocklyArea" style={{ flex: 1, position: 'relative' }}>
            <BlocklyWorkspace
              ref={workspaceRef}
              onChange={handleChange}
              options={{ interactionCapabilities: capabilities }}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          <textarea
            id="codeArea"
            data-test-id="event-editor-source"
            spellCheck="false"
            value={codePreview}
            data-source-dirty={sessionRef.current?.hasUnparsedSource() ? 'true' : 'false'}
            onChange={(event) => {
              sessionRef.current?.editSource(event.target.value);
              setCodePreview(event.target.value);
            }}
            style={{
              width: '300px',
              height: '100%',
              fontFamily: 'monospace',
              fontSize: '12px',
            }}
          />
        </div>
      </div>
    </div>
  );
};
