import { encodeGameScript2x, type ScriptDataObject } from "@motajs/file2x";
import { useResourceSuspense } from "@/hooks/suspense";
import { tableCommands } from "@/project/commands";
import { projectData } from "@/project/data/projectData";
import { PanelStore, type ScriptWorkspaceId } from "@/stores/PanelStore";
import { buildFieldPath } from "@/utils/fieldPath";
import type { Action } from "@/utils/action";
import { notifyCommandResult, notifyError, notifySuccess } from "@/utils/notify";
import { Input, Modal, Popover, Segmented } from "antd";
import CodeMirror from "codemirror";
import type { Annotation } from "codemirror/addon/lint/lint";
import { cloneDeep } from "es-toolkit";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleX,
  Eye,
  FileCode2,
  Plus,
  TriangleAlert,
  WandSparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
  type FC,
  type ReactNode,
} from "react";
import "../CodeEditor/setup";
import { TernServerInitializer } from "../CodeEditor/components";
import {
  CODEMIRROR_HINT_OPTIONS,
  JSHINT_OPTIONS,
  PERSISTENT_SEARCH_KEYS,
} from "../CodeEditor/config/commands";
import type { CodeMirrorInstance } from "../CodeEditor/types";
import type { TernServerInstance } from "../CodeEditor/utils";
import "./scripts-workspace.css";
import {
  collectFunctionDiagnostics,
  formatFunctionSource,
  validateFunctionSource,
  type ScriptDiagnostic,
} from "./validation";
import { setWorkspaceDraftDirty } from "../draftGuard";
import { useStatusBarPreviewModal } from "../modals/StatusBarPreview";
import { ScriptDocumentRegistry } from "./scriptDocumentRegistry";

const UUIDS: Record<ScriptWorkspaceId, string> = {
  functions: "functions_d6ad677b_427a_4623_b50f_a445a3b0ef8a",
  plugins: "plugins_bb40132b_638b_4a9f_b028_d3fe47acc8d1",
};

const BUILTIN_PLUGINS = new Set([
  "init", "shop", "drawLight", "removeMap", "fiveLayers", "itemShop",
  "enemyLevel", "multiHeros", "heroFourFrames", "routeFixing", "numpad",
]);

interface ScriptLeaf {
  path: string[];
  source: string;
}

interface ScriptTab extends ScriptLeaf {
  id: string;
  kind: ScriptWorkspaceId;
  text: string;
  base: string;
  dirty: boolean;
  conflict?: string;
  diskDeleted?: boolean;
  validation?: ScriptValidation;
}

interface ScriptValidation {
  diagnostics: ScriptDiagnostic[];
  errors: number;
  warnings: number;
}

type DiagnosticFilter = "all" | ScriptDiagnostic["severity"];

interface CodeMirrorSurfaceHandle {
  reveal(line: number, column?: number): void;
  renameDocument(previousId: string, nextId: string): void;
}

interface ScriptDocumentDescriptor {
  id: string;
  value: string;
}

function summarizeDiagnostics(diagnostics: ScriptDiagnostic[]): ScriptValidation {
  return {
    diagnostics,
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length,
  };
}

function diagnosticAnnotation(diagnostic: ScriptDiagnostic): Annotation {
  const line = Math.max(0, (diagnostic.line ?? 1) - 1);
  const column = Math.max(0, (diagnostic.column ?? 1) - 1);
  return {
    from: CodeMirror.Pos(line, column),
    message: diagnostic.message,
    severity: diagnostic.severity,
    to: CodeMirror.Pos(line, column + 1),
  };
}

function readPath(value: ScriptDataObject, path: readonly string[]): string | undefined {
  let current: string | ScriptDataObject = value;
  for (const key of path) {
    if (typeof current === "string") return undefined;
    current = current[key];
    if (current == null) return undefined;
  }
  return typeof current === "string" ? current : undefined;
}

function setPath(value: ScriptDataObject, path: readonly string[], source: string): void {
  let current = value;
  path.slice(0, -1).forEach((key) => {
    const child = current[key];
    if (!child || typeof child === "string") current[key] = {};
    current = current[key] as ScriptDataObject;
  });
  current[path.at(-1)!] = source;
}

