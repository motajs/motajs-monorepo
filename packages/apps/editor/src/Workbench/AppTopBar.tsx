import {
  BookOpen,
  Box,
  Code2,
  ExternalLink,
  FolderOpen,
  History,
  Map,
  Moon,
  Puzzle,
  Redo2,
  RefreshCw,
  Sun,
  Undo2,
} from 'lucide-react';
import { Badge, Button, Modal, Popover, Tooltip } from 'antd';
import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { getEditorEnvironment } from '@/environment';
import { persistenceMonitor } from '@/fs/PersistenceMonitor';
import { useSignal } from '@/hooks/useFs';
import { projectData } from '@/project/data/projectData';
import { operationHistory, useOperationHistory } from '@/project/history';
import { EditorStore } from '@/stores/EditorStore';
import { PanelStore, type ScriptWorkspaceId, type WorkspaceId } from '@/stores/PanelStore';
import { notifyError } from '@/utils/notify';
import { isKeyboardInputTarget } from '@/utils/keyboard';
import { suppressNextWorkspaceDraftWarning } from './draftGuard';
import {
  activateEditorUpdate,
  availableEditorRelease,
  checkEditorUpdate,
  getEditorUpdateState,
  parseEditorUpdateStatus,
  type EditorUpdateStatus,
} from './editorUpdate';
import { createRetainedProjectTitleSignal } from './projectTitle';

const WORKSPACES: Array<{
  id: WorkspaceId;
  label: string;
  icon: FC<{ size?: number }>;
}> = [
  { id: 'map', label: '地图编辑器', icon: Map },
  { id: 'resources', label: '资源管理', icon: FolderOpen },
  { id: 'tower', label: '全塔属性', icon: Box },
  { id: 'common-events', label: '公共事件', icon: Puzzle },
  { id: 'scripts', label: '函数与插件', icon: Code2 },
];

function hasOpenDialog(): boolean {
  return Array.from(document.querySelectorAll<HTMLElement>("[role='dialog'], .ant-modal-wrap, #uieventDiv")).some(
    (element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden',
  );
}

const ProjectTitle: FC = () => {
  const resource = projectData.tower();
  const content = useSignal(resource.content);
  const titleSignal = useMemo(() => createRetainedProjectTitleSignal(resource.content), [resource]);
  const title = useSignal(titleSignal);
  useEffect(() => {
    if (content.status === 'idle') void resource.ensureLoaded();
  }, [content.status, resource]);
  if (title === undefined) return <div className="appProjectTitle">正在读取工程...</div>;
  return (
    <div className="appProjectTitle" title={title}>
      {title}
    </div>
  );
};

function useEditorUpdateState(): EditorUpdateStatus | undefined {
  const [status, setStatus] = useState<EditorUpdateStatus>();
  useEffect(() => {
    const environment = getEditorEnvironment();
    if (!environment.release || !environment.endpoints.update) return;
    const controller = new AbortController();
    let checking = false;
    const refresh = async () => {
      const next = await getEditorUpdateState(environment, controller.signal);
      if (!controller.signal.aborted && next) setStatus(next);
    };
    const check = async (force = false) => {
      if (checking) return;
      checking = true;
      try {
        const next = await checkEditorUpdate(environment, controller.signal, force);
        if (!controller.signal.aborted && next) setStatus(next);
      } catch (error) {
        if (!controller.signal.aborted) console.debug('Editor update check is unavailable', error);
      } finally {
        checking = false;
      }
    };
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.type !== 'motajs-editor-release-state') return;
      try {
        setStatus(parseEditorUpdateStatus(event.data.state));
      } catch (error) {
        console.debug('Ignored an invalid Editor release broadcast', error);
      }
    };
    void refresh()
      .then(() => check())
      .catch((error) => {
        if (!controller.signal.aborted) console.debug('Editor update state is unavailable', error);
      });
    const interval = window.setInterval(() => void check(), 10 * 60_000);
    const handleOnline = () => void check(true);
    navigator.serviceWorker?.addEventListener('message', handleMessage);
    window.addEventListener('online', handleOnline);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
      window.removeEventListener('online', handleOnline);
    };
  }, []);
  return status;
}

