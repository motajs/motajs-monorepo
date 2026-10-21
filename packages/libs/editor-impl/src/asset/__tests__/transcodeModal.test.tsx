import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetCategoryKind } from '../../react';
import { probeAudioSource } from '../transcode/audioOpus';
import { IAssetAudioSourceInfo, IAssetTranscodeOptions } from '../transcode/types';
import assetCss from '../asset.css?inline';
import { TranscodeModal } from '../components/TranscodeModal';
import { IAssetEntry } from '../types';

vi.mock('../transcode/audioOpus', () => ({ probeAudioSource: vi.fn() }));

configure({ testIdAttribute: 'data-test-id' });

// 转码弹窗用例：版面（输出格式说明、竖向自滚动列表、分割线、转码中状态）、档位预设与自定义输入框、
// 界面单位（kbps / kHz）、实际参数与说明文案、不覆盖时的改名提示，以及开始转换时换算出的内部参数。
// 弹窗挂在 body 上，查找一律走 screen，不使用全局 document（editor-impl 全树禁用 document）。

/** 按素材字节路径读字节的回调 */
type LoadBytes = (path: string) => Promise<Uint8Array | undefined>;

/** 开始转换回调 */
type StartHandler = (names: readonly string[], options: IAssetTranscodeOptions) => void;

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
  return names.map((name) => ({ name, path: `content/texture/${name}`, exists: true, registered: true }));
}

/**
 * 渲染转码弹窗
 * @param kind 分类的大分类
 * @param busy 是否正在转码
 * @param loadBytes 按路径读字节的回调
 * @param onStart 开始转换回调
 */
