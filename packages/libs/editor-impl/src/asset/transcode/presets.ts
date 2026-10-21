import {
  ASSET_DEFAULT_OPUS_BITRATE,
  ASSET_DEFAULT_OPUS_SAMPLE_RATE,
  ASSET_DEFAULT_WEBP_QUALITY,
  AssetAudioPreset,
  AssetImagePreset,
  IAssetAudioCustomOptions,
  IAssetAudioPresetOption,
  IAssetAudioTranscodeOptions,
  IAssetImagePresetOption,
} from './types';
import { kbpsToBps, khzToHz } from './units';

// 转码预设档位、默认档、界面说明文案，以及「档位 → 内部转码参数」的唯一换算点

/** 图片转码的三档固定预设（质量依次 80 / 92 / 100） */
export const ASSET_IMAGE_PRESETS: readonly IAssetImagePresetOption[] = Object.freeze([
  {
    id: AssetImagePreset.VolumeFirst,
    label: '体积优先 80',
    quality: 80,
    summary: 'WebP 质量 80',
  },
  {
    id: AssetImagePreset.Standard,
    label: '常规压缩 92',
    quality: 92,
    summary: 'WebP 质量 92',
  },
  {
    id: AssetImagePreset.Lossless,
    label: '无损压缩 100',
    quality: 100,
    summary: 'WebP 质量 100',
  },
]);

/** 音频转码的三档固定预设（数值用 kbps / kHz 表达） */
export const ASSET_AUDIO_PRESETS: readonly IAssetAudioPresetOption[] = Object.freeze([
  {
    id: AssetAudioPreset.SmallestSize,
    label: '最小体积 64 kbps + 44.1 kHz',
    bitrateKbps: 64,
    sampleRateKHz: 44.1,
    summary: '最小体积 64 kbps + 44.1 kHz',
  },
  {
    id: AssetAudioPreset.VolumeFirst,
    label: '体积优先 92 kbps + 48 kHz',
    bitrateKbps: 92,
    sampleRateKHz: 48,
    summary: '体积优先 92 kbps + 48 kHz',
  },
  {
    id: AssetAudioPreset.Standard,
    label: '常规压缩 128 kbps + 48 kHz',
    bitrateKbps: 128,
    sampleRateKHz: 48,
    summary: '常规压缩 128 kbps + 48 kHz',
  },
]);

/** 图片转码默认档：像素风素材为主，默认走无损压缩，避免有损压缩发糊 */
export const ASSET_DEFAULT_IMAGE_PRESET = AssetImagePreset.Lossless;

/** 音频转码默认档：常规压缩 128 kbps + 48 kHz */
export const ASSET_DEFAULT_AUDIO_PRESET = AssetAudioPreset.Standard;

/** 第四个档位的显示名（图片与音频共用） */
export const ASSET_TRANSCODE_CUSTOM_LABEL = '自定义参数';

/** 转码弹窗的取舍说明 */
export const ASSET_TRANSCODE_QUALITY_NOTE = '质量 / 码率越低，文件越小，但图片会更模糊、声音会更差。';

/** 转码弹窗的像素风说明 */
export const ASSET_TRANSCODE_PIXEL_ART_NOTE =
  '像素风素材压缩后会明显发糊：素材图建议用「无损压缩」，常规非像素风图片用「常规压缩」通常够用。';

/** 不覆盖旧文件时的改名提示 */
export const ASSET_TRANSCODE_KEEP_ORIGIN_HINT =
  '不覆盖旧文件时，源文件会被重命名为「{name}-origin{.ext}」保留，不会被删除。';

/** WebP 质量下界 */
const MIN_WEBP_QUALITY = 0;

/** WebP 质量上界 */
const MAX_WEBP_QUALITY = 100;

/** 码率 / 采样率换算后的下界，避免把 0 交给转码器 */
const MIN_AUDIO_VALUE = 1;

/**
 * 把质量四舍五入并夹到 0–100
 * @param quality 原始质量
 * @returns 夹紧后的整数质量；非有限值按 0 处理
 */
function clampWebpQuality(quality: number): number {
  if (!Number.isFinite(quality)) return MIN_WEBP_QUALITY;

  return Math.min(MAX_WEBP_QUALITY, Math.max(MIN_WEBP_QUALITY, Math.round(quality)));
}

/**
 * 把图片档位换算成内部契约要的 WebP 质量
 * @param preset 当前选中的图片档位
 * @param customQuality 自定义档填写的质量，只有自定义档使用
 * @returns 0–100 的质量；档位不在预设表里时回落到默认质量
 */
export function resolveImagePresetQuality(preset: AssetImagePreset, customQuality: number): number {
  if (preset === AssetImagePreset.Custom) return clampWebpQuality(customQuality);

  const option = ASSET_IMAGE_PRESETS.find((item) => item.id === preset);

  return option === undefined ? ASSET_DEFAULT_WEBP_QUALITY : option.quality;
}

/**
 * 把音频档位换算成内部契约要的 bps / Hz
 * @param preset 当前选中的音频档位
 * @param custom 自定义档填写的 kbps / kHz，只有自定义档使用
 * @returns 内部转码契约的码率（bps）与采样率（Hz）；档位不在预设表里时回落到默认值
 */
export function resolveAudioPresetOptions(
  preset: AssetAudioPreset,
  custom: IAssetAudioCustomOptions,
): IAssetAudioTranscodeOptions {
  if (preset === AssetAudioPreset.Custom) {
    return {
      bitrate: Math.max(MIN_AUDIO_VALUE, kbpsToBps(custom.bitrateKbps)),
      sampleRate: Math.max(MIN_AUDIO_VALUE, khzToHz(custom.sampleRateKHz)),
    };
  }

  const option = ASSET_AUDIO_PRESETS.find((item) => item.id === preset);

  if (option === undefined) {
    return { bitrate: ASSET_DEFAULT_OPUS_BITRATE, sampleRate: ASSET_DEFAULT_OPUS_SAMPLE_RATE };
  }

  return { bitrate: kbpsToBps(option.bitrateKbps), sampleRate: khzToHz(option.sampleRateKHz) };
}