const shortBuildId = (buildId: string): string => (buildId.length > 12 ? buildId.slice(0, 12) : buildId);

export const AppTopBar: FC = () => {
  const {
    activeWorkspace,
    activePanel,
    setActiveWorkspace,
    setActiveMapPanel,
    setActivePanel,
    setActiveScriptWorkspace,
  } = PanelStore.useStore();
  const { theme, setTheme } = EditorStore.useStore();
  const history = useOperationHistory();
  const updateStatus = useEditorUpdateState();
  const [updateOpen, setUpdateOpen] = useState(false);
  const dark = theme === 'editor_color_dark';
  const environment = getEditorEnvironment();
  const runningRelease = environment.release;
  const availableRelease = availableEditorRelease(updateStatus, runningRelease);
  const docsUrl = environment.endpoints.docs;

  const navigate = useCallback(
    (workspace: WorkspaceId) => {
      setActiveWorkspace(workspace);
    },
    [setActiveWorkspace],
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isKeyboardInputTarget(event.target) || hasOpenDialog())
        return;
      const key = event.key.toLowerCase();
      let workspace: WorkspaceId | undefined;
      let script: ScriptWorkspaceId | undefined;
      const mapPanel = ({ z: 'map', x: 'loc', c: 'enemyitem', v: 'floor' } as const)[key as 'z' | 'x' | 'c' | 'v'];
      if (mapPanel && activeWorkspace === 'map') {
        event.preventDefault();
        setActiveMapPanel(mapPanel);
        return;
      }
      if (key === 'b') workspace = 'tower';
      else if (key === 'm') workspace = 'resources';
      else if (key === ',') workspace = 'common-events';
      else if (key === 'n') {
        workspace = 'scripts';
        script = 'functions';
      } else if (key === '.') {
        workspace = 'scripts';
        script = 'plugins';
      }
      if (!workspace) return;
      event.preventDefault();
      if (script) setActiveScriptWorkspace(script);
      else setActiveWorkspace(workspace);
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [activeWorkspace, setActiveMapPanel, setActiveScriptWorkspace, setActiveWorkspace]);

  const historyContent = (
    <div className="appHistoryList" data-test-id="operation-history-list">
      {history.entries.length === 0 ? (
        <div className="appHistoryEmpty">暂无可撤销操作</div>
      ) : (
        [...history.entries]
          .map((entry, index) => ({ entry, index }))
          .reverse()
          .map(({ entry, index }) => (
            <div
              className={index < history.current ? 'appHistoryEntry' : 'appHistoryEntry is-undone'}
              data-test-id="operation-history-entry"
              key={entry.id}
            >
              <span>{index < history.current ? '●' : '○'}</span>
              <span title={entry.label}>{entry.label}</span>
              <span title={entry.paths.join(', ')}>{entry.paths.join(', ')}</span>
              <span>
                {new Date(entry.timestamp).toLocaleTimeString('zh-CN', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          ))
      )}
    </div>
  );

  const reloadForUpdate = async () => {
    if (history.busy) {
      notifyError('当前操作尚未完成，请稍后再更新。');
      return;
    }
    if (persistenceMonitor.hasUnsavedChanges()) {
      notifyError('工程文件仍在写入，请等待写入完成后再更新。');
      return;
    }
    if (persistenceMonitor.hasPersistErrors()) {
      notifyError('存在写入失败的工程文件，请先处理保存错误再更新。');
      return;
    }
    if (!availableRelease) return;
    try {
      await activateEditorUpdate(availableRelease.buildId, environment);
      suppressNextWorkspaceDraftWarning();
      window.location.reload();
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <>
      <header className="appTopBar" data-test-id="app-topbar">
        <select
          className="appLegacyPanelSelect"
          data-test-id="edit-mode-select"
          aria-hidden="true"
          tabIndex={-1}
          value={activePanel}
          onChange={(event) => setActivePanel(event.target.value as typeof activePanel)}
        >
          <option value="map">地图编辑</option>
          <option value="loc">地图选点</option>
          <option value="enemyitem">图块属性</option>
          <option value="floor">楼层属性</option>
          <option value="tower">全塔属性</option>
          <option value="functions">函数</option>
          <option value="appendpic">资源管理</option>
          <option value="commonevent">公共事件</option>
          <option value="plugins">插件</option>
        </select>
        <button
          className="appBrand"
          data-test-id="back-to-project"
          onClick={() => window.location.assign(getEditorEnvironment().endpoints.project)}
          type="button"
        >
          Mota Editor
        </button>

        <nav className="appWorkspaceNav" aria-label="编辑器工作区">
          {WORKSPACES.map((item) => (
            <button
              className={activeWorkspace === item.id ? 'appWorkspaceButton is-active' : 'appWorkspaceButton'}
              data-test-id={`workspace-${item.id}`}
              key={item.id}
              onClick={() => navigate(item.id)}
              type="button"
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <ProjectTitle />

        <div className="appTopActions">
          {availableRelease && (
            <Tooltip title="编辑器更新可用">
              <Badge dot offset={[-4, 4]}>
                <Button
                  aria-label="编辑器更新可用"
                  className="appUpdateButton"
                  data-test-id="editor-update-open"
                  icon={<RefreshCw size={17} />}
                  onClick={() => setUpdateOpen(true)}
                  type="text"
                />
              </Badge>
            </Tooltip>
          )}
          {docsUrl ? (
            <Tooltip title="帮助文档">
              <Button
                aria-label="帮助文档"
                icon={<BookOpen size={17} />}
                onClick={() => window.open(docsUrl, '_blank')}
                type="text"
              />
            </Tooltip>
          ) : null}
          <Tooltip title="前往游戏">
            <Button
              aria-label="前往游戏"
              icon={<ExternalLink size={17} />}
              onClick={() => window.open(getEditorEnvironment().endpoints.preview, '_blank')}
              type="text"
            />
          </Tooltip>
          <Tooltip title="撤销">
            <Button
              aria-label="撤销"
              data-test-id="operation-history-undo"
              disabled={history.busy || history.current === 0}
              icon={<Undo2 size={17} />}
              onClick={() => void operationHistory.undo().catch(notifyError)}
              type="text"
            />
          </Tooltip>
          <Popover content={historyContent} title="操作历史" trigger="click">
            <Tooltip title="操作历史">
              <Button
                aria-label="操作历史"
                data-test-id="operation-history-open"
                disabled={history.entries.length === 0}
                icon={<History size={17} />}
                type="text"
              />
            </Tooltip>
          </Popover>
          <Tooltip title="重做">
            <Button
              aria-label="重做"
              data-test-id="operation-history-redo"
              disabled={history.busy || history.current >= history.entries.length}
              icon={<Redo2 size={17} />}
              onClick={() => void operationHistory.redo().catch(notifyError)}
              type="text"
            />
          </Tooltip>
          <Tooltip title={dark ? '切换到浅色主题' : '切换到深色主题'}>
            <Button
              aria-label="切换主题"
              data-test-id="theme-toggle"
              icon={dark ? <Sun size={17} /> : <Moon size={17} />}
              onClick={() => setTheme(dark ? 'editor_color_light' : 'editor_color_dark')}
              type="text"
            />
          </Tooltip>
        </div>
      </header>
      <Modal
        cancelText="稍后"
        centered
        okText="刷新并更新"
        onCancel={() => setUpdateOpen(false)}
        onOk={() => void reloadForUpdate()}
        open={updateOpen && Boolean(availableRelease)}
        title="编辑器更新可用"
      >
        {availableRelease && (
          <div className="editorUpdateDialog" data-test-id="editor-update-dialog">
            <p>新的编辑器版本已经完整下载并校验，刷新页面后即可启用。</p>
            <dl>
              <div>
                <dt>当前版本</dt>
                <dd>
                  {runningRelease?.version ?? '未知'} ·{' '}
                  {runningRelease ? shortBuildId(runningRelease.buildId) : '未知构建'}
                </dd>
              </div>
              <div>
                <dt>新版本</dt>
                <dd>
                  {availableRelease.version} · {shortBuildId(availableRelease.buildId)}
                </dd>
              </div>
            </dl>
            <p className="editorUpdateWarning">
              刷新会清空撤销/重做记录，以及尚未保存的公共事件、函数和插件草稿；已经写入工程的修改不受影响。
            </p>
          </div>
        )}
      </Modal>
    </>
  );
};
