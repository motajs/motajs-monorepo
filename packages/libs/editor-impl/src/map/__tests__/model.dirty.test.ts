import { describe, expect, it } from 'vitest';
import { IMapDocument } from '../types';
import { createMapDocument } from './fixtures';
import { isMapDataDirty, isMapPropertiesDirty } from '../model/dirty';

// 脏状态的用例：几何相同 / 改一格 / 改图层名 / 改图层顺序 / 改尺寸 / 属性表变化与键顺序。

/**
 * 造一份只改了指定格子的文档
 * @param document 原文档
 * @param layerIndex 图层下标
 * @param x 格子横坐标
 * @param y 格子纵坐标
 * @param value 新图块编号
 * @returns 改过一格的新文档
 */
function withCell(document: IMapDocument, layerIndex: number, x: number, y: number, value: number): IMapDocument {
  const layers = document.layers.map((layer, index) => {
    if (index !== layerIndex) return layer;

    const cells = layer.cells.map((row, rowIndex) =>
      rowIndex === y ? row.map((cell, column) => (column === x ? value : cell)) : row,
    );

    return { ...layer, cells };
  });

  return { ...document, layers };
}

/**
 * 造一份只改了指定图层名的文档
 * @param document 原文档
 * @param layerIndex 图层下标
 * @param name 新图层名
 * @returns 改过图层名的新文档
 */
function withLayerName(document: IMapDocument, layerIndex: number, name: string): IMapDocument {
  const layers = document.layers.map((layer, index) => (index === layerIndex ? { ...layer, name } : layer));

  return { ...document, layers };
}

describe('isMapDataDirty', () => {
  // 完全相同的文档不算脏
  it('完全相同的文档不脏', () => {
    const document = createMapDocument();

    expect(isMapDataDirty(document, createMapDocument())).toBe(false);
  });

  // 改动一格就算脏
  it('改一格变脏', () => {
    const document = createMapDocument();

    expect(isMapDataDirty(withCell(document, 0, 0, 0, 99), document)).toBe(true);
  });

  // 图层名变化算脏
  it('改图层名变脏', () => {
    const document = createMapDocument();

    expect(isMapDataDirty(withLayerName(document, 0, '新名字'), document)).toBe(true);
  });

  // 图层顺序变化算脏
  it('图层顺序变化变脏', () => {
    const document = createMapDocument();
    const reordered: IMapDocument = { ...document, layers: [document.layers[1], document.layers[0]] };

    expect(isMapDataDirty(reordered, document)).toBe(true);
  });

  // 宽高变化算脏
  it('宽高变化变脏', () => {
    const document = createMapDocument();

    expect(isMapDataDirty({ ...document, width: document.width + 1 }, document)).toBe(true);
    expect(isMapDataDirty({ ...document, height: document.height + 1 }, document)).toBe(true);
  });

  // 图层数变化算脏
  it('图层数变化变脏', () => {
    const document = createMapDocument();

    expect(isMapDataDirty({ ...document, layers: [document.layers[0]] }, document)).toBe(true);
  });

  // 从未保存过（基线为空）且文档有图层时算脏
  it('基线为空且文档有数据时脏', () => {
    const document = createMapDocument();

    expect(isMapDataDirty(document, undefined)).toBe(true);
  });
});

describe('isMapPropertiesDirty', () => {
  // 属性表内容相同不算脏，即使键顺序不同
  it('内容相同且键顺序不同不脏', () => {
    expect(isMapPropertiesDirty({ alpha: 1, beta: 2 }, { alpha: 1, beta: 2 })).toBe(false);
    expect(isMapPropertiesDirty({ beta: 2, alpha: 1 }, { alpha: 1, beta: 2 })).toBe(false);
  });

  // 属性表值变化算脏
  it('属性值变化变脏', () => {
    expect(isMapPropertiesDirty({ alpha: 2 }, { alpha: 1 })).toBe(true);
  });

  // 属性表键增删算脏
  it('属性键变化变脏', () => {
    expect(isMapPropertiesDirty({ alpha: 1, beta: 2 }, { alpha: 1 })).toBe(true);
  });

  // 从未保存过且属性表为空时不算脏
  it('基线为空且属性表为空时不脏', () => {
    expect(isMapPropertiesDirty({}, undefined)).toBe(false);
  });

  // 从未保存过但属性表有内容时算脏
  it('基线为空且属性表有内容时脏', () => {
    expect(isMapPropertiesDirty({ alpha: 1 }, undefined)).toBe(true);
  });
});
