/**
 * truth 3 第四条解析轴（editor 自身的 Vitest 管线）的提交守卫（G-02）。
 *
 * plan 02-01 声称同一个 core TSX 被四台解析器一致解析（core `tsc -b`、editor `tsc -b`、
 * editor Vite build、editor Vitest），但此前没有任何 editor 测试 import core，于是「editor Vitest」
 * 这条轴只被配置、从未被验证——未来该解析器回归不会有任何测试变红。
 *
 * 本测试经编辑器自己的 Vitest 管线（`resolvePlugin` 负责 `@/`，包名经 workspace 软链解析）
 * import `@motajs/editor-core/react`，并断言拿到的 `CoreProbe` 与 core 源文件的相对说明符加载出的是
 * **同一个模块**——若包解析指向编辑器内的同名文件，恒等式会失败；若 core 不再可解析，import 直接报错。
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreProbe } from '@motajs/editor-core/react';
import { CoreProbe as CoreProbeFromSource } from '../../../../../packages/libs/editor-core/lib/react/index.ts';

afterEach(() => {
  cleanup();
});

describe('editor Vitest 解析 editor-core', () => {
  it('包说明符经编辑器 Vitest 管线解析到 core 自身的源文件', () => {
    expect(typeof CoreProbe).toBe('function');
    expect(CoreProbe.name).toBe('CoreProbe');
    // 同一模块经「包说明符」与「core 源文件相对说明符」两条路径加载必须得到同一身份。
    expect(CoreProbe).toBe(CoreProbeFromSource);
  });

  it('CoreProbe 经编辑器 Vitest 管线渲染成功', () => {
    render(<CoreProbe label="core-resolution" />);
    expect(screen.getByText('core-resolution:0')).toBeTruthy();
  });
});
