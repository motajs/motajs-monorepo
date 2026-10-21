import { describe, expect, it } from 'vitest';
import { IMapDocument, IMapLayer } from '../types';
import { createMapDocument } from './fixtures';
import { applyCellChanges, collectNetCellChanges, isMapDocumentValid, isTileCatalogEmpty } from '../model/document';

/**
 * 用给定的格子替换样例文档的第一层，其余层保持不变
 * @param cells 第一层的新格子
 * @returns 替换后的文档
 */
function withBaseCells(cells: readonly (readonly number[])[]): IMapDocument {
  const document = createMapDocument();
  const base = document.layers[0];
  const layers: readonly IMapLayer[] = [{ ...base, cells }, ...document.layers.slice(1)];

  return { ...document, layers };
}

describe('isMapDocumentValid', () => {
  // 合法文档：宽高为正、两层、每层 3 行 4 列、每格为非负整数
  it('接受合法文档', () => {
    expect(isMapDocumentValid(createMapDocument())).toBe(true);
  });

  // 宽度为 0 时判为无效
  it('拒绝宽度为 0 的文档', () => {
    expect(isMapDocumentValid(createMapDocument({ width: 0 }))).toBe(false);
  });

  // 高度为 0 时判为无效
  it('拒绝高度为 0 的文档', () => {
    expect(isMapDocumentValid(createMapDocument({ height: 0 }))).toBe(false);
  });

  // 宽度不是整数时判为无效
  it('拒绝宽度非整数的文档', () => {
    expect(isMapDocumentValid(createMapDocument({ width: 1.5 }))).toBe(false);
  });

  // 没有任何图层时判为无效
  it('拒绝没有图层的文档', () => {
    expect(isMapDocumentValid(createMapDocument({ layers: [] }))).toBe(false);
  });

  // 某层行数不等于高度时判为无效
  it('拒绝行数不等于高度的文档', () => {
    expect(isMapDocumentValid(withBaseCells([[1, 2, 0, 3]]))).toBe(false);
  });

  // 某行长度不等于宽度时判为无效
  it('拒绝行长不等于宽度的文档', () => {
    expect(
      isMapDocumentValid(
        withBaseCells([
          [1, 2, 0],
          [0, 4, 5, 0],
          [1, 1, 0, 0],
        ]),
      ),
    ).toBe(false);
  });

  // 某格为负数时判为无效
  it('拒绝含负数格子的文档', () => {
    expect(
      isMapDocumentValid(
        withBaseCells([
          [1, 2, 0, -3],
          [0, 4, 5, 0],
          [1, 1, 0, 0],
        ]),
      ),
    ).toBe(false);
  });

  // 某格不是整数时判为无效
  it('拒绝含非整数格子的文档', () => {
    expect(
      isMapDocumentValid(
        withBaseCells([
          [1, 2, 0, 3.5],
          [0, 4, 5, 0],
          [1, 1, 0, 0],
        ]),
      ),
    ).toBe(false);
  });
});

describe('collectNetCellChanges', () => {
  // 同一格重复落笔时后写覆盖先写，before 取图层里的原值
  it('把重复落到的格子合并成一条后写覆盖先写的变化', () => {
    const document = createMapDocument();
    const changes = collectNetCellChanges(document.layers[0].cells, [
      { x: 0, y: 0, value: 2 },
      { x: 0, y: 0, value: 3 },
    ]);

    expect(changes).toEqual([{ x: 0, y: 0, before: 1, after: 3 }]);
  });

  // 写进去的值与原本相同时该格被丢弃
  it('丢弃值没有改变的格子', () => {
    const document = createMapDocument();
    const changes = collectNetCellChanges(document.layers[0].cells, [{ x: 0, y: 0, value: 1 }]);

    expect(changes).toEqual([]);
  });

  // 输出顺序按坐标首次出现的位置稳定，与最后一次落笔的位置无关
  it('按首次出现位置稳定排序', () => {
    const document = createMapDocument();
    const changes = collectNetCellChanges(document.layers[0].cells, [
      { x: 1, y: 0, value: 5 },
      { x: 0, y: 0, value: 5 },
      { x: 1, y: 0, value: 4 },
    ]);

    expect(changes).toEqual([
      { x: 1, y: 0, before: 2, after: 4 },
      { x: 0, y: 0, before: 1, after: 5 },
    ]);
  });

  // 超出图层范围的写入被丢弃，不产生越界变化
  it('丢弃超出图层范围的写入', () => {
    const document = createMapDocument();
    const changes = collectNetCellChanges(document.layers[0].cells, [
      { x: -1, y: 0, value: 5 },
      { x: 0, y: 99, value: 5 },
      { x: 0, y: 0, value: 5 },
    ]);

    expect(changes).toEqual([{ x: 0, y: 0, before: 1, after: 5 }]);
  });
});