function askName(title: string, initialValue = ""): Promise<string | undefined> {
  return new Promise((resolve) => {
    let value = initialValue;
    Modal.confirm({
      title,
      icon: null,
      content: <Input autoFocus defaultValue={initialValue} onChange={(event) => { value = event.target.value; }} />,
      okText: "确定",
      cancelText: "取消",
      onOk: () => resolve(value.trim()),
      onCancel: () => resolve(undefined),
    });
  });
}

const CodeMirrorSurface = forwardRef<CodeMirrorSurfaceHandle, {
  activeDocumentId: string;
  documents: readonly ScriptDocumentDescriptor[];
  onChange(documentId: string, value: string): void;
  onDiagnostics(documentId: string, diagnostics: ScriptDiagnostic[]): void;
  onSave(): void;
}>(({ activeDocumentId, documents, onChange, onDiagnostics, onSave }, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<CodeMirror.EditorFromTextArea | null>(null);
  const ternServerRef = useRef<TernServerInstance | null>(null);
  const onChangeRef = useRef(onChange);
  const onDiagnosticsRef = useRef(onDiagnostics);
  const onSaveRef = useRef(onSave);
  const applyingRef = useRef(false);
  const activeDocumentIdRef = useRef(activeDocumentId);
  const documentRegistryRef = useRef<ScriptDocumentRegistry>(null);
  documentRegistryRef.current ??= new ScriptDocumentRegistry();
  const documentRegistry = documentRegistryRef.current;
  const [editor, setEditor] = useState<CodeMirrorInstance | null>(null);
  const [ternStatus, setTernStatus] = useState<"loading" | "ready" | "error">("loading");
  const getAutocomplete = useCallback(() => true, []);

  useEffect(() => {
    onChangeRef.current = onChange;
    onDiagnosticsRef.current = onDiagnostics;
    onSaveRef.current = onSave;
  }, [onChange, onDiagnostics, onSave]);

  useEffect(() => {
    if (!textareaRef.current) return undefined;
    for (const document of documents) documentRegistry.open(document.id, document.value);
    const activeDocument = documentRegistry.get(activeDocumentId);
    if (!activeDocument) return undefined;
    const editor = CodeMirror.fromTextArea(textareaRef.current, {
      mode: {
        name: "javascript",
        globalVars: true,
        localVars: true,
      } as CodeMirror.ModeSpec<{ globalVars: boolean; localVars: boolean }>,
      lineNumbers: true,
      lineWrapping: false,
      indentUnit: 4,
      indentWithTabs: true,
      smartIndent: true,
      tabSize: 4,
      gutters: ["CodeMirror-linenumbers", "CodeMirror-lint-markers"],
      lint: {
        ...JSHINT_OPTIONS,
        getAnnotations: (source: string) => collectFunctionDiagnostics(source).map(diagnosticAnnotation),
        onUpdateLinting: (annotations) => {
          const diagnostics = annotations.map((annotation) => ({
            message: annotation.message ?? "未知问题",
            line: annotation.from.line + 1,
            column: annotation.from.ch + 1,
            severity: annotation.severity === "warning" ? "warning" as const : "error" as const,
          }));
          onDiagnosticsRef.current(activeDocumentIdRef.current, diagnostics);
        },
      },
      hintOptions: CODEMIRROR_HINT_OPTIONS,
      highlightSelectionMatches: { showToken: /[\w$]/ },
      extraKeys: {
        ...PERSISTENT_SEARCH_KEYS,
        "Ctrl-Space": (current) => ternServerRef.current?.complete(current),
        "Cmd-Space": (current) => ternServerRef.current?.complete(current),
        "Ctrl-S": () => onSaveRef.current(),
        "Cmd-S": () => onSaveRef.current(),
      },
    });
    editor.swapDoc(activeDocument);
    editor.on("change", () => {
      if (!applyingRef.current) {
        onChangeRef.current(activeDocumentIdRef.current, editor.getValue());
      }
    });
    editorRef.current = editor;
    setEditor(editor);
    return () => {
      if (editor.getWrapperElement().parentNode) {
        // toTextArea does not release Doc.cm. Detach the tab-owned document so
        // React StrictMode's next setup can attach that same Doc safely.
        editor.swapDoc(new CodeMirror.Doc("", "javascript"));
        editor.toTextArea();
      }
      editorRef.current = null;
      ternServerRef.current = null;
      setEditor(null);
    };
  // CodeMirror owns this DOM node for the lifetime of the surface.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const retainedIds = new Set(documents.map((document) => document.id));
    for (const document of documents) {
      documentRegistry.open(document.id, document.value);
      applyingRef.current = true;
      try {
        documentRegistry.setValue(document.id, document.value);
      } finally {
        applyingRef.current = false;
      }
    }
    const activeDocument = documentRegistry.get(activeDocumentId);
    if (activeDocument && editor.getDoc() !== activeDocument) {
      editor.closeHint();
      activeDocumentIdRef.current = activeDocumentId;
      editor.swapDoc(activeDocument);
      editor.performLint();
    } else {
      activeDocumentIdRef.current = activeDocumentId;
    }
    documentRegistry.retain(retainedIds);
  }, [activeDocumentId, documentRegistry, documents]);

  const registerDocuments = useCallback((server: TernServerInstance) => {
    documentRegistry.attachTern(server);
  }, [documentRegistry]);
  const unregisterDocuments = useCallback((server: TernServerInstance) => {
    documentRegistry.detachTern(server);
  }, [documentRegistry]);

  useImperativeHandle(ref, () => ({
    reveal(line, column = 1) {
      const editor = editorRef.current;
      if (!editor) return;
      const targetLine = Math.max(0, Math.min(editor.lineCount() - 1, line - 1));
      const targetColumn = Math.max(0, Math.min(editor.getLine(targetLine).length, column - 1));
      editor.operation(() => {
        editor.setCursor({ line: targetLine, ch: targetColumn });
        const lineTop = editor.heightAtLine(targetLine, "local");
        const contextHeight = editor.defaultTextHeight() * 5;
        editor.scrollTo(null, Math.max(0, lineTop - contextHeight));
        editor.focus();
      });
    },
    renameDocument(previousId, nextId) {
      documentRegistry.rename(previousId, nextId);
      if (activeDocumentIdRef.current === previousId) activeDocumentIdRef.current = nextId;
    },
  }), [documentRegistry]);

  return (
    <div className="scriptCodeEditor" data-test-id="script-code-editor" data-tern-status={ternStatus}>
      <textarea ref={textareaRef} />
      {editor ? (
        <TernServerInitializer
          codeEditor={editor}
          ref={ternServerRef}
          getAutocomplete={getAutocomplete}
          registerDocuments={registerDocuments}
          unregisterDocuments={unregisterDocuments}
          onReady={() => setTernStatus("ready")}
          onError={() => setTernStatus("error")}
        />
      ) : null}
    </div>
  );
});

