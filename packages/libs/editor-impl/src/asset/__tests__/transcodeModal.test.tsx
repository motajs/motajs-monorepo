import { cleanup, configure, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { AssetCategoryKind } from '../../react';
import assetCss from '../asset.css?inline';
import { TranscodeModal } from '../components/TranscodeModal';

configure({ testIdAttribute: 'data-test-id' });

// 转码弹窗版面用例：输出格式说明、竖向自滚动列表、「正在转码…」与按钮禁用状态；样式断言直接读 asset.css。
// 弹窗挂在 body 上，查找一律走 screen，不使用全局 document（editor-impl 全树禁用 document）。

// 每个用例结束后卸载已挂载的组件，避免弹层在用例之间残留
afterEach(() => {
  cleanup();
});

/** 未接入取消回调时的缺省实现：不做任何事 */
function noopCancel(): void {}

/** 未接入开始回调时的缺省实现：不做任何事 */
function noopStart(): void {}

/**
 * 渲染转码弹窗
 * @param kind 分类的大分类
 * @param busy 是否正在转码
 */
function renderModal(kind: AssetCategoryKind, busy: boolean): void {
  render(
    createElement(TranscodeModal, {
      open: true,
      kind,
      names: ['a.png'],
      busy,
      onCancel: noopCancel,
      onStart: noopStart,
    }),
  );
}

/**
 * 从样式文本里取出某个选择器的规则块
 * @param css 样式全文
 * @param selector 选择器
 * @returns 规则块正文；未找到时为空串
 */
function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf('}', start);

  if (start === -1 || end === -1) return '';

  return css.slice(start, end);
}

describe('转码弹窗版面', () => {
  // 图片分类：正文写明产物是 WebP（.webp）
  it('图片弹窗说明输出为 WebP', () => {
    renderModal(AssetCategoryKind.Image, false);

    const format = screen.getByTestId('asset-transcode-format').textContent ?? '';

    expect(format).toContain('WebP');
    expect(format).toContain('.webp');
  });

  // 音频分类：正文写明产物是 WebM 容器中的 Opus（.webm）
  it('音频弹窗说明输出为 WebM 容器中的 Opus', () => {
    renderModal(AssetCategoryKind.Audio, false);

    const format = screen.getByTestId('asset-transcode-format').textContent ?? '';

    expect(format).toContain('WebM');
    expect(format).toContain('Opus');
  });

  // 转码中：显示「正在转码…」，开始与取消都禁用
  it('转码中显示状态并禁用开始与取消', () => {
    renderModal(AssetCategoryKind.Image, true);

    expect(screen.getByTestId('asset-transcode-busy').textContent).toContain('正在转码');
    expect(screen.getByTestId('asset-transcode-start').hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('asset-transcode-cancel').hasAttribute('disabled')).toBe(true);
  });

  // 素材列表竖排、过长时列表自身滚动；相邻分区之间有分割线
  it('素材列表竖排自滚动且分区有分割线', () => {
    const list = ruleBody(assetCss, '.asset-transcode-list');
    const section = ruleBody(assetCss, '.asset-transcode-section');

    expect(list).toContain('flex-direction: column');
    expect(list).toContain('overflow-y: auto');
    expect(section).toContain('border-top');
  });
});
