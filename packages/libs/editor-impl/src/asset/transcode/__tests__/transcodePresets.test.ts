import { describe, expect, it } from 'vitest';
import { resolveAudioPresetOptions, resolveImagePresetQuality } from '../presets';
import { AssetAudioPreset, AssetImagePreset } from '../types';
import { bpsToKbps, hzToKHz, kbpsToBps, khzToHz } from '../units';

// 转码预设的两件事：界面单位（kbps / kHz）与内部契约（bps / Hz）之间的换算，以及档位到内部参数的解析。
// 内部契约一个字不改，换算只在界面边界发生。

describe('界面单位换算', () => {
  // 44.1 kHz 必须得到 44100 Hz，不能因浮点误差变成 44099
  it('kHz 换算成 Hz 时四舍五入到整数', () => {
    expect(khzToHz(44.1)).toBe(44100);
    expect(khzToHz(48)).toBe(48000);
  });

  // 128 kbps 换算成 128000 bps，界面上的数字不会带着三个 0 出现
  it('kbps 换算成 bps', () => {
    expect(kbpsToBps(128)).toBe(128000);
  });

  // 反向换算供探测结果预填自定义输入框
  it('bps / Hz 反向换算成 kbps / kHz', () => {
    expect(bpsToKbps(192000)).toBe(192);
    expect(hzToKHz(16000)).toBe(16);
  });

  // 非法输入一律按 0 处理，保证界面不出现 NaN
  it('非有限值与负数一律按 0 处理', () => {
    expect(kbpsToBps(Number.NaN)).toBe(0);
    expect(khzToHz(Number.POSITIVE_INFINITY)).toBe(0);
    expect(bpsToKbps(-1)).toBe(0);
    expect(hzToKHz(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe('档位解析', () => {
  // 图片三档依次解析成 80 / 92 / 100；自定义先四舍五入再夹到 0–100
  it('图片档位解析成 80 / 92 / 100，自定义夹在 0–100', () => {
    expect(resolveImagePresetQuality(AssetImagePreset.VolumeFirst, 100)).toBe(80);
    expect(resolveImagePresetQuality(AssetImagePreset.Standard, 100)).toBe(92);
    expect(resolveImagePresetQuality(AssetImagePreset.Lossless, 0)).toBe(100);

    expect(resolveImagePresetQuality(AssetImagePreset.Custom, 92.4)).toBe(92);
    expect(resolveImagePresetQuality(AssetImagePreset.Custom, -5)).toBe(0);
    expect(resolveImagePresetQuality(AssetImagePreset.Custom, 150)).toBe(100);
  });

  // 音频三档按 kbps / kHz 存储，解析时必须换算成内部契约的 bps / Hz
  it('音频三档解析成 64000 + 44100、92000 + 48000、128000 + 48000', () => {
    const custom = { bitrateKbps: 128, sampleRateKHz: 48 };

    expect(resolveAudioPresetOptions(AssetAudioPreset.SmallestSize, custom)).toEqual({
      bitrate: 64000,
      sampleRate: 44100,
    });
    expect(resolveAudioPresetOptions(AssetAudioPreset.VolumeFirst, custom)).toEqual({
      bitrate: 92000,
      sampleRate: 48000,
    });
    expect(resolveAudioPresetOptions(AssetAudioPreset.Standard, custom)).toEqual({
      bitrate: 128000,
      sampleRate: 48000,
    });
  });

  // 自定义档按 kbps / kHz 换算，44.1 kHz 得到 44100 Hz
  it('音频自定义档换算成 bps / Hz', () => {
    expect(resolveAudioPresetOptions(AssetAudioPreset.Custom, { bitrateKbps: 64, sampleRateKHz: 44.1 })).toEqual({
      bitrate: 64000,
      sampleRate: 44100,
    });
  });
});
