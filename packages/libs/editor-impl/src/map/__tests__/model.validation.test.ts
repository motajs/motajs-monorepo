import { describe, expect, it } from 'vitest';
import { validateLayerName, validateMapName, validateMapSize } from '../model/validation';

// 输入校验的用例：空名、重名、大小写、宽高整数 / 越界与上限边界。

describe('validateMapName', () => {
  // 空串与只有空白的名字被拒绝
  it('空名被拒绝', () => {
    expect(validateMapName('', ['样例'])).toBe('请输入地图名称。');
    expect(validateMapName('   ', ['样例'])).toBe('请输入地图名称。');
  });

  // 正常名字通过
  it('正常名字通过', () => {
    expect(validateMapName('新地图', ['样例'])).toBeNull();
  });

  // 与现有地图同名被拒绝，比较时去掉首尾空白
  it('重名被拒绝（忽略首尾空白）', () => {
    expect(validateMapName('样例', ['样例', '别的地图'])).toBe('名称已存在。');
    expect(validateMapName('  样例  ', ['样例'])).toBe('名称已存在。');
  });

  // 大小写不同的名字不算重名
  it('大小写不同不算重名', () => {
    expect(validateMapName('Sample', ['sample'])).toBeNull();
  });
});

describe('validateLayerName', () => {
  // 空串与只有空白的图层名被拒绝
  it('空图层名被拒绝', () => {
    expect(validateLayerName('', ['图层 1'])).toBe('请输入图层名称。');
    expect(validateLayerName('  ', ['图层 1'])).toBe('请输入图层名称。');
  });

  // 与现有图层同名被拒绝
  it('图层重名被拒绝', () => {
    expect(validateLayerName('图层 1', ['图层 1'])).toBe('图层名称已存在。');
  });

  // 正常图层名通过
  it('正常图层名通过', () => {
    expect(validateLayerName('图层 2', ['图层 1'])).toBeNull();
  });
});

describe('validateMapSize', () => {
  // 宽度为 0、负数或小数时被拒绝，文案与 UI-SPEC 逐字一致
  it('宽度非正整数被拒绝', () => {
    const limit = { maxWidth: 64, maxHeight: 64 };

    expect(validateMapSize({ width: 0, height: 10 }, limit)).toBe('宽度必须是 1 到 64 之间的整数。');
    expect(validateMapSize({ width: -1, height: 10 }, limit)).toBe('宽度必须是 1 到 64 之间的整数。');
    expect(validateMapSize({ width: 10.5, height: 10 }, limit)).toBe('宽度必须是 1 到 64 之间的整数。');
  });

  // 宽度超过上限时返回错误而不是夹取
  it('宽度超上限被拒绝且不夹取', () => {
    const limit = { maxWidth: 64, maxHeight: 64 };

    expect(validateMapSize({ width: 65, height: 10 }, limit)).toBe('宽度必须是 1 到 64 之间的整数。');
  });

  // 高度为 0、负数、小数或超过上限时被拒绝，文案与 UI-SPEC 逐字一致
  it('高度非法被拒绝', () => {
    const limit = { maxWidth: 64, maxHeight: 64 };

    expect(validateMapSize({ width: 10, height: 0 }, limit)).toBe('高度必须是 1 到 64 之间的整数。');
    expect(validateMapSize({ width: 10, height: -1 }, limit)).toBe('高度必须是 1 到 64 之间的整数。');
    expect(validateMapSize({ width: 10, height: 2.5 }, limit)).toBe('高度必须是 1 到 64 之间的整数。');
    expect(validateMapSize({ width: 10, height: 65 }, limit)).toBe('高度必须是 1 到 64 之间的整数。');
  });

  // 上限边界值本身通过
  it('上限边界值通过', () => {
    const limit = { maxWidth: 64, maxHeight: 32 };

    expect(validateMapSize({ width: 1, height: 1 }, limit)).toBeNull();
    expect(validateMapSize({ width: 64, height: 32 }, limit)).toBeNull();
  });

  // 没有上限时只校验正整数下限
  it('无上限时只校验正整数', () => {
    expect(validateMapSize({ width: 1, height: 999999 })).toBeNull();
    expect(validateMapSize({ width: 0, height: 10 })).toBe('宽度必须是正整数。');
    expect(validateMapSize({ width: 10, height: 1.5 })).toBe('高度必须是正整数。');
  });
});
