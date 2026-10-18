import { describe, expect, it } from 'vitest';
import { canUseAudioTranscode, transcodeAudioToWebmOpus } from '../audioOpus';
import { BrowserAssetTranscodeService } from '../browserTranscodeService';
import { AssetTranscodeKind } from '../types';

describe('音频转码能力探测', () => {
  // 覆盖 jsdom 缺少 WebCodecs 时的能力探测结果
  it('canUseAudioTranscode 在 jsdom 下返回 false', async () => {
    await expect(canUseAudioTranscode()).resolves.toBe(false);
  });

  // 覆盖不支持时转码以可读错误拒绝，而不是因缺少浏览器 API 崩溃
  it('transcodeAudioToWebmOpus 给出可读的不可用错误', async () => {
    await expect(
      transcodeAudioToWebmOpus(new Uint8Array([1, 2, 3]), { bitrate: 96000, sampleRate: 48000 }),
    ).rejects.toThrow('不支持音频转码');
  });
});

describe('BrowserAssetTranscodeService 音频探测', () => {
  const service = new BrowserAssetTranscodeService();

  // 覆盖服务对音频转码在 jsdom 下的不可用结果
  it('canTranscode 对音频转码返回 false', async () => {
    await expect(service.canTranscode(AssetTranscodeKind.AudioOpus)).resolves.toBe(false);
  });
});
