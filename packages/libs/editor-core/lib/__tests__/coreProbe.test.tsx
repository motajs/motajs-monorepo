/**
 * Phase 2 smoke 测试（D-12/D-21）。
 *
 * 它存在的第一理由是机械的：`vitest run` 在零测试文件时非零退出，会让 root `pnpm test`
 * 的 fan-out 变红。第二个理由是解析证据（PKG-03）：相对包内导入 `../react/index` 必须可解析，
 * editor 生成的 `@styled-system` 必须可解析并产出 config 稳定的原子类名 `display_block`。
 */
import { css } from '@styled-system/css';
import { describe, expect, test } from 'vitest';
import { CoreProbe } from '../react/index';

describe('editor-core 探针', () => {
  test('CoreProbe 来自 core 自身的文件', () => {
    expect(typeof CoreProbe).toBe('function');
    expect(CoreProbe.name).toBe('CoreProbe');
  });

  test('模板字面量 css 调用产出 config 稳定的原子类名', () => {
    expect(css`
      display: block;
    `).toBe('display_block');
  });

  test('css 是可调用的函数', () => {
    expect(typeof css).toBe('function');
  });
});
