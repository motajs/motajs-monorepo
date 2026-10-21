import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorCore } from '@motajs/editor-core';
import { AssetCapabilityProvider } from '@motajs/editor-impl/asset';
import { tablePanelType } from '@motajs/editor-impl/table';
import { MemoryBackend } from './backend/memoryBackend';
import { ASSET_DEMO_CATEGORIES, registerAssetDemo, seedAssetDemo, seedUnregisteredAssetDemo } from './demo/assetDemo';
import { DevCodeEditorProvider } from './demo/devCodeEditor';
import { registerDevMenu } from './demo/devMenu';
import { DEMO_PANEL_TYPE, DEMO_SAMPLE_CONTENT, DEMO_SAMPLE_PATH } from './demo/demoPanel';
import {
  createTablePanelOpener,
  TABLE_DEMO_COMMENTED_DATA,
  TABLE_DEMO_COMMENTED_DATA_PATH,
  TABLE_DEMO_COMMENTED_SCHEMA_PATH,
  TABLE_DEMO_DATA,
  TABLE_DEMO_DATA_PATH,
  TABLE_DEMO_SAMPLE_SCHEMA,
  TABLE_DEMO_SCHEMA,
  TABLE_DEMO_SCHEMA_PATH,
  TABLE_DEMO_SYSTEM_PREFIX_DATA,
  TABLE_DEMO_SYSTEM_PREFIX_DATA_PATH,
  TABLE_DEMO_SYSTEM_PREFIX_SCHEMA_PATH,
  TABLE_PRESETS,
} from './demo/tableDemo';

const core = new EditorCore();
const backend = new MemoryBackend();

backend.seed(DEMO_SAMPLE_PATH, DEMO_SAMPLE_CONTENT);
backend.seed(TABLE_DEMO_DATA_PATH, TABLE_DEMO_DATA);
backend.seed(TABLE_DEMO_SCHEMA_PATH, TABLE_DEMO_SCHEMA);
backend.seed(TABLE_DEMO_SYSTEM_PREFIX_DATA_PATH, TABLE_DEMO_SYSTEM_PREFIX_DATA);
backend.seed(TABLE_DEMO_SYSTEM_PREFIX_SCHEMA_PATH, TABLE_DEMO_SAMPLE_SCHEMA);
backend.seed(TABLE_DEMO_COMMENTED_DATA_PATH, TABLE_DEMO_COMMENTED_DATA);
backend.seed(TABLE_DEMO_COMMENTED_SCHEMA_PATH, TABLE_DEMO_SAMPLE_SCHEMA);
await seedAssetDemo(backend);
seedUnregisteredAssetDemo(backend);
core.shellSystem.registerPanelType(DEMO_PANEL_TYPE);
core.shellSystem.registerPanelType(tablePanelType);
registerDevMenu(core);
registerAssetDemo(core);

await core.initialize({ fs: backend, maxUndoStep: backend.maxUndoStep, ignore: ['node_modules', '.git'] });

createRoot(document.getElementById('root')!).render(
  createElement(AssetCapabilityProvider, {
    access: core.resourceSystem,
    categories: ASSET_DEMO_CATEGORIES,
    capabilities: { tablePanel: createTablePanelOpener(core), tablePresets: TABLE_PRESETS },
    children: createElement(DevCodeEditorProvider, {
      capabilities: {},
      children: createElement(core.shellSystem.render()),
    }),
  }),
);
