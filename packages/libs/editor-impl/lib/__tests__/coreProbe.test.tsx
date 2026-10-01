import { css } from '@styled-system/css';
import { describe, expect, test } from 'vitest';
import { CoreProbe } from '../react/index';

describe('editor-core 探针', () => {
  // CoreProbe 来自 core 自身的文件
  test('CoreProbe 来自 core 自身的文件', () => {
    expect(typeof CoreProbe).toBe('function');
    expect(CoreProbe.name).toBe('CoreProbe');
  });

  // 模板字面量 css 调用产出 config 稳定的原子类名
  test('模板字面量 css 调用产出 config 稳定的原子类名', () => {
    expect(css`
      display: block;
    `).toBe('display_block');
  });

  // css 是可调用的函数
  test('css 是可调用的函数', () => {
    expect(typeof css).toBe('function');
  });
});
