export const enum AssetTranscodeKind {
  /** 图片转 WebP */
  ImageWebp,
  /** 音频转 WebM 容器中的 Opus */
  AudioOpus,
}

export interface IAssetAudioTranscodeOptions {
  /** Opus 目标码率（bps） */
  readonly bitrate: number;
  /** Opus 目标采样率（Hz） */
  readonly sampleRate: number;
}

export interface IAssetTranscodeOptions {
  /** WebP 质量（0–100） */
  readonly quality: number;
  /** Opus 目标码率（bps） */
  readonly bitrate: number;
  /** Opus 目标采样率（Hz） */
  readonly sampleRate: number;
  /** 是否覆盖旧文件；不覆盖时旧文件按 origin 后缀改名保留 */
  readonly coverOrigin: boolean;
}

export interface IAssetTranscodeItemResult {
  /** 被转码的素材名 */
  readonly name: string;
  /** 该项是否转码成功 */
  readonly ok: boolean;
  /** 失败原因；成功时为 undefined */
  readonly error?: string;
  /** 转码产物的资源路径；失败时为 undefined */
  readonly outputPath?: string;
}

export interface IAssetTranscodeSummary {
  /** 本次批量转码的素材总数 */
  readonly total: number;
  /** 转码成功的数量 */
  readonly succeeded: number;
  /** 转码失败（含未执行）的逐项结果 */
  readonly failed: readonly IAssetTranscodeItemResult[];
}

/** 图片转码后的文件扩展名 */
export const ASSET_WEBP_EXTENSION = '.webp';

/** 音频转码后的文件扩展名 */
export const ASSET_WEBM_EXTENSION = '.webm';

/** WebP 质量默认值（0–100） */
export const ASSET_DEFAULT_WEBP_QUALITY = 80;

/** Opus 码率默认值（bps） */
export const ASSET_DEFAULT_OPUS_BITRATE = 96000;

/** Opus 采样率默认值（Hz） */
export const ASSET_DEFAULT_OPUS_SAMPLE_RATE = 48000;
