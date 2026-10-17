import { IAssetTranscodeService } from '../types';
import { canUseImageTranscode, transcodeImageToWebp } from './imageWebp';
import { AssetTranscodeKind } from './types';

// 浏览器侧的转码实现骨架：图片走 OffscreenCanvas 原生编码，音频等 03-15 接入真实依赖后再补。
// 实现不持有状态、也不在类里构造其它服务，面板只依赖 IAssetTranscodeService，测试可注入替身。

/** 音频转码尚未接入真实实现时的错误文案 */
const AUDIO_TRANSCODE_UNSUPPORTED_MESSAGE = '当前环境不支持音频转码';

export interface IBrowserAssetTranscodeService extends IAssetTranscodeService {}

export class BrowserAssetTranscodeService implements IBrowserAssetTranscodeService {
  /**
   * 探测当前环境能否执行指定种类的转码
   * @param kind 要探测的转码种类
   * @returns 该种类可转码时为 true
   */
  async canTranscode(kind: AssetTranscodeKind): Promise<boolean> {
    if (kind === AssetTranscodeKind.ImageWebp) return canUseImageTranscode();

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
   * 把音频字节转码为 WebM 容器中的 Opus；真实实现随音频依赖在 03-15 接入
   * @returns 转码后的 WebM 字节
   */
  async audioToWebmOpus(): Promise<Uint8Array> {
    throw new Error(AUDIO_TRANSCODE_UNSUPPORTED_MESSAGE);
  }
}
