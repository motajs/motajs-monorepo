import { IAssetTranscodeService } from '../types';
import { canUseAudioTranscode, transcodeAudioToWebmOpus } from './audioOpus';
import { canUseImageTranscode, transcodeImageToWebp } from './imageWebp';
import { AssetTranscodeKind, IAssetAudioTranscodeOptions } from './types';

// 浏览器侧的转码实现：图片走 OffscreenCanvas 原生编码，音频走 Mediabunny 的 WebM/Opus 转码；
// 实现不持有状态、也不在类里构造其它服务，面板只依赖 IAssetTranscodeService，测试可注入替身。

export interface IBrowserAssetTranscodeService extends IAssetTranscodeService {}

export class BrowserAssetTranscodeService implements IBrowserAssetTranscodeService {
  /**
   * 探测当前环境能否执行指定种类的转码
   * @param kind 要探测的转码种类
   * @returns 该种类可转码时为 true
   */
  async canTranscode(kind: AssetTranscodeKind): Promise<boolean> {
    if (kind === AssetTranscodeKind.ImageWebp) return canUseImageTranscode();
    if (kind === AssetTranscodeKind.AudioOpus) return canUseAudioTranscode();

    return false;
  }

  /**
   * 把图片字节转码为 WebP
   * @param bytes 原始图片字节
   * @param quality WebP 质量（0–100）
   * @returns 转码后的 WebP 字节
   */
  imageToWebp(bytes: Uint8Array, quality: number): Promise<Uint8Array> {
    return transcodeImageToWebp(bytes, quality);
  }

  /**
   * 把音频字节转码为 WebM 容器中的 Opus
   * @param bytes 原始音频字节
   * @param options 音频转码参数（码率 / 采样率）
   * @returns 转码后的 WebM 字节
   */
  audioToWebmOpus(bytes: Uint8Array, options: IAssetAudioTranscodeOptions): Promise<Uint8Array> {
    return transcodeAudioToWebmOpus(bytes, options);
  }
}