describe('applyCellChanges', () => {
  // 应用变化返回新文档，入参文档的格子与图层都不被修改
  it('不修改入参文档', () => {
    const document = createMapDocument();
    const next = applyCellChanges(document, 'layer-base', [{ x: 0, y: 0, before: 1, after: 5 }]);

    expect(next).not.toBe(document);
    expect(document.layers[0].cells[0][0]).toBe(1);
    expect(next.layers[0].cells[0][0]).toBe(5);
  });

  // 一次横画只复制被触及的那一行，其余行保持原引用
  it('只复制被触及的行', () => {
    const document = createMapDocument();
    const originalRows = document.layers[0].cells;
    const next = applyCellChanges(document, 'layer-base', [
      { x: 0, y: 0, before: 1, after: 5 },
      { x: 1, y: 0, before: 2, after: 5 },
      { x: 2, y: 0, before: 0, after: 5 },
      { x: 3, y: 0, before: 3, after: 5 },
    ]);
    const nextRows = next.layers[0].cells;

    expect(nextRows[0]).not.toBe(originalRows[0]);
    expect(nextRows[1]).toBe(originalRows[1]);
    expect(nextRows[2]).toBe(originalRows[2]);
    expect(nextRows[0]).toEqual([5, 5, 5, 5]);
  });

  // 未被改动的图层对象保持原引用，只有目标图层被换新
  it('只替换目标图层', () => {
    const document = createMapDocument();
    const next = applyCellChanges(document, 'layer-base', [{ x: 0, y: 1, before: 0, after: 4 }]);

    expect(next.layers[0]).not.toBe(document.layers[0]);
    expect(next.layers[1]).toBe(document.layers[1]);
    expect(next.layers[0].cells[1][0]).toBe(4);
  });

  // 按图层标识定位：同名之外的层不会被误改
  it('按图层标识找到目标层并写入', () => {
    const document = createMapDocument();
    const next = applyCellChanges(document, 'layer-upper', [{ x: 1, y: 1, before: 3, after: 0 }]);

    expect(next.layers[0]).toBe(document.layers[0]);
    expect(next.layers[1].cells[1][1]).toBe(0);
  });

  // 找不到图层时原样返回同一份文档
  it('找不到图层时原样返回', () => {
    const document = createMapDocument();
    const next = applyCellChanges(document, 'layer-missing', [{ x: 0, y: 0, before: 1, after: 5 }]);

    expect(next).toBe(document);
  });

  // 没有变化时原样返回，避免无意义地复制图层数组
  it('没有变化时原样返回', () => {
    const document = createMapDocument();

    expect(applyCellChanges(document, 'layer-base', [])).toBe(document);
  });
});

describe('isTileCatalogEmpty', () => {
  // 没有任何分组时目录为空
  it('没有分组时为空目录', () => {
    expect(isTileCatalogEmpty(createMapDocument({ tileGroups: [] }))).toBe(true);
  });

  // 所有分组都不含图块时目录为空
  it('分组全空时为空目录', () => {
    const document = createMapDocument({
      tileGroups: [
        { id: 'group-a', name: '分组 A', imagePath: 'content/map/a.png', columns: 2, tiles: [] },
        { id: 'group-b', name: '分组 B', imagePath: 'content/map/b.png', columns: 2, tiles: [] },
      ],
    });

    expect(isTileCatalogEmpty(document)).toBe(true);
  });

  // 至少一个分组含图块时目录不为空
  it('至少一个图块时不为空目录', () => {
    expect(isTileCatalogEmpty(createMapDocument())).toBe(false);
  });

  // 目录只看结构、不看图片字节：图片路径为空字符串仍不算空目录
  it('图片路径缺失但编号有效时不算空目录', () => {
    const document = createMapDocument({
      tileGroups: [{ id: 'group-a', name: '分组 A', imagePath: '', columns: 1, tiles: [] }],
    });
    const withTile = createMapDocument({
      tileGroups: [
        {
          id: 'group-a',
          name: '分组 A',
          imagePath: '',
          columns: 1,
          tiles: [
            {
              number: 1,
              column: 0,
              row: 0,
              crop: { x: 0, y: 0, width: 32, height: 32 },
              name: '图块 1',
              pass: {
                out: { up: true, right: true, down: true, left: true },
                in: { up: true, right: true, down: true, left: true },
                onlyEventLayer: false,
              },
            },
          ],
        },
      ],
    });

    expect(isTileCatalogEmpty(document)).toBe(true);
    expect(isTileCatalogEmpty(withTile)).toBe(false);
  });
});
