import { describe, expect, it } from 'vitest';
import shellCss from '../shell.css?inline';

describe('外壳标签名限宽（G-02.1-3 ①）', () => {
  // 标签名规则块内含 max-width: 200px，多表超长标签名以省略号截断（悬浮仍由 title 显示全名）
  it('.editor-shell-tab-label 规则含 max-width: 200px', () => {
    expect(shellCss).toMatch(/\.editor-shell-tab-label\s*\{[^}]*max-width:\s*200px/);
  });
});
