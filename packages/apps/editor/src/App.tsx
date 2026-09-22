import { useEffect, type FC } from 'react';
import { Workbench } from './Workbench';
import { ModalsProvider } from './Workbench/modals';
import { EditorStore } from './stores/EditorStore';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { editorConfigService } from './services/editorConfig';
import { CodeEditorProvider } from './Workbench/CodeEditor/CodeEditorProvider';
import { EventEditorProvider } from './Workbench/EventsEditor/EventEditorContext';
import { RuntimeProvider } from './runtime';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { PersistenceNotification } from './components/PersistenceNotification';
import { CoreProbe } from '@motajs/editor-core/react';

const App: FC = () => {
  const { theme } = EditorStore.useStore();
  const isDark = theme === 'editor_color_dark';

  useEffect(() => {
    void editorConfigService.load();
  }, []);

  // 响应主题变化，更新 CSS 链接
  useEffect(() => {
    const colorCss = document.getElementById('color_css') as HTMLLinkElement | null;
    if (colorCss) {
      colorCss.href = new URL(`assets/theme/${theme}.css`, document.baseURI).href;
    }
    document.documentElement.dataset.editorTheme = isDark ? 'dark' : 'light';
  }, [isDark, theme]);

  return (
    <>
      <link id="color_css" rel="stylesheet" />

      <ConfigProvider theme={{ algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm }}>
        <PersistenceNotification />
        <RuntimeProvider>
          <CodeEditorProvider>
            <EventEditorProvider>
              <ModalsProvider>
                <AppErrorBoundary>
                  <Workbench />
                </AppErrorBoundary>
                {/* <script>/* */}
                <div id="gameInject" style={{ display: 'none' }} />
                {/*
                  Phase 2 的边界证据：编辑器真实消费 @motajs/editor-core。
                  display:none 保证已提交的截图基线不受影响；真正的组合根建立后即移除。
                */}
                <div style={{ display: 'none' }}>
                  <CoreProbe />
                </div>
              </ModalsProvider>
            </EventEditorProvider>
          </CodeEditorProvider>
        </RuntimeProvider>
      </ConfigProvider>
    </>
  );
};

export default App;