function renderModal(
  kind: AssetCategoryKind,
  busy: boolean,
  loadBytes: LoadBytes = noopLoadBytes,
  onStart: StartHandler = noopStart,
): void {
  render(
    createElement(TranscodeModal, {
      open: true,
      kind,
      entries: entriesOf(['a.png']),
      loadBytes,
      busy,
      onCancel: noopCancel,
      onStart,
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
 * 按选项文字选中一个档位
 * @param label 档位显示名
 */
function choosePreset(label: string): void {
  fireEvent.click(screen.getByText(label));
}

/**
 * 读取「本档实际参数」的文案
 * @returns 实际参数文案
 */
function effectiveText(): string {
  return screen.getByTestId('asset-transcode-effective').textContent ?? '';
}

/** 点开始转换，并在「覆盖旧文件」的二次确认里确认 */
function startAndConfirm(): void {
  fireEvent.click(screen.getByTestId('asset-transcode-start'));
  fireEvent.click(screen.getByTestId('asset-transcode-confirm'));
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

describe('图片档位预设', () => {
  // 图片默认档是无损压缩：实际参数为 100，且没有质量输入框
  it('图片默认档为无损压缩且不显示质量输入框', () => {
    renderModal(AssetCategoryKind.Image, false);

    expect(effectiveText()).toBe('WebP 质量 100');
    expect(screen.queryByTestId('asset-transcode-quality')).toBeNull();
  });

  // 切档后实际参数跟着变；只有自定义档出现输入框，且初值沿用默认质量
  it('切换图片档位时实际参数跟着变，自定义档才出现输入框', () => {
    renderModal(AssetCategoryKind.Image, false);

    choosePreset('常规压缩 92');
    expect(effectiveText()).toBe('WebP 质量 92');

    choosePreset('体积优先 80');
    expect(effectiveText()).toBe('WebP 质量 80');

    choosePreset('自定义参数');
    expect(inputValue('asset-transcode-quality')).toBe('100');

    fireEvent.change(screen.getByTestId('asset-transcode-quality'), { target: { value: '85' } });
    expect(effectiveText()).toBe('WebP 质量 85');
  });

  // 开始转换时把档位换算成质量：默认 100、常规压缩 92、自定义 85
  it('开始转换时按档位给出图片质量', () => {
    const options: IAssetTranscodeOptions[] = [];

    renderModal(AssetCategoryKind.Image, false, noopLoadBytes, (_names, value): void => {
      options.push(value);
    });

    startAndConfirm();
    expect(options[0].quality).toBe(100);

    choosePreset('常规压缩 92');
    startAndConfirm();
    expect(options[1].quality).toBe(92);

    choosePreset('自定义参数');
    fireEvent.change(screen.getByTestId('asset-transcode-quality'), { target: { value: '85' } });
    startAndConfirm();
    expect(options[2].quality).toBe(85);
  });
});

describe('音频档位预设', () => {
  // 音频默认档是常规压缩：实际参数为 128 kbps + 48 kHz，且没有码率 / 采样率输入框
  it('音频默认档为常规压缩且不显示码率与采样率输入框', () => {
    renderModal(AssetCategoryKind.Audio, false);

    expect(effectiveText()).toBe('128 kbps + 48 kHz');
    expect(screen.queryByTestId('asset-transcode-bitrate')).toBeNull();
    expect(screen.queryByTestId('asset-transcode-sample-rate')).toBeNull();
  });

  // 切到自定义档才出现两个输入框，单位是 kbps / kHz
  it('音频自定义档出现码率与采样率输入框且单位是 kbps / kHz', () => {
    renderModal(AssetCategoryKind.Audio, false);

    choosePreset('自定义参数');

    expect(screen.getByTestId('asset-transcode-bitrate')).toBeDefined();
    expect(screen.getByTestId('asset-transcode-sample-rate')).toBeDefined();
    expect(screen.getByText('kbps')).toBeDefined();
    expect(screen.getByText('kHz')).toBeDefined();
  });

  // 开始转换时把 kbps / kHz 换算成 bps / Hz：64 kbps + 44.1 kHz → 64000 + 44100
  it('音频自定义参数开始转换时换算成 64000 bps 与 44100 Hz', () => {
    const options: IAssetTranscodeOptions[] = [];

    renderModal(AssetCategoryKind.Audio, false, noopLoadBytes, (_names, value): void => {
      options.push(value);
    });

    choosePreset('自定义参数');
    fireEvent.change(screen.getByTestId('asset-transcode-bitrate'), { target: { value: '64' } });
    fireEvent.change(screen.getByTestId('asset-transcode-sample-rate'), { target: { value: '44.1' } });

    startAndConfirm();

    expect(options[0].bitrate).toBe(64000);
    expect(options[0].sampleRate).toBe(44100);
    expect(options[0].coverOrigin).toBe(true);
  });
});

describe('音频源参数探测', () => {
  // 探测到的源参数只用来预填自定义输入框：192000 bps / 16000 Hz → 192 kbps / 16 kHz
  it('探测结果预填自定义输入框', async () => {
    vi.mocked(probeAudioSource).mockResolvedValue({ sampleRate: 16000, bitrate: 192000 });

    renderModal(AssetCategoryKind.Audio, false, nonEmptyLoadBytes);

    await waitFor((): void => {
      expect(probeAudioSource).toHaveBeenCalledTimes(1);
    });

    choosePreset('自定义参数');

    expect(Number(inputValue('asset-transcode-bitrate'))).toBe(192);
    expect(Number(inputValue('asset-transcode-sample-rate'))).toBe(16);
  });

  // 读不到源参数时保留 128 kbps / 48 kHz 回退值
  it('探测不到时保留回退默认值', async () => {
    vi.mocked(probeAudioSource).mockResolvedValue(undefined);

    renderModal(AssetCategoryKind.Audio, false, nonEmptyLoadBytes);

    await waitFor((): void => {
      expect(probeAudioSource).toHaveBeenCalledTimes(1);
    });

    choosePreset('自定义参数');

    await act(async (): Promise<void> => {});

    expect(Number(inputValue('asset-transcode-bitrate'))).toBe(128);
    expect(Number(inputValue('asset-transcode-sample-rate'))).toBe(48);
  });

  // 用户先改过自定义码率：探测结果晚到时不能覆盖用户输入
  it('用户改过的自定义码率不被异步探测覆盖', async () => {
    let resolveProbe: (info: IAssetAudioSourceInfo | undefined) => void = (): void => undefined;
    const pending = new Promise<IAssetAudioSourceInfo | undefined>((resolve) => {
      resolveProbe = resolve;
    });

    vi.mocked(probeAudioSource).mockReturnValue(pending);

    renderModal(AssetCategoryKind.Audio, false, nonEmptyLoadBytes);

    await waitFor((): void => {
      expect(probeAudioSource).toHaveBeenCalledTimes(1);
    });

    choosePreset('自定义参数');
    fireEvent.change(screen.getByTestId('asset-transcode-bitrate'), { target: { value: '64' } });

    expect(Number(inputValue('asset-transcode-bitrate'))).toBe(64);

    await act(async (): Promise<void> => resolveProbe({ bitrate: 192000 }));

    expect(Number(inputValue('asset-transcode-bitrate'))).toBe(64);
  });
});

describe('说明与保留提示', () => {
  // 取舍说明两种分类都显示
  it('图片与音频都显示取舍说明', () => {
    renderModal(AssetCategoryKind.Image, false);
    expect(screen.getByTestId('asset-transcode-quality-note').textContent).toContain('越小');

    cleanup();

    renderModal(AssetCategoryKind.Audio, false);
    expect(screen.getByTestId('asset-transcode-quality-note').textContent).toContain('越小');
  });

  // 像素风说明只在图片分类出现，并且明确提到「无损」
  it('像素风说明只在图片分类出现且提到无损', () => {
    renderModal(AssetCategoryKind.Image, false);

    expect(screen.getByTestId('asset-transcode-pixel-art-note').textContent).toContain('无损');

    cleanup();

    renderModal(AssetCategoryKind.Audio, false);

    expect(screen.queryByTestId('asset-transcode-pixel-art-note')).toBeNull();
  });

  // 取消勾选覆盖时才出现改名提示与当前选中文件的例子；勾选时两者都不出现
  it('不勾覆盖时显示改名提示与具体例子', () => {
    renderModal(AssetCategoryKind.Image, false);

    expect(screen.queryByTestId('asset-transcode-origin-hint')).toBeNull();
    expect(screen.queryByTestId('asset-transcode-origin-example')).toBeNull();

    fireEvent.click(screen.getByTestId('asset-transcode-cover'));

    expect(screen.getByTestId('asset-transcode-origin-hint').textContent).toContain('-origin');
    expect(screen.getByTestId('asset-transcode-origin-example').textContent).toContain('a-origin.png');
  });
});
