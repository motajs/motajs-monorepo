import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  canEncode,
  Conversion,
  Input,
  Output,
  Quality,
  WebMOutputFormat,
} from 'mediabunny';
import { IAssetAudioTranscodeOptions } from './types';

// 音频转 WebM/Opus：经 Mediabunny 的公共 API 解码 / 编码 / 封装，全程本地执行、不发网络请求；
// 环境缺少 Opus 编码能力时先探测再抛可读错误，绝不静默产出空字节。

/** 环境缺少音频转码能力时的错误文案 */
const AUDIO_TRANSCODE_UNSUPPORTED_MESSAGE = '当前环境不支持音频转码';

/** 转码配置被判定不可用时的错误文案 */
const AUDIO_TRANSCODE_INVALID_MESSAGE = '无法转码：环境不支持 Opus';

/** 转码没有产出任何字节时的错误文案 */
const AUDIO_TRANSCODE_EMPTY_OUTPUT_MESSAGE = '无法转码：转码未产出数据';

/**
 * 判断当前环境能否把音频转码为 WebM 容器中的 Opus
 * @returns 环境支持 Opus 编码时为 true
 */
export async function canUseAudioTranscode(): Promise<boolean> {
  try {
    return await canEncode('opus');
  } catch {
    return false;
  }
}

/**
 * 把音频字节转码为 WebM 容器中的 Opus
 * @param bytes 原始音频字节
 * @param options 目标 Opus 的码率与采样率
 * @returns 转码后的 WebM 字节
 */
export async function transcodeAudioToWebmOpus(
  bytes: Uint8Array,
  options: IAssetAudioTranscodeOptions,
): Promise<Uint8Array> {
  if (!(await canUseAudioTranscode())) throw new Error(AUDIO_TRANSCODE_UNSUPPORTED_MESSAGE);

  const input = new Input({ source: new BlobSource(new Blob([bytes.slice()])), formats: ALL_FORMATS });
  const output = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() });
  const conversion = await Conversion.init({
    input,
    output,
    audio: {
      codec: 'opus',
      quality: new Quality({ bitrate: options.bitrate }),
      sampleRate: options.sampleRate,
    },
  });
  if (!conversion.isValid) throw new Error(AUDIO_TRANSCODE_INVALID_MESSAGE);

  await conversion.execute();

  const buffer = output.target.buffer;
  if (!buffer || buffer.byteLength === 0) throw new Error(AUDIO_TRANSCODE_EMPTY_OUTPUT_MESSAGE);

  return new Uint8Array(buffer);
}
