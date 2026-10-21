export const enum AssetTranscodeKind {
  /** 图片转 WebP */
  ImageWebp,
  /** 音频转 WebM 容器中的 Opus */
  AudioOpus,
}

export const enum AssetImagePreset {
  /** 体积优先档，质量 80 */
  VolumeFirst,
  /** 常规压缩档，质量 92 */
  Standard,
  /** 无损压缩档，质量 100 */
  Lossless,
  /** 自定义参数档 */
  Custom,
}

export const enum AssetAudioPreset {
  /** 最小体积档，64 kbps + 44.1 kHz */
  SmallestSize,
  /** 体积优先档，92 kbps + 48 kHz */
  VolumeFirst,
  /** 常规压缩档，128 kbps + 48 kHz */
  Standard,
  /** 自定义参数档 */
  Custom,
}

export interface IAssetImagePresetOption {
  /** 预设档位标识 */
  readonly id: AssetImagePreset;
  /** 档位显示名，如「无损压缩 100」 */
  readonly label: string;
  /** WebP 质量（0–100） */
  readonly quality: number;
  /** 给人看的一句说明，如「WebP 质量 100」 */
  readonly summary: string;
}

export interface IAssetAudioPresetOption {
  /** 预设档位标识 */
  readonly id: AssetAudioPreset;
  /** 档位显示名，如「常规压缩 128 kbps + 48 kHz」 */
  readonly label: string;
  /** Opus 目标码率（kbps） */
  readonly bitrateKbps: number;
  /** Opus 目标采样率（kHz） */
  readonly sampleRateKHz: number;
  /** 给人看的一句说明，与档位显示名同文案 */
  readonly summary: string;
}

export interface IAssetAudioCustomOptions {
  /** 自定义档的 Opus 目标码率（kbps） */
  readonly bitrateKbps: number;
  /** 自定义档的 Opus 目标采样率（kHz） */
  readonly sampleRateKHz: number;
}

export interface IAssetAudioTranscodeOptions {
  /** Opus 目标码率（bps） */
  readonly bitrate: number;
  /** Opus 目标采样率（Hz） */
  readonly sampleRate: number;
}

export interface IAssetAudioSourceInfo {
  /** 源音频采样率（Hz）；读不到时为 undefined */
  readonly sampleRate?: number;
  /** 源音频码率（bps）；读不到时为 undefined */
  readonly bitrate?: number;
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

/** 转码失败但没有给出原因时的兜底文案 */
export const ASSET_TRANSCODE_UNKNOWN_ERROR = '未知错误';

/** WebP 质量默认值（0–100），图片转码默认取最高品质 */
export const ASSET_DEFAULT_WEBP_QUALITY = 100;

/** Opus 码率回退值（bps），读不到源音频码率时使用 */
export const ASSET_DEFAULT_OPUS_BITRATE = 128000;

/** Opus 采样率回退值（Hz），读不到源音频采样率时使用 */
export const ASSET_DEFAULT_OPUS_SAMPLE_RATE = 48000;

/** 图片转码前的输出格式说明 */
export const ASSET_TRANSCODE_IMAGE_FORMAT_HINT = '输出格式：WebP（.webp）';

/** 音频转码前的输出格式说明 */
export const ASSET_TRANSCODE_AUDIO_FORMAT_HINT = '输出格式：WebM 容器中的 Opus（.webm）';

/** 转码进行中在弹窗上显示的状态文案 */
export const ASSET_TRANSCODE_BUSY_TEXT = '正在转码…';
