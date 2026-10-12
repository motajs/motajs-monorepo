import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorCore } from '@motajs/editor-core';
import { MemoryBackend } from './backend/memoryBackend';
import { DEMO_PANEL_TYPE, DEMO_RESOURCE_ID, DEMO_SAMPLE_CONTENT } from './demo/demoPanel';

const core = new EditorCore();
const backend = new MemoryBackend();

backend.seed(DEMO_RESOURCE_ID, DEMO_SAMPLE_CONTENT);
core.shellSystem.registerPanelType(DEMO_PANEL_TYPE);

await core.initialize(backend);

createRoot(document.getElementById('root')!).render(createElement(core.shellSystem.render()));
