import { describe, expect, it } from 'vitest';
import { probeAudioSource } from '../audioOpus';
import { ASSET_DEFAULT_AUDIO_PRESET, ASSET_DEFAULT_IMAGE_PRESET, ASSET_IMAGE_PRESETS } from '../presets';
import {
  ASSET_DEFAULT_OPUS_BITRATE,
  ASSET_DEFAULT_OPUS_SAMPLE_RATE,
  ASSET_DEFAULT_WEBP_QUALITY,
  AssetAudioPreset,
  AssetImagePreset,
} from '../types';

describe('转码默认值', () => {
  // 覆盖图片转码默认品质按用户要求改为最高
  it('WebP 默认品质为 100', () => {
    expect(ASSET_DEFAULT_WEBP_QUALITY).toBe(100);
  });

  // 覆盖图片默认档为无损压缩，且该档质量与默认质量同为 100
  it('图片默认预设为无损压缩且质量为 100', () => {
    expect(ASSET_DEFAULT_IMAGE_PRESET).toBe(AssetImagePreset.Lossless);

    const preset = ASSET_IMAGE_PRESETS.find((item) => item.id === ASSET_DEFAULT_IMAGE_PRESET);

    expect(preset!.quality).toBe(100);
  });

  // 覆盖音频默认档为常规压缩（128 kbps + 48 kHz）
  it('音频默认预设为常规压缩', () => {
    expect(ASSET_DEFAULT_AUDIO_PRESET).toBe(AssetAudioPreset.Standard);
  });

  // 覆盖读不到源码率时的回退码率
  it('Opus 回退码率为 128000 bps', () => {
    expect(ASSET_DEFAULT_OPUS_BITRATE).toBe(128000);
  });

  // 覆盖读不到源采样率时的回退采样率
  it('Opus 回退采样率仍为 48000 Hz', () => {
    expect(ASSET_DEFAULT_OPUS_SAMPLE_RATE).toBe(48000);
  });
});

describe('源音频参数探测契约', () => {
  // 覆盖本计划的直通态：探测未接入时一律返回「读不到」
  it('probeAudioSource 直通返回 undefined', async () => {
    await expect(probeAudioSource(new Uint8Array([1, 2, 3]))).resolves.toBeUndefined();
  });
});
