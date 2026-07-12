import { useEffect, type FC } from "react";
import { Workbench } from "./Workbench";
import { ModalsProvider } from "./Workbench/modals";
import { EditorStore } from "./stores/EditorStore";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { editorConfigService } from "./services/editorConfig";
import { CodeEditorProvider } from "./Workbench/CodeEditor/CodeEditorContext";
import { EventEditorProvider } from "./Workbench/EventsEditor/EventEditorContext";
import { RuntimeProvider } from "./runtime";

const App: FC = () => {

  const { theme } = EditorStore.useStore();

  useEffect(() => {
    void editorConfigService.load();
  }, []);

  // 响应主题变化，更新 CSS 链接
  useEffect(() => {
    const colorCss = document.getElementById("color_css") as HTMLLinkElement | null;
    if (colorCss) {
      colorCss.href = new URL(`assets/theme/${theme}.css`, document.baseURI).href;
    }
  }, [theme]);

  return (
    <>
      <link id="color_css" rel="stylesheet" />

      <RuntimeProvider>
        <CodeEditorProvider>
          <EventEditorProvider>
            <ModalsProvider>
            <AppErrorBoundary>
              <Workbench />
            </AppErrorBoundary>
            {/* <script>/* */}
            <div id="gameInject" style={{ display: "none" }} />
            </ModalsProvider>
          </EventEditorProvider>
        </CodeEditorProvider>
      </RuntimeProvider>
    </>
  );
}

export default App;
