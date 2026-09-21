import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_LAYERS, parseEditorSettings, validateMapLayers } from '../mapLayerSettings';

describe('map layer settings', () => {
  it('accepts the five-layer plugin order', () => {
    expect(
      validateMapLayers([
        { name: '背景层', property: 'bgmap' },
        { name: '背景层 2', property: 'bg2map' },
        { name: '事件层', property: 'map' },
        { name: '前景层', property: 'fgmap' },
        { name: '前景层 2', property: 'fg2map' },
      ]).map((layer) => layer.property),
    ).toEqual(['bgmap', 'bg2map', 'map', 'fgmap', 'fg2map']);
  });

  it('requires a unique property and the event layer', () => {
    expect(() =>
      validateMapLayers([
        { name: 'A', property: 'custom' },
        { name: 'B', property: 'custom' },
      ]),
    ).toThrow('不能重复');
    expect(() => validateMapLayers([{ name: 'A', property: 'custom' }])).toThrow('必须保留属性名为 map');
  });

  it('parses strict v1 settings and rejects unknown keys', () => {
    expect(
      parseEditorSettings({
        kind: 'editor-settings',
        formatVersion: 1,
        mapLayers: DEFAULT_MAP_LAYERS,
      }).mapLayers,
    ).toEqual(DEFAULT_MAP_LAYERS);
    expect(() =>
      parseEditorSettings({
        kind: 'editor-settings',
        formatVersion: 1,
        mapLayers: DEFAULT_MAP_LAYERS,
        typo: true,
      }),
    ).toThrow('未知属性');
  });
});
