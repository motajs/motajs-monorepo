import { type FC, useEffect, useState } from 'react';
import {
  Banner,
  Breadcrumb,
  Button,
  Descriptions,
  Empty,
  Layout,
  List,
  Modal,
  Progress,
  Space,
  Spin,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconDelete,
  IconEdit,
  IconFile,
  IconFolder,
  IconHome,
  IconMoon,
  IconPlay,
  IconRefresh,
  IconSun,
} from '@douyinfe/semi-icons';
import type { TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree';
import { Tree } from '@douyinfe/semi-ui';
import { useQuery } from 'react-query';
import {
  useCurrentFn,
  useServiceWorker,
  useServiceWorkerContainerEventAsEffect,
  useStateAsPromise,
  useStatic,
} from '@motajs/react-hooks';
import { MessageClient } from '@motajs/utils/advance/message';
import { DarkModeStore } from '@motajs/react-dark-mode';

import {
  ActivateProjectMessage,
  ForgetProjectMessage,
  GetEditorHostStatusMessage,
  GetProjectMessage,
  ListProjectMessage,
  RegisterProjectMessage,
  type EditorUpdateState,
  type ProjectSummary,
} from '@/idl';
import styles from './MainView.module.less';
import {
  appUrl,
  currentViewRoute,
  editorUrl,
  editorUpdateUrl,
  previewUrl,
  projectUrl,
  serviceWorkerScope,
  serviceWorkerUrl,
} from './routes';
import {
  checkEditorUpdate,
  editorReleaseLabel,
  formatBytes,
  getEditorUpdateState,
  parseEditorUpdateState,
  stagingPercent,
} from './editorUpdate';

const { Text, Title } = Typography;
const { Header, Content } = Layout;
const supportsLocalFs = 'showDirectoryPicker' in window;

const permissionLabel: Record<PermissionState, string> = {
  granted: '已授权',
  prompt: '需要授权',
  denied: '授权被拒绝',
};

const permissionColor: Record<PermissionState, 'green' | 'amber' | 'red'> = {
  granted: 'green',
  prompt: 'amber',
  denied: 'red',
};

const ThemeButton: FC = () => {
  const { isDarkMode, setIsDarkMode } = DarkModeStore.useStore();
  return (
    <Button
      type="tertiary"
      icon={isDarkMode ? <IconMoon /> : <IconSun />}
      aria-label={isDarkMode ? '切换到浅色模式' : '切换到深色模式'}
      onClick={() => setIsDarkMode(!isDarkMode)}
    />
  );
};

interface HostClient {
  client: MessageClient;
  ready: boolean;
}

const useHostClient = (): HostClient => {
  const serviceWorker = useServiceWorker(serviceWorkerUrl(), {
    scope: serviceWorkerScope(),
    type: 'module',
  });
  const controllerPromise = useStateAsPromise(serviceWorker.controller);
  const client = useStatic(
    () =>
      new MessageClient(async (message) => {
        const controller = await controllerPromise;
        controller.postMessage(message);
      }),
  );
  useServiceWorkerContainerEventAsEffect(navigator.serviceWorker, 'message', (event) => {
    client.emit(event.data);
  });
  return { client, ready: serviceWorker.isReady };
};

const Shell: FC<{ children: React.ReactNode }> = ({ children }) => (
  <Layout className={styles.shell}>
    <Header className={styles.topbar}>
      <Text strong>Mota Service Worker</Text>
      <ThemeButton />
    </Header>
    <Content className={styles.content}>{children}</Content>
  </Layout>
);

const HomeView: FC<{ host: HostClient }> = ({ host }) => {
  const [pendingDirectory, setPendingDirectory] = useState<{
    handle: FileSystemDirectoryHandle;
    treeData: TreeNodeData[];
  } | null>(null);
  const projects = useQuery(['projects'], () => host.client.request(ListProjectMessage), {
    enabled: host.ready,
  });

  const openProject = (id: number) => window.location.assign(projectUrl(id));

  const registerProject = useCurrentFn(async (handle: FileSystemDirectoryHandle) => {
    const { id } = await host.client.request(RegisterProjectMessage, { handle });
    openProject(id);
  });

  const selectLocalProject = async () => {
    try {
      const handle = await window.showDirectoryPicker({ id: 'mota-service-worker', mode: 'readwrite' });
      const entries = await Array.fromAsync(handle.values());
      if (!entries.some((entry) => entry.kind === 'file' && entry.name === 'index.html')) {
        const treeData = entries.map((entry): TreeNodeData => ({
          key: entry.name,
          icon: entry.kind === 'file' ? <IconFile /> : <IconFolder />,
          label: entry.name,
          handle: entry,
          isLeaf: entry.kind === 'file',
        }));
        setPendingDirectory({ handle, treeData });
        return;
      }
      await registerProject(handle);
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') Toast.error(String(error));
    }
  };

  return (
    <Shell>
      <section className={styles.headingBand}>
        <div>
          <Title heading={2}>本地魔塔工程</Title>
          <Text type="tertiary">浏览器直接访问本机工程目录，文件不会上传到服务器。</Text>
        </div>
        {supportsLocalFs ? (
          <Button
            theme="solid"
            type="primary"
            loading={!host.ready}
            disabled={!host.ready}
            onClick={() => void selectLocalProject()}
            data-test-id="register-project"
          >
            打开本地工程
          </Button>
        ) : null}
      </section>

      {!supportsLocalFs ? (
        <Banner type="warning" description="当前浏览器不支持本地文件系统，请使用最新版桌面 Chrome 或 Edge。" />
      ) : null}

      <section className={styles.projectList}>
        <Title heading={4}>历史工程</Title>
        <List
          loading={projects.isLoading || !host.ready}
          emptyContent={<Empty title="尚未注册工程" description="选择一个包含 index.html 的 mota-js 工程目录。" />}
          dataSource={projects.data?.list ?? []}
          renderItem={(project: ProjectSummary) => (
            <List.Item
              data-test-id={`project-${project.id}`}
              main={
                <div className={styles.projectMain}>
                  <Text strong>{project.name}</Text>
                  <Text type="tertiary">ID {project.id}</Text>
                </div>
              }
              extra={
                <Space>
                  <Tag color={permissionColor[project.permission]}>{permissionLabel[project.permission]}</Tag>
                  <Button onClick={() => openProject(project.id)}>工程详情</Button>
                </Space>
              }
            />
          )}
        />
      </section>
      <Modal
        visible={pendingDirectory !== null}
        title="工程入口未找到"
        okText="仍然注册"
        cancelText="取消"
        onCancel={() => setPendingDirectory(null)}
        onOk={async () => {
          if (!pendingDirectory) return;
          const handle = pendingDirectory.handle;
          setPendingDirectory(null);
          await registerProject(handle);
        }}
      >
        {pendingDirectory ? (
          <div>
            <p>“{pendingDirectory.handle.name}”中没有发现 index.html。可以继续使用该目录，或双击下面的子目录。</p>
            <Tree
              treeData={pendingDirectory.treeData}
              onDoubleClick={(_, node) => {
                const selected = (node as TreeNodeData & { handle: FileSystemHandle }).handle;
                if (selected.kind !== 'directory') return;
                setPendingDirectory(null);
                void registerProject(selected as FileSystemDirectoryHandle);
              }}
            />
          </div>
        ) : null}
      </Modal>
    </Shell>
  );
};

const ProjectView: FC<{ host: HostClient; id: number }> = ({ host, id }) => {
  const [forgetOpen, setForgetOpen] = useState(false);
  const [updateState, setUpdateState] = useState<EditorUpdateState>();
  const details = useQuery(['project', id], () => host.client.request(GetProjectMessage, { id }), {
    enabled: host.ready,
  });
  const editorStatus = useQuery(['editor-host'], () => host.client.request(GetEditorHostStatusMessage), {
    enabled: host.ready,
  });
  const access = details.data?.access;
  const project = access && access.status !== 'not-found' ? access.project : undefined;
  const reason = new URLSearchParams(window.location.search).get('reason');

  useEffect(() => {
    if (!host.ready) return;
    const controller = new AbortController();
    const url = editorUpdateUrl(id);
    const update = (state: EditorUpdateState) => {
      if (!controller.signal.aborted) setUpdateState(state);
    };
    const check = async (force = false) => {
      try {
        update(await checkEditorUpdate(url, force, controller.signal));
      } catch (error) {
        if (!controller.signal.aborted) console.debug('Editor update check is unavailable', error);
      }
    };
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.type !== 'motajs-editor-release-state') return;
      try {
        update(parseEditorUpdateState(event.data.state));
      } catch (error) {
        console.debug('Ignored an invalid Editor release broadcast', error);
      }
    };
    void getEditorUpdateState(url, controller.signal)
      .then(update)
      .then(() => check())
      .catch((error) => {
        if (!controller.signal.aborted) console.debug('Editor update state is unavailable', error);
      });
    const interval = window.setInterval(() => void check(), 10 * 60_000);
    const handleOnline = () => void check(true);
    navigator.serviceWorker.addEventListener('message', handleMessage);
    window.addEventListener('online', handleOnline);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      window.removeEventListener('online', handleOnline);
    };
  }, [host.ready, id]);

  const requestPermission = useCurrentFn(async () => {
    const handle = details.data?.handle;
    if (!handle) return;
    const permission = await handle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      Toast.warning('未获得工程目录权限');
      await details.refetch();
      return;
    }
    await host.client.request(ActivateProjectMessage, { id });
    await details.refetch();
  });

  const forget = useCurrentFn(async () => {
    await host.client.request(ForgetProjectMessage, { id });
    window.location.assign(appUrl());
  });

  if (!host.ready || details.isLoading) {
    return (
      <Shell>
        <div className={styles.center}>
          <Spin size="large" />
        </div>
      </Shell>
    );
  }
  if (!project) {
    return (
      <Shell>
        <Empty title="工程记录不存在" description={`没有找到 ID 为 ${id} 的工程。`}>
          <Button icon={<IconHome />} onClick={() => window.location.assign(appUrl())}>
            返回工程列表
          </Button>
        </Empty>
      </Shell>
    );
  }

  const ready = access?.status === 'ready' && project.hasIndex;
  const stagingIsUpdate = Boolean(
    updateState?.launch && updateState.staging && updateState.launch.buildId !== updateState.staging.buildId,
  );
  return (
    <Shell>
      <Breadcrumb className={styles.breadcrumb}>
        <Breadcrumb.Item href={appUrl()}>工程列表</Breadcrumb.Item>
        <Breadcrumb.Item>{project.name}</Breadcrumb.Item>
      </Breadcrumb>

      {reason === 'permission' ? <Banner type="warning" description="访问工程需要重新授权工程目录。" /> : null}
      {reason === 'missing-index' || project.hasIndex === false ? (
        <Banner type="danger" description="工程根目录中没有 index.html，当前无法运行预览。" />
      ) : null}
      {editorStatus.data?.status === 'unavailable' ? (
        <Banner type="warning" description={`编辑器暂不可用：${editorStatus.data.message}`} />
      ) : null}
      {updateState?.staging ? (
        <Banner
          type={updateState.staging.error ? 'warning' : 'info'}
          description={
            <div className={styles.editorUpdate} data-test-id="editor-update-progress">
              <div>
                {updateState.staging.error
                  ? `${editorReleaseLabel({
                      buildId: updateState.staging.buildId,
                      version: updateState.staging.version ?? '0.0.0',
                    })} 缓存失败，当前版本仍可继续使用。`
                  : `正在缓存${stagingIsUpdate ? '新版本 ' : ''}${editorReleaseLabel({
                      buildId: updateState.staging.buildId,
                      version: updateState.staging.version ?? '0.0.0',
                    })}`}
              </div>
              {!updateState.staging.error ? (
                <>
                  <Progress
                    percent={stagingPercent(updateState.staging)}
                    showInfo
                    size="small"
                    data-test-id="editor-update-progress-bar"
                  />
                  <Text type="tertiary" size="small">
                    {`${updateState.staging.completedFiles}/${updateState.staging.totalFiles} 个文件 · ${formatBytes(
                      updateState.staging.completedBytes,
                    )}/${formatBytes(updateState.staging.totalBytes)}`}
                  </Text>
                </>
              ) : null}
            </div>
          }
        />
      ) : null}
      {updateState?.candidate ? (
        <Banner
          type="success"
          description={`${editorReleaseLabel(updateState.candidate)} 已缓存完成，下次打开编辑器时启用。`}
        />
      ) : null}
      {reason === 'editor-unavailable' && !editorStatus.data ? (
        <Banner type="warning" description="编辑器暂不可用，请检查 Editor release 是否已经发布。" />
      ) : null}

      <section className={styles.projectHeader}>
        <div>
          <Title heading={2}>{project.name}</Title>
          <Text type="tertiary">本地工程总览</Text>
        </div>
        <Tag color={permissionColor[project.permission]} size="large">
          {permissionLabel[project.permission]}
        </Tag>
      </section>

      <Descriptions
        className={styles.descriptions}
        row
        data={[
          { key: '工程 ID', value: String(project.id) },
          { key: '目录名称', value: project.name },
          { key: '上次访问', value: new Date(project.lastTime).toLocaleString() },
          {
            key: '入口文件',
            value: project.hasIndex === undefined ? '授权后检查' : project.hasIndex ? 'index.html' : '缺失',
          },
          ...(editorStatus.data?.status === 'ready'
            ? [
                {
                  key: '编辑器',
                  value: editorReleaseLabel({
                    buildId: editorStatus.data.buildId,
                    version: editorStatus.data.editorVersion,
                  }),
                },
              ]
            : []),
        ]}
      />

      <Space className={styles.actions} spacing="medium" wrap>
        {editorStatus.data?.status === 'ready' ? (
          <Button
            theme="solid"
            type="primary"
            icon={<IconEdit />}
            disabled={!ready}
            onClick={() => window.location.assign(editorUrl(id))}
            data-test-id="open-editor"
          >
            打开编辑器
          </Button>
        ) : null}
        <Button
          icon={<IconPlay />}
          disabled={!ready}
          onClick={() => window.open(previewUrl(id), '_blank')}
          data-test-id="open-preview"
        >
          运行预览
        </Button>
        {project.permission !== 'granted' ? (
          <Button icon={<IconRefresh />} onClick={() => void requestPermission()} data-test-id="reauthorize-project">
            重新授权
          </Button>
        ) : null}
        <Button icon={<IconHome />} onClick={() => window.location.assign(appUrl())}>
          返回工程列表
        </Button>
        <Button type="danger" icon={<IconDelete />} onClick={() => setForgetOpen(true)} data-test-id="forget-project">
          移除记录
        </Button>
      </Space>
      <Modal
        visible={forgetOpen}
        title="移除工程记录"
        okType="danger"
        okText="移除记录"
        cancelText="取消"
        onCancel={() => setForgetOpen(false)}
        onOk={forget}
      >
        只会移除浏览器中的历史记录，不会删除磁盘上的工程文件。
      </Modal>
    </Shell>
  );
};

const MainView: FC = () => {
  const host = useHostClient();
  const route = currentViewRoute();
  return route.kind === 'project' ? <ProjectView host={host} id={route.id} /> : <HomeView host={host} />;
};

export default MainView;
