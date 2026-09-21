import {
  MonacoEditor,
  MonacoModelScope,
  attachMonacoTypeSemanticHighlighting,
  monaco,
  type MonacoEditorInstance,
  type MonacoTextModel,
} from '@motajs/react-monaco-editor';
import beautifier from 'js-beautify';
import { parse } from 'acorn';
import { Dropdown, Modal } from 'antd';
import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import { notifyError, notifySuccess } from '@/utils/notify';
import { API_DOCS_PATH, commandsName, getShortcutKeys, PLUGINS_URL } from './config/commands';
import { useCodeEditorRegistration, type CodeEditorOpenRequest } from './CodeEditorContext';
import { editorDocsEndpoint } from '@/environment';
import { useProjectLanguageEnvironment } from './projectLanguageEnvironment';
import { CodeEditorSettingsButton } from './CodeEditorAppearance';
import { useCodeEditorAppearance } from './useCodeEditorAppearance';

type EditorLanguage = 'javascript' | 'json' | 'plaintext';

function languageFor(request: CodeEditorOpenRequest): EditorLanguage {
  if (request.language) return request.language;
  if (request.contextId.startsWith('project-schema:')) return 'json';
  return request.lint ? 'javascript' : 'plaintext';
}

function formatSource(source: string, language: EditorLanguage): string {
  if (language === 'json') return `${JSON.stringify(JSON.parse(source), null, 2)}\n`;
  if (language === 'javascript') {
    return beautifier.js(source, {
      brace_style: 'collapse',
      indent_with_tabs: true,
      jslint_happy: true,
    });
  }
  return source;
}

