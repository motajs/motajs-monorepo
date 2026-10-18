import { describe, expect, it } from 'vitest';
import { IAssetTranscodeService } from '../../types';
import { BrowserAssetTranscodeService } from '../browserTranscodeService';
import { canUseImageTranscode, transcodeImageToWebp } from '../imageWebp';
import { AssetTranscodeKind } from '../types';

describe('图片转码能力探测', () => {
  // 覆盖 jsdom 缺少 OffscreenCanvas 与 createImageBitmap 时的能力探测结果
  it('canUseImageTranscode 在 jsdom 下返回 false', () => {
    expect(canUseImageTranscode()).toBe(false);
  });

  // 覆盖不支持时转码以可读错误拒绝，而不是因缺少浏览器 API 崩溃
  it('transcodeImageToWebp 给出可读的不可用错误', async () => {
    await expect(transcodeImageToWebp(new Uint8Array([1, 2, 3]), 80)).rejects.toThrow('不支持图片转码');
  });
});

describe('BrowserAssetTranscodeService 能力探测', () => {
  const service: IAssetTranscodeService = new BrowserAssetTranscodeService();

  // 覆盖图片转码在 jsdom 下的不可用结果
  it('canTranscode 对图片转码返回 false', async () => {
    await expect(service.canTranscode(AssetTranscodeKind.ImageWebp)).resolves.toBe(false);
  });

  // 覆盖音频转码在 jsdom 下不可用：环境没有 WebCodecs，canEncode('opus') 返回 false
  it('canTranscode 对音频转码返回 false', async () => {
    await expect(service.canTranscode(AssetTranscodeKind.AudioOpus)).resolves.toBe(false);
  });

  // 覆盖音频转码动作以可读错误拒绝
  it('audioToWebmOpus 给出可读的不可用错误', async () => {
    await expect(service.audioToWebmOpus(new Uint8Array([1]), { bitrate: 96000, sampleRate: 48000 })).rejects.toThrow(
      '不支持音频转码',
    );
  });
});
