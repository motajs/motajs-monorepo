import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import { GlobalStore } from './stores/index.ts';
import { queryClient } from './queryClient.ts';
import '@/css/index.css';
import '@/css/editor.css';
import { initializeEditorEnvironment } from './environment';

const root = createRoot(document.getElementById('root')!);

try {
  initializeEditorEnvironment();
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <GlobalStore>
          <App />
        </GlobalStore>
      </QueryClientProvider>
    </StrictMode>,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  root.render(
    <main data-test-id="editor-startup-error" style={{ padding: 24 }}>
      编辑器启动失败：{message}
    </main>,
  );
}
