import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorCore } from '@motajs/editor-core';
import { CapabilityProvider } from '@motajs/editor-impl/react';
import { tablePanelType } from '@motajs/editor-impl/table';
import { MemoryBackend } from './backend/memoryBackend';
import { registerDevMenu } from './demo/devMenu';
import { DEMO_PANEL_TYPE, DEMO_RESOURCE_ID, DEMO_SAMPLE_CONTENT } from './demo/demoPanel';
import {
  createTablePanelOpener,
  openTableDemoPanel,
  TABLE_DEMO_DATA,
  TABLE_DEMO_MENU_ID,
  TABLE_DEMO_MENU_TITLE,
  TABLE_DEMO_SCHEMA,
  TABLE_DEMO_TARGET,
} from './demo/tableDemo';

const core = new EditorCore();
const backend = new MemoryBackend();

backend.seed(DEMO_RESOURCE_ID, DEMO_SAMPLE_CONTENT);
backend.seed(TABLE_DEMO_TARGET.data, TABLE_DEMO_DATA);
backend.seed(TABLE_DEMO_TARGET.schema, TABLE_DEMO_SCHEMA);
core.shellSystem.registerPanelType(DEMO_PANEL_TYPE);
core.shellSystem.registerPanelType(tablePanelType);
core.shellSystem.registerMenuItem({
  id: TABLE_DEMO_MENU_ID,
  title: TABLE_DEMO_MENU_TITLE,
  onClick: (): void => {
    void openTableDemoPanel(core);
  },
});
registerDevMenu(core);

await core.initialize(backend);

createRoot(document.getElementById('root')!).render(
  createElement(CapabilityProvider, {
    capabilities: { tablePanel: createTablePanelOpener(core) },
    children: createElement(core.shellSystem.render()),
  }),
);