CodeMirrorSurface.displayName = "CodeMirrorSurface";

const ScriptTree: FC<{
  kind: ScriptWorkspaceId;
  data: ScriptDataObject;
  onOpen(leaf: ScriptLeaf): void;
}> = ({ kind, data, onOpen }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const renderObject = (object: ScriptDataObject, prefix: string[], depth: number) => Object.entries(object).map(([key, child]) => {
    const path = [...prefix, key];
    const id = path.join(".");
    if (typeof child === "string") {
      return (
        <button className="scriptTreeLeaf" key={id} onClick={() => onOpen({ path, source: child })} style={{ paddingLeft: 12 + depth * 14 }}>
          <FileCode2 size={14} /><span>{key}</span>
        </button>
      );
    }
    const closed = collapsed[id] === true;
    return (
      <div key={id}>
        <button className="scriptTreeGroup" onClick={() => setCollapsed((current) => ({ ...current, [id]: !closed }))} style={{ paddingLeft: 8 + depth * 14 }}>
          {closed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}<span>{key}</span>
        </button>
        {closed ? null : renderObject(child, path, depth + 1)}
      </div>
    );
  });
  return <div className="scriptTree" data-kind={kind}>{renderObject(data, [], 0)}</div>;
};

export const ScriptsWorkspace: FC = () => {
  const [functions] = useResourceSuspense(projectData.functions());
  const [plugins] = useResourceSuspense(projectData.plugins());
  const { activeScriptWorkspace, setActiveScriptWorkspace } = PanelStore.useStore();
  const [tabs, setTabs] = useState<ScriptTab[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [validationPopoverTabId, setValidationPopoverTabId] = useState<string>();
  const [diagnosticFilter, setDiagnosticFilter] = useState<DiagnosticFilter>("all");
  const codeSurfaceRef = useRef<CodeMirrorSurfaceHandle>(null);
  const [openStatusBarPreview, statusBarPreviewHolder] = useStatusBarPreviewModal();
  const currentData = activeScriptWorkspace === "functions" ? functions : plugins;
  const active = tabs.find((tab) => tab.id === activeId);
  const canPreviewStatusBar = active?.kind === "functions"
    && active.path.join(".") === "ui.drawStatusBar";
  const validationStatus = !active?.validation
    ? "checking"
    : active.validation.errors > 0
      ? "invalid"
      : active.validation.warnings > 0
        ? "warning"
        : "valid";

  const open = useCallback((kind: ScriptWorkspaceId, leaf: ScriptLeaf) => {
    const id = `${kind}:${leaf.path.join(".")}`;
    setTabs((current) => current.some((tab) => tab.id === id) ? current : [...current, {
      ...leaf,
      id,
      kind,
      text: leaf.source,
      base: leaf.source,
      dirty: false,
    }]);
    setActiveId(id);
  }, []);

  useEffect(() => {
    setTabs((current) => current.map((tab) => {
      const data = tab.kind === "functions" ? functions : plugins;
      const disk = readPath(data, tab.path);
      if (disk == null) return tab.dirty ? { ...tab, diskDeleted: true } : tab;
      if (disk === tab.base) return tab;
      return tab.dirty
        ? { ...tab, conflict: disk, diskDeleted: false }
        : {
            ...tab,
            text: disk,
            base: disk,
            conflict: undefined,
            diskDeleted: false,
            validation: undefined,
          };
    }));
  }, [functions, plugins]);

  useEffect(() => {
    setWorkspaceDraftDirty("scripts", tabs.some((tab) => tab.dirty));
  }, [tabs]);

  const updateDocument = useCallback((documentId: string, text: string) => {
    setTabs((current) => current.map((tab) => tab.id === documentId
      ? { ...tab, text, dirty: text !== tab.base, validation: undefined }
      : tab));
  }, []);

  const updateDiagnostics = useCallback((documentId: string, diagnostics: ScriptDiagnostic[]) => {
    setTabs((current) => current.map((tab) => tab.id === documentId
      ? { ...tab, validation: summarizeDiagnostics(diagnostics) }
      : tab));
  }, []);

  const validateTab = useCallback((tab: ScriptTab) => {
    validateFunctionSource(tab.text);
    const sourceData = tab.kind === "functions" ? functions : plugins;
    const next = cloneDeep(sourceData);
    setPath(next, tab.path, tab.text);
    encodeGameScript2x({ uuid: UUIDS[tab.kind], data: next });
  }, [functions, plugins]);

  const showValidationError = useCallback((title: string, reason: unknown) => {
    const error = reason as { message?: string; loc?: { line: number; column: number } };
    const location = error.loc ? `第 ${error.loc.line} 行，第 ${error.loc.column + 1} 列` : undefined;
    const message = error.message ?? String(reason);
    Modal.error({
      title,
      content: (
        <div className="scriptValidationError">
          {location ? <p>{location}</p> : null}
          <pre>{message}</pre>
          <p>当前草稿已保留，没有写入工程。</p>
        </div>
      ),
      okText: "返回修改",
    });
  }, []);

  const revealDiagnostic = useCallback((diagnostic: ScriptDiagnostic) => {
    if (diagnostic.line == null) return;
    codeSurfaceRef.current?.reveal(diagnostic.line, diagnostic.column);
  }, []);

  let validationBody: ReactNode;
  if (!active?.validation) {
    validationBody = <div className="scriptValidationSummary"><span>正在校验当前草稿…</span></div>;
  } else if (active.validation.diagnostics.length === 0) {
    validationBody = (
      <div className="scriptValidationSummary is-valid">
        <CheckCircle2 size={16} />
        <span>错误 0，警告 0</span>
      </div>
    );
  } else {
    let validationClass = "is-warning";
    let ValidationIcon = TriangleAlert;
    if (active.validation.errors > 0) {
      validationClass = "is-invalid";
      ValidationIcon = CircleX;
    }
    let visibleDiagnostics = active.validation.diagnostics;
    if (diagnosticFilter !== "all") {
      visibleDiagnostics = visibleDiagnostics.filter((diagnostic) => diagnostic.severity === diagnosticFilter);
    }
    let diagnosticList: ReactNode = <div className="scriptDiagnosticEmpty">这一类没有问题</div>;
    if (visibleDiagnostics.length > 0) {
      diagnosticList = (
        <div className="scriptDiagnosticList">
          {visibleDiagnostics.map((diagnostic, index) => {
            if (diagnostic.line == null) {
              return (
                <div className="scriptDiagnosticItem is-static" key={`${diagnostic.message}-${index}`}>
                  <span>脚本</span>
                  <b>{diagnostic.message}</b>
                </div>
              );
            }
            let location = "";
            if (diagnostic.column) location = `:${diagnostic.column}`;
            return (
              <button
                className={`scriptDiagnosticItem is-${diagnostic.severity}`}
                data-test-id="script-validation-diagnostic"
                key={`${diagnostic.line}-${diagnostic.column}-${diagnostic.message}-${index}`}
                onClick={() => revealDiagnostic(diagnostic)}
              >
                <span>第 {diagnostic.line} 行{location}</span>
                <b>{diagnostic.message}</b>
              </button>
            );
          })}
        </div>
      );
    }
    validationBody = (
      <>
        <div className={`scriptValidationSummary ${validationClass}`}>
          <ValidationIcon size={16} />
          <span>错误 {active.validation.errors}，警告 {active.validation.warnings}</span>
        </div>
        <Segmented
          block
          className="scriptDiagnosticFilter"
          onChange={(value) => setDiagnosticFilter(value as DiagnosticFilter)}
          options={[
            { label: `全部 ${active.validation.diagnostics.length}`, value: "all" },
            { label: `错误 ${active.validation.errors}`, value: "error" },
            { label: `警告 ${active.validation.warnings}`, value: "warning" },
          ]}
          size="small"
          value={diagnosticFilter}
        />
        {diagnosticList}
      </>
    );
  }
  let validationContent: ReactNode = null;
  if (active) {
    validationContent = (
      <div className="scriptValidationPopover" data-test-id="script-validation-popover">
        {validationBody}
      </div>
    );
  }

  const format = useCallback((tab: ScriptTab) => {
    try {
      const text = formatFunctionSource(tab.text);
      setTabs((current) => current.map((item) => item.id === tab.id
        ? { ...item, text, dirty: text !== item.base, validation: undefined }
        : item));
      notifySuccess(text === tab.text ? "脚本已经是格式化状态" : "脚本已格式化");
    } catch (error) {
      notifyError(error);
    }
  }, []);

  const save = useCallback(async (tab: ScriptTab) => {
    if (tab.conflict || tab.diskDeleted) {
      const overwrite = await new Promise<boolean>((resolve) => Modal.confirm({
        title: "磁盘版本已变化",
        content: tab.diskDeleted
          ? "这个条目已在磁盘版本中删除。继续保存会重新创建它，确定吗？"
          : "继续保存会用当前草稿覆盖磁盘中的新版本。确定要覆盖吗？",
        okText: "覆盖保存",
        cancelText: "返回比较",
        okButtonProps: { danger: true },
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      }));
      if (!overwrite) return;
    }
    try {
      validateTab(tab);
      const action: Action = [tab.diskDeleted ? "add" : "change", buildFieldPath(tab.path), tab.text];
      const result = tab.kind === "functions"
        ? await tableCommands.patchFunctions([action])
        : await tableCommands.patchPlugins([action]);
      if (!result.ok) throw result.error;
      setTabs((current) => current.map((item) => item.id === tab.id
        ? {
            ...item,
            base: item.text,
            dirty: false,
            conflict: undefined,
            diskDeleted: false,
            validation: summarizeDiagnostics(collectFunctionDiagnostics(item.text)),
          }
        : item));
      notifyCommandResult(result, "脚本已保存");
    } catch (reason) {
      showValidationError("脚本无法保存", reason);
    }
  }, [showValidationError, validateTab]);

  const close = useCallback((tab: ScriptTab) => {
    const perform = () => setTabs((current) => {
      const next = current.filter((item) => item.id !== tab.id);
      if (activeId === tab.id) setActiveId(next.at(-1)?.id);
      return next;
    });
    if (!tab.dirty) {
      perform();
      return;
    }
    Modal.confirm({ title: "关闭未保存的脚本？", content: tab.path.join("."), okText: "放弃草稿", cancelText: "取消", onOk: perform });
  }, [activeId]);

  const addPlugin = useCallback(async () => {
    const name = await askName("新增自定义插件");
    if (!name) return;
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
      notifyError("插件名必须是合法的 JavaScript 标识符");
      return;
    }
    if (Object.prototype.hasOwnProperty.call(plugins, name)) {
      notifyError("插件名不能重复");
      return;
    }
    const source = "function () {\n\t\n}";
    const next = { ...plugins, [name]: source };
    try {
      encodeGameScript2x({ uuid: UUIDS.plugins, data: next });
      const result = await tableCommands.patchPlugins([["add", buildFieldPath([name]), source]]);
      notifyCommandResult(result, "插件已新增");
      if (result.ok) open("plugins", { path: [name], source });
    } catch (error) {
      notifyError(error);
    }
  }, [open, plugins]);

  const selectedPlugin = active?.kind === "plugins" && active.path.length === 1 ? active.path[0] : undefined;
  const customPlugin = selectedPlugin && !BUILTIN_PLUGINS.has(selectedPlugin) ? selectedPlugin : undefined;

  const renamePlugin = useCallback(async (name: string) => {
    const nextName = await askName("重命名自定义插件", name);
    if (!nextName || nextName === name) return;
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(nextName)) {
      notifyError("插件名必须是合法的 JavaScript 标识符");
      return;
    }
    if (Object.prototype.hasOwnProperty.call(plugins, nextName)) {
      notifyError("插件名不能重复");
      return;
    }
    const source = plugins[name];
    if (typeof source !== "string") return;
    const next = cloneDeep(plugins);
    delete next[name];
    next[nextName] = source;
    try {
      encodeGameScript2x({ uuid: UUIDS.plugins, data: next });
      const result = await tableCommands.patchPlugins([
        ["add", buildFieldPath([nextName]), source],
        ["delete", buildFieldPath([name]), undefined],
      ]);
      if (!result.ok) throw result.error;
      const oldId = `plugins:${name}`;
      const nextId = `plugins:${nextName}`;
      codeSurfaceRef.current?.renameDocument(oldId, nextId);
      setTabs((current) => current.map((tab) => tab.id === oldId
        ? { ...tab, id: nextId, path: [nextName] }
        : tab));
      if (activeId === oldId) setActiveId(nextId);
      notifyCommandResult(result, "插件已重命名");
    } catch (error) {
      notifyError(error);
    }
  }, [activeId, plugins]);

  const deletePlugin = useCallback((name: string) => {
    Modal.confirm({
      title: `删除自定义插件“${name}”？`,
      content: active?.dirty ? "当前标签还有未保存草稿，删除后会一并丢失。" : undefined,
      okButtonProps: { danger: true },
      okText: "删除",
      cancelText: "取消",
      onOk: async () => {
        const next = cloneDeep(plugins);
        delete next[name];
        encodeGameScript2x({ uuid: UUIDS.plugins, data: next });
        const result = await tableCommands.patchPlugins([["delete", buildFieldPath([name]), undefined]]);
        if (!result.ok) throw result.error;
        const id = `plugins:${name}`;
        setTabs((current) => current.filter((tab) => tab.id !== id));
        if (activeId === id) setActiveId(undefined);
        notifyCommandResult(result, "插件已删除");
      },
    });
  }, [active?.dirty, activeId, plugins]);

  return (
    <div className="scriptsWorkspace" data-test-id="scripts-workspace">
      <aside className="scriptNavigation">
        <div className="scriptRootTabs">
          <button className={activeScriptWorkspace === "functions" ? "is-active" : ""} onClick={() => setActiveScriptWorkspace("functions")}>函数</button>
          <button className={activeScriptWorkspace === "plugins" ? "is-active" : ""} onClick={() => setActiveScriptWorkspace("plugins")}>插件</button>
          {activeScriptWorkspace === "plugins" ? <button aria-label="新增插件" onClick={() => void addPlugin()}><Plus size={15} /></button> : null}
        </div>
        <ScriptTree
          kind={activeScriptWorkspace}
          data={currentData}
          onOpen={(leaf) => open(activeScriptWorkspace, leaf)}
        />
      </aside>
      <main className="scriptEditorWorkspace">
        <div className="scriptTabs">
          {tabs.map((tab) => (
            <button className={tab.id === activeId ? "scriptTab is-active" : "scriptTab"} key={tab.id} onClick={() => setActiveId(tab.id)}>
              <span>{tab.path.at(-1)}</span>{tab.dirty ? <i>●</i> : null}{tab.conflict || tab.diskDeleted ? <b title="磁盘版本已变化">!</b> : null}
              <span role="button" aria-label="关闭" onClick={(event) => { event.stopPropagation(); close(tab); }}><X size={13} /></span>
            </button>
          ))}
        </div>
        {active ? (
          <>
            <div className="scriptEditorToolbar">
              <span>{active.kind === "functions" ? "函数" : "插件"} / {active.path.join(" / ")}</span>
              {active.conflict || active.diskDeleted ? (
                <div className="scriptConflictActions">
                  <span>{active.diskDeleted ? "磁盘条目已删除" : "磁盘版本已变化"}</span>
                  {active.conflict ? <button onClick={() => setTabs((current) => current.map((tab) => tab.id === active.id ? { ...tab, text: tab.conflict!, base: tab.conflict!, dirty: false, conflict: undefined, diskDeleted: false, validation: undefined } : tab))}>载入磁盘版本</button> : null}
                  <button onClick={() => setTabs((current) => current.map((tab) => tab.id === active.id ? { ...tab, conflict: undefined, diskDeleted: false } : tab))}>保留草稿</button>
                </div>
              ) : null}
              <Popover
                arrow={false}
                content={validationContent}
                destroyOnHidden
                onOpenChange={(open) => {
                  setValidationPopoverTabId(open ? active.id : undefined);
                }}
                open={validationPopoverTabId === active.id}
                placement="bottomRight"
                trigger="click"
              >
                <button
                  className={`scriptValidateButton is-${validationStatus}`}
                  data-test-id="script-validate"
                  data-validation={validationStatus}
                  title="实时校验结果；点击查看并跳转到具体问题"
                >
                  {validationStatus === "valid"
                    ? <CheckCircle2 size={14} />
                    : validationStatus === "invalid"
                      ? <CircleX size={14} />
                      : <TriangleAlert size={14} />}
                  {active.validation
                    ? <>错误 {active.validation.errors} 警告 {active.validation.warnings}</>
                    : "校验中…"}
                </button>
              </Popover>
              <button data-test-id="script-format" title="格式化当前草稿，不会自动保存" onClick={() => format(active)}><WandSparkles size={14} />格式化</button>
              {canPreviewStatusBar ? (
                <button
                  data-test-id="script-preview"
                  title="预览当前草稿，不会自动保存"
                  onClick={() => void openStatusBarPreview({ code: active.text })}
                >
                  <Eye size={14} />预览
                </button>
              ) : null}
              <button disabled={!active.dirty} onClick={() => void save(active)}>保存</button>
              {customPlugin ? (
                <div className="scriptPluginActions">
                  <button onClick={() => void renamePlugin(customPlugin)}>重命名</button>
                  <button className="danger" onClick={() => deletePlugin(customPlugin)}>删除</button>
                </div>
              ) : null}
            </div>
            <div className="scriptCodeSurface">
              <CodeMirrorSurface
                ref={codeSurfaceRef}
                activeDocumentId={active.id}
                documents={tabs.map((tab) => ({ id: tab.id, value: tab.text }))}
                onChange={updateDocument}
                onDiagnostics={updateDiagnostics}
                onSave={() => void save(active)}
              />
            </div>
          </>
        ) : <div className="scriptEmpty">从左侧选择一个函数或插件</div>}
      </main>
      {statusBarPreviewHolder}
    </div>
  );
};
