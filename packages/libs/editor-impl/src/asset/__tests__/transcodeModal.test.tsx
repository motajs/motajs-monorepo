import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetCategoryKind } from '../../react';
import { probeAudioSource } from '../transcode/audioOpus';
import { IAssetAudioSourceInfo } from '../transcode/types';
import assetCss from '../asset.css?inline';
import { TranscodeModal } from '../components/TranscodeModal';
import { IAssetEntry } from '../types';

vi.mock('../transcode/audioOpus', () => ({ probeAudioSource: vi.fn() }));

configure({ testIdAttribute: 'data-test-id' });

// 转码弹窗用例：版面（输出格式说明、竖向自滚动列表、分割线、转码中状态）与
// 音频源参数探测（成为默认值 / 读不到回退 / 不覆盖用户输入 / 图片不探测）。
// 弹窗挂在 body 上，查找一律走 screen，不使用全局 document（editor-impl 全树禁用 document）。

/** 按素材字节路径读字节的回调 */
type LoadBytes = (path: string) => Promise<Uint8Array | undefined>;

// 每个用例结束后卸载已挂载的组件，避免弹层在用例之间残留
afterEach(() => {
  cleanup();
});

// 每个用例前清掉上一次的探测替身，避免实现与调用记录串味
beforeEach(() => {
  vi.mocked(probeAudioSource).mockReset();
});

/** 未接入取消回调时的缺省实现：不做任何事 */
function noopCancel(): void {}

/** 未接入开始回调时的缺省实现：不做任何事 */
function noopStart(): void {}

/** 未接入读字节回调时的缺省实现：一律返回 undefined */
function noopLoadBytes(): Promise<Uint8Array | undefined> {
  return Promise.resolve(undefined);
}

/** 探测用例用的读字节回调：一律返回非空字节，保证探测真的被调用 */
function nonEmptyLoadBytes(): Promise<Uint8Array | undefined> {
  return Promise.resolve(new Uint8Array([1, 2, 3]));
}

/**
 * 把素材名列表转成弹窗所需的条目
 * @param names 素材名列表
 * @returns 条目列表，路径按图片分类约定拼接
 */
function entriesOf(names: readonly string[]): readonly IAssetEntry[] {
  return names.map((name) => ({ name, path: `content/texture/${name}`, exists: true }));
}

/**
 * 渲染转码弹窗
 * @param kind 分类的大分类
 * @param busy 是否正在转码
 * @param loadBytes 按路径读字节的回调
 */
function renderModal(kind: AssetCategoryKind, busy: boolean, loadBytes: LoadBytes = noopLoadBytes): void {
  render(
    createElement(TranscodeModal, {
      open: true,
      kind,
      entries: entriesOf(['a.png']),
      loadBytes,
      busy,
      onCancel: noopCancel,
      onStart: noopStart,
    }),
  );
}

/**
 * 读取输入框的当前值
 * @param testId 输入框的 data-test-id
 * @returns 输入框的值；元素不是输入框时为空串
 */
function inputValue(testId: string): string {
  const input = screen.getByTestId(testId);

  return input instanceof HTMLInputElement ? input.value : '';
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
  // 图片分类：正文写明产物是 WebP（.webp），且不触发音频探测
  it('图片弹窗说明输出为 WebP', async () => {
    renderModal(AssetCategoryKind.Image, false, nonEmptyLoadBytes);

    const format = screen.getByTestId('asset-transcode-format').textContent ?? '';

    expect(format).toContain('WebP');
    expect(format).toContain('.webp');

    await act(async (): Promise<void> => {});

    expect(probeAudioSource).not.toHaveBeenCalled();
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

describe('音频转码默认参数探测', () => {
  // 音频条目默认全选：第一条选中素材的源参数成为码率与采样率默认值
  it('探测结果成为音频默认参数', async () => {
    vi.mocked(probeAudioSource).mockResolvedValue({ sampleRate: 16000, bitrate: 192000 });

    renderModal(AssetCategoryKind.Audio, false, nonEmptyLoadBytes);

    await waitFor((): void => {
      expect(inputValue('asset-transcode-sample-rate')).toBe('16000');
    });

    expect(inputValue('asset-transcode-bitrate')).toBe('192000');
  });

  // 读不到源参数时保留 128 kbps / 48 kHz 回退值
  it('探测不到时保留回退默认值', async () => {
    vi.mocked(probeAudioSource).mockResolvedValue(undefined);

    renderModal(AssetCategoryKind.Audio, false, nonEmptyLoadBytes);

    await waitFor((): void => {
      expect(probeAudioSource).toHaveBeenCalledTimes(1);
    });

    await act(async (): Promise<void> => {});

    expect(inputValue('asset-transcode-bitrate')).toBe('128000');
    expect(inputValue('asset-transcode-sample-rate')).toBe('48000');
  });

  // 用户先改过码率：探测结果晚到时不能覆盖用户输入
  it('用户改过的码率不被异步探测覆盖', async () => {
    let resolveProbe: (info: IAssetAudioSourceInfo | undefined) => void = (): void => undefined;
    const pending = new Promise<IAssetAudioSourceInfo | undefined>((resolve) => {
      resolveProbe = resolve;
    });

    vi.mocked(probeAudioSource).mockReturnValue(pending);

    renderModal(AssetCategoryKind.Audio, false, nonEmptyLoadBytes);

    await waitFor((): void => {
      expect(probeAudioSource).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByTestId('asset-transcode-bitrate'), { target: { value: '64000' } });

    expect(inputValue('asset-transcode-bitrate')).toBe('64000');

    await act(async (): Promise<void> => resolveProbe({ bitrate: 192000 }));

    expect(inputValue('asset-transcode-bitrate')).toBe('64000');
  });
});