function validationError(source: string, language: EditorLanguage): Error | undefined {
  try {
    if (language === 'json') JSON.parse(source);
    if (language === 'javascript') {
      try {
        parse(source, { ecmaVersion: 'latest', locations: true });
      } catch (programError) {
        try {
          parse(`(${source}\n)`, { ecmaVersion: 'latest', locations: true });
        } catch {
          throw programError;
        }
      }
    }
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
  return undefined;
}

function updateSyntaxMarker(model: MonacoTextModel, language: EditorLanguage): void {
  if (language !== 'javascript') {
    monaco.editor.setModelMarkers(model, 'motajs-code-syntax', []);
    return;
  }
  const error = validationError(model.getValue(), language) as
    | (Error & {
        loc?: { line: number; column: number };
      })
    | undefined;
  monaco.editor.setModelMarkers(
    model,
    'motajs-code-syntax',
    error
      ? [
          {
            message: error.message,
            severity: monaco.MarkerSeverity.Error,
            startLineNumber: error.loc?.line ?? 1,
            startColumn: (error.loc?.column ?? 0) + 1,
            endLineNumber: error.loc?.line ?? 1,
            endColumn: (error.loc?.column ?? 0) + 2,
          },
        ]
      : [],
  );
}

export const CodeEditor: FC = () => {
  const [visible, setVisible] = useState(false);
  const appearance = useCodeEditorAppearance();
  const [request, setRequest] = useState<CodeEditorOpenRequest>();
  const [value, setValue] = useState('');
  const [model, setModel] = useState<MonacoTextModel>();
  const modelScopeRef = useRef<MonacoModelScope>(null);
  modelScopeRef.current ??= new MonacoModelScope();
  const scopeGenerationRef = useRef(0);
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const applyingRef = useRef(false);
  const requestRef = useRef<CodeEditorOpenRequest | undefined>(undefined);
  const valueRef = useRef('');
  const register = useCodeEditorRegistration();
  const languageStatus = useProjectLanguageEnvironment();

  useEffect(() => {
    requestRef.current = request;
    valueRef.current = value;
  }, [request, value]);

  const close = useCallback((cancel: boolean) => {
    const current = requestRef.current;
    if (cancel) current?.onCancel?.();
    setVisible(false);
    setRequest(undefined);
    setModel(undefined);
    if (current) modelScopeRef.current?.delete(current.contextId);
  }, []);

  const confirm = useCallback(
    async (keep = false) => {
      const current = requestRef.current;
      if (!current) return;
      const language = languageFor(current);
      if (current.lint || language === 'json') {
        const error = validationError(valueRef.current, language);
        if (error) {
          Modal.error({
            title: '代码无法保存',
            content: (
              <>
                <p>{error.message}</p>
                <p>当前草稿已保留，没有写入工程。</p>
              </>
            ),
            okText: '返回修改',
          });
          return;
        }
      }
      try {
        await current.onConfirm(valueRef.current);
        if (keep) notifySuccess('写入成功！');
        else close(false);
      } catch (error) {
        notifyError(error);
      }
    },
    [close],
  );

  useEffect(
    () =>
      register((next) => {
        const language = languageFor(next);
        const nextModel = modelScopeRef.current!.get({
          id: next.contextId,
          value: next.initialValue,
          language,
          uri: `inmemory://motajs/editor/${encodeURIComponent(next.contextId)}.${language === 'json' ? 'json' : language === 'javascript' ? 'js' : 'txt'}`,
        });
        applyingRef.current = true;
        nextModel.setValue(next.initialValue);
        applyingRef.current = false;
        requestRef.current = next;
        valueRef.current = next.initialValue;
        setRequest(next);
        setValue(next.initialValue);
        setModel(nextModel);
        setVisible(true);
        window.setTimeout(() => {
          if (next.scrollTop) editorRef.current?.setScrollTop(next.scrollTop);
          editorRef.current?.focus();
        });
      }),
    [register],
  );

  useEffect(() => {
    const generation = ++scopeGenerationRef.current;
    return () =>
      queueMicrotask(() => {
        // The delayed generation check deliberately distinguishes a real unmount
        // from React StrictMode's immediate mount/unmount/remount probe.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        if (scopeGenerationRef.current === generation) modelScopeRef.current?.dispose();
      });
  }, []);

  const mount = useCallback(
    (editor: MonacoEditorInstance) => {
      editorRef.current = editor;
      const domNode = editor.getDomNode() as (HTMLElement & { __motajsMonacoEditor?: MonacoEditorInstance }) | null;
      domNode?.setAttribute('data-test-id', 'code-editor-content');
      if (import.meta.env.DEV && domNode) domNode.__motajsMonacoEditor = editor;
      const input = domNode?.querySelector('textarea');
      input?.setAttribute('data-test-id', 'code-editor-input');
      const change = editor.onDidChangeModelContent(() => {
        if (applyingRef.current) return;
        const next = editor.getValue();
        valueRef.current = next;
        setValue(next);
        const current = requestRef.current;
        const currentModel = editor.getModel();
        if (current && currentModel) updateSyntaxMarker(currentModel, languageFor(current));
      });
      const modelChange = editor.onDidChangeModel(() => {
        const current = requestRef.current;
        const currentModel = editor.getModel();
        if (current && currentModel) updateSyntaxMarker(currentModel, languageFor(current));
      });
      const current = requestRef.current;
      const currentModel = editor.getModel();
      if (current && currentModel) updateSyntaxMarker(currentModel, languageFor(current));
      const disposeSemanticHighlighting = attachMonacoTypeSemanticHighlighting(editor);
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void confirm(true));
      return () => {
        change.dispose();
        modelChange.dispose();
        disposeSemanticHighlighting();
        if (domNode) delete domNode.__motajsMonacoEditor;
        if (editorRef.current === editor) editorRef.current = null;
      };
    },
    [confirm],
  );

  const format = useCallback(() => {
    if (!request) return;
    const language = languageFor(request);
    if (language === 'plaintext') {
      notifyError('只有代码或 JSON 才能格式化');
      return;
    }
    try {
      const next = formatSource(valueRef.current, language);
      applyingRef.current = true;
      model?.setValue(next);
      applyingRef.current = false;
      if (model) updateSyntaxMarker(model, language);
      valueRef.current = next;
      setValue(next);
    } catch (error) {
      notifyError(error);
    }
  }, [model, request]);

  const runCommand = useCallback((command: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const actions: Record<string, string> = {
      'Ctrl-/': 'editor.action.commentLine',
      'Ctrl-B': 'editor.action.revealDefinition',
      'Ctrl-Q': 'editor.action.rename',
      'Ctrl-F': 'actions.find',
      'Ctrl-R': 'editor.action.startFindReplaceAction',
      'Ctrl-D': 'editor.fold',
    };
    if (command === 'Ctrl-O') {
      const url = editorDocsEndpoint(API_DOCS_PATH);
      if (url) window.open(url, '_blank');
      return;
    }
    if (command === 'Ctrl-P') {
      window.open(PLUGINS_URL, '_blank');
      return;
    }
    const action = actions[command];
    if (action) void editor.getAction(action)?.run();
  }, []);

  return (
    <div
      id="left7"
      data-test-id="code-editor"
      data-language-status={languageStatus.state}
      className={visible ? 'monacoCodeEditorPanel' : 'hidden-panel monacoCodeEditorPanel'}
      style={visible ? undefined : { zIndex: -1, opacity: 0 }}
    >
      <div className="monacoCodeEditorToolbar">
        <button data-test-id="code-editor-confirm" onClick={() => void confirm()}>
          确认
        </button>
        <button data-test-id="code-editor-cancel" onClick={() => close(true)}>
          取消
        </button>
        <button data-test-id="code-editor-apply" onClick={() => void confirm(true)}>
          应用
        </button>
        <button onClick={format}>格式化</button>
        {request?.preview ? (
          <button data-test-id="code-editor-preview" onClick={() => void request.onPreview?.(valueRef.current)}>
            预览
          </button>
        ) : null}
        <Dropdown
          menu={{
            items: getShortcutKeys().map((key) => ({ key, label: commandsName[key] })),
            onClick: ({ key }) => runCommand(key),
          }}
          trigger={['click']}
        >
          <button className="codeEditorCommandsButton">
            常用命令
            <ChevronDown size={13} />
          </button>
        </Dropdown>
        <CodeEditorSettingsButton appearance={appearance} />
        <span className="monacoLanguageStatus">
          {languageStatus.state === 'degraded' ? languageStatus.message : ''}
        </span>
      </div>
      <div className="monacoCodeEditorSurface" data-test-id="code-editor-source">
        <MonacoEditor
          model={model}
          onMount={mount}
          options={{
            automaticLayout: true,
            fontFamily: '"SFMono-Regular", Consolas, monospace',
            fontSize: appearance.fontSize,
            fontWeight: appearance.fontBold ? 'bold' : 'normal',
            glyphMargin: true,
            lineNumbers: 'on',
            minimap: { enabled: false },
            'semanticHighlighting.enabled': true,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
          }}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
};
