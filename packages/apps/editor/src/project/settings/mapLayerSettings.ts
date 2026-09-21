import { isEqual } from 'es-toolkit';
import { useEffect, useMemo } from 'react';
import { FileHandlerManager } from '@/fs/FileHandlerManager';
import type { Content } from '@/fs/types';
import { useSignal } from '@/hooks/useFs';
import { deleteTextFileOperation, operationHistory, writeTextFileOperation } from '@/project/history';
import { fs } from '@/services/fs';

export const EDITOR_SETTINGS_PATH = '.metaphysics/settings.json';

export interface MapLayerDefinition {
  name: string;
  property: string;
}

export interface EditorSettings {
  kind: 'editor-settings';
  formatVersion: 1;
  mapLayers: MapLayerDefinition[];
}

export const DEFAULT_MAP_LAYERS: readonly MapLayerDefinition[] = Object.freeze([
  Object.freeze({ name: '背景层', property: 'bgmap' }),
  Object.freeze({ name: '事件层', property: 'map' }),
  Object.freeze({ name: '前景层', property: 'fgmap' }),
]);

export type MapLayerSettingsState =
  | { status: 'loading'; layers: readonly MapLayerDefinition[] }
  | { status: 'ready'; layers: readonly MapLayerDefinition[]; overridden: boolean }
  | { status: 'error'; layers: readonly MapLayerDefinition[]; error: Error };

const PROPERTY_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const SETTINGS_KEYS = new Set(['kind', 'formatVersion', 'mapLayers']);
const LAYER_KEYS = new Set(['name', 'property']);
let activeMapLayers: readonly MapLayerDefinition[] = DEFAULT_MAP_LAYERS;

function assertRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} 必须是 object`);
  }
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>, path: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) throw new Error(`${path} 包含未知属性：${unknown.join('、')}`);
}

export function validateMapLayers(value: unknown): MapLayerDefinition[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('mapLayers 必须是至少包含一个图层的数组');
  }

  const properties = new Set<string>();
  const layers = value.map((item, index): MapLayerDefinition => {
    const path = `mapLayers[${index}]`;
    assertRecord(item, path);
    rejectUnknownKeys(item, LAYER_KEYS, path);
    if (typeof item.name !== 'string' || item.name.trim().length === 0) {
      throw new Error(`${path}.name 必须是非空字符串`);
    }
    if (typeof item.property !== 'string' || !PROPERTY_PATTERN.test(item.property)) {
      throw new Error(`${path}.property 必须是合法的属性名`);
    }
    if (properties.has(item.property)) {
      throw new Error(`图层属性名不能重复：${item.property}`);
    }
    properties.add(item.property);
    return { name: item.name.trim(), property: item.property };
  });

  if (!properties.has('map')) {
    throw new Error('必须保留属性名为 map 的事件层');
  }
  return layers;
}

export function parseEditorSettings(value: unknown): EditorSettings {
  assertRecord(value, 'settings');
  rejectUnknownKeys(value, SETTINGS_KEYS, 'settings');
  if (value.kind !== 'editor-settings') throw new Error('settings.kind 必须是 editor-settings');
  if (value.formatVersion !== 1) throw new Error('settings.formatVersion 必须是 1');
  return {
    kind: 'editor-settings',
    formatVersion: 1,
    mapLayers: validateMapLayers(value.mapLayers),
  };
}

function parseText(text: string): EditorSettings {
  try {
    return parseEditorSettings(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${EDITOR_SETTINGS_PATH} 不是合法的严格 JSON：${error.message}`);
    }
    throw error;
  }
}

function stateFromContent(content: Content<string>): MapLayerSettingsState {
  if (content.status === 'idle' || content.status === 'loading') {
    return { status: 'loading', layers: DEFAULT_MAP_LAYERS };
  }
  if (content.status === 'error') {
    return { status: 'error', layers: DEFAULT_MAP_LAYERS, error: content.error };
  }
  if (content.status === 'not-found') {
    activeMapLayers = DEFAULT_MAP_LAYERS;
    return { status: 'ready', layers: DEFAULT_MAP_LAYERS, overridden: false };
  }
  try {
    const layers = parseText(content.value).mapLayers;
    activeMapLayers = layers;
    return { status: 'ready', layers, overridden: true };
  } catch (error) {
    return {
      status: 'error',
      layers: DEFAULT_MAP_LAYERS,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export function useMapLayerSettings(): MapLayerSettingsState {
  const handler = FileHandlerManager.get(EDITOR_SETTINGS_PATH);
  const content = useSignal(handler.content);
  useEffect(() => {
    if (content.status === 'idle') void FileHandlerManager.load(EDITOR_SETTINGS_PATH);
  }, [content.status]);
  return useMemo(() => stateFromContent(content), [content]);
}

export async function loadMapLayerSettings(): Promise<MapLayerDefinition[]> {
  const handler = await FileHandlerManager.load(EDITOR_SETTINGS_PATH);
  const state = stateFromContent(handler.getContent());
  if (state.status === 'error') throw state.error;
  return state.layers.map((layer) => ({ ...layer }));
}

/**
 * Commands use the last successfully loaded settings snapshot. The map workspace
 * owns loading; an unreadable settings file never silently replaces that snapshot.
 */
export function getMapLayerSettingsSnapshot(): readonly MapLayerDefinition[] {
  return activeMapLayers;
}

export async function saveMapLayerSettings(value: unknown): Promise<void> {
  const layers = validateMapLayers(value);
  const meta = { label: '配置地图图层', stage: 'editor-settings.map-layers' };
  const fileOptions = {
    invalidate: () => {
      stateFromContent(FileHandlerManager.get(EDITOR_SETTINGS_PATH).getContent());
    },
  };
  const operation = isEqual(layers, DEFAULT_MAP_LAYERS)
    ? deleteTextFileOperation(EDITOR_SETTINGS_PATH, meta, fileOptions)
    : writeTextFileOperation(
        EDITOR_SETTINGS_PATH,
        `${JSON.stringify(
          {
            kind: 'editor-settings',
            formatVersion: 1,
            mapLayers: layers,
          },
          null,
          2,
        )}\n`,
        meta,
        fileOptions,
      );

  await fs.promises.mkdir('.metaphysics');
  await operationHistory.execute(operation);
  activeMapLayers = layers;
}
