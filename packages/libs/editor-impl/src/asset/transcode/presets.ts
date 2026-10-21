import { AssetAudioPreset, AssetImagePreset, IAssetAudioPresetOption, IAssetImagePresetOption } from './types';

// 转码预设档位、默认档与界面说明文案

/** 图片转码的三档固定预设（质量依次 80 / 92 / 100） */
export const ASSET_IMAGE_PRESETS: readonly IAssetImagePresetOption[] = [
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
];

/** 音频转码的三档固定预设（数值用 kbps / kHz 表达） */
export const ASSET_AUDIO_PRESETS: readonly IAssetAudioPresetOption[] = [
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
];

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
