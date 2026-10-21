import { Button, Checkbox, InputNumber, Modal, Segmented, Spin } from 'antd';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { AssetCategoryKind } from '../../react';
import { resolveOriginPath } from '../model/assetPaths';
import { probeAudioSource } from '../transcode/audioOpus';
import {
  ASSET_AUDIO_PRESETS,
  ASSET_DEFAULT_AUDIO_PRESET,
  ASSET_DEFAULT_IMAGE_PRESET,
  ASSET_IMAGE_PRESETS,
  ASSET_TRANSCODE_CUSTOM_LABEL,
  ASSET_TRANSCODE_KEEP_ORIGIN_HINT,
  ASSET_TRANSCODE_PIXEL_ART_NOTE,
  ASSET_TRANSCODE_QUALITY_NOTE,
  resolveAudioPresetOptions,
  resolveImagePresetQuality,
} from '../transcode/presets';
import {
  ASSET_DEFAULT_OPUS_BITRATE,
  ASSET_DEFAULT_OPUS_SAMPLE_RATE,
  ASSET_DEFAULT_WEBP_QUALITY,
  ASSET_TRANSCODE_AUDIO_FORMAT_HINT,
  ASSET_TRANSCODE_BUSY_TEXT,
  ASSET_TRANSCODE_IMAGE_FORMAT_HINT,
  AssetAudioPreset,
  AssetImagePreset,
  IAssetTranscodeOptions,
} from '../transcode/types';
import { bpsToKbps, hzToKHz } from '../transcode/units';
import { IAssetEntry } from '../types';

// 瘦身转码弹窗：正文按「输出格式 / 素材选择 / 档位与说明 / 覆盖选项」分区，素材列表竖向排列并在过长时自己滚动；
// 只有「自定义参数」档才出现数字输入框，单位是 kbps / kHz；「覆盖旧文件」默认勾选并在覆盖前做破坏性二次确认；
// 不勾选覆盖时写明源文件会改名为 `-origin` 保留并给出当前选中文件的例子。

export interface ITranscodeModalProps {
  /** 是否打开弹窗 */
  readonly open: boolean;
  /** 当前分类的大分类，决定参数区 */
  readonly kind: AssetCategoryKind;
  /** 当前分类下可选的素材条目 */
  readonly entries: readonly IAssetEntry[];
  /** 是否正在批量转码 */
  readonly busy: boolean;
  /**
   * 按素材字节路径读字节，供探测源音频参数使用
   * @param path 素材字节文件路径
   * @returns 字节；读取失败时为 undefined
   */
  loadBytes(path: string): Promise<Uint8Array | undefined>;
  /** 取消并关闭弹窗 */
  onCancel(): void;
  /**
   * 开始批量转码
   * @param names 选中的素材名
   * @param options 转码参数
   */
  onStart(names: readonly string[], options: IAssetTranscodeOptions): void;
}

/**
 * 取图片档位用人话写的实际参数
 * @param preset 当前选中的图片档位
 * @param customQuality 自定义档填写的质量
 * @returns 例如「WebP 质量 100」；档位不在预设表里时为空串
 */
function imageEffectiveText(preset: AssetImagePreset, customQuality: number): string {
  if (preset === AssetImagePreset.Custom) return `WebP 质量 ${customQuality}`;

  const option = ASSET_IMAGE_PRESETS.find((item) => item.id === preset);

  return option === undefined ? '' : option.summary;
}

/**
 * 取音频档位用人话写的实际参数
 * @param preset 当前选中的音频档位
 * @param customBitrateKbps 自定义档填写的码率（kbps）
 * @param customSampleRateKHz 自定义档填写的采样率（kHz）
 * @returns 例如「128 kbps + 48 kHz」；档位不在预设表里时为空串
 */
function audioEffectiveText(preset: AssetAudioPreset, customBitrateKbps: number, customSampleRateKHz: number): string {
  if (preset === AssetAudioPreset.Custom) return `${customBitrateKbps} kbps + ${customSampleRateKHz} kHz`;

  const option = ASSET_AUDIO_PRESETS.find((item) => item.id === preset);

  if (option === undefined) return '';

  return `${option.bitrateKbps} kbps + ${option.sampleRateKHz} kHz`;
}

/**
 * 瘦身转码弹窗：素材多选 + 档位预设 + 自定义参数 + 说明文案 + 覆盖勾选（默认勾选）+ 破坏性二次确认 + 进度
 * @param props 弹窗 props
 * @returns 转码弹窗元素
 */
export function TranscodeModal(props: ITranscodeModalProps): ReactElement {
  const names = props.entries.map((entry) => entry.name);
  const selectedState = useState<readonly string[]>(() => [...names]);
  const selected = selectedState[0];
  const setSelected = selectedState[1];

  const imagePresetState = useState<AssetImagePreset>(ASSET_DEFAULT_IMAGE_PRESET);
  const customQualityState = useState(ASSET_DEFAULT_WEBP_QUALITY);
  const audioPresetState = useState<AssetAudioPreset>(ASSET_DEFAULT_AUDIO_PRESET);
  const customBitrateState = useState(bpsToKbps(ASSET_DEFAULT_OPUS_BITRATE));
  const customSampleRateState = useState(hzToKHz(ASSET_DEFAULT_OPUS_SAMPLE_RATE));
  const coverState = useState(true);
  const confirmingState = useState(false);
  const bitrateTouchedRef = useRef(false);
  const sampleRateTouchedRef = useRef(false);
  const loadBytesRef = useRef(props.loadBytes);
  loadBytesRef.current = props.loadBytes;

  const imagePreset = imagePresetState[0];
  const setImagePreset = imagePresetState[1];
  const customQuality = customQualityState[0];
  const setCustomQuality = customQualityState[1];
  const audioPreset = audioPresetState[0];
  const setAudioPreset = audioPresetState[1];
  const customBitrate = customBitrateState[0];
  const setCustomBitrate = customBitrateState[1];
  const customSampleRate = customSampleRateState[0];
  const setCustomSampleRate = customSampleRateState[1];
  const cover = coverState[0];
  const setCover = coverState[1];
  const confirming = confirmingState[0];
  const setConfirming = confirmingState[1];

  const isImage = props.kind === AssetCategoryKind.Image;
  const imagePresetOptions = [
    ...ASSET_IMAGE_PRESETS.map((item) => ({ label: item.label, value: item.id })),
    { label: ASSET_TRANSCODE_CUSTOM_LABEL, value: AssetImagePreset.Custom },
  ];
  const audioPresetOptions = [
    ...ASSET_AUDIO_PRESETS.map((item) => ({ label: item.label, value: item.id })),
    { label: ASSET_TRANSCODE_CUSTOM_LABEL, value: AssetAudioPreset.Custom },
  ];
  const effectiveText = isImage
    ? imageEffectiveText(imagePreset, customQuality)
    : audioEffectiveText(audioPreset, customBitrate, customSampleRate);
  const showQualityInput = isImage && imagePreset === AssetImagePreset.Custom;
  const showAudioInputs = !isImage && audioPreset === AssetAudioPreset.Custom;

  const firstSelected = props.entries.find((entry) => selected.includes(entry.name));
  const probePath = !isImage && firstSelected !== undefined ? firstSelected.path : undefined;

  useEffect((): (() => void) => {
    if (probePath === undefined) return (): void => undefined;

    let cancelled = false;

    Promise.resolve()
      .then(() => loadBytesRef.current(probePath))
      .then((bytes) => {
        if (bytes === undefined || cancelled) return undefined;

        return probeAudioSource(bytes);
      })
      .then((info) => {
        if (info === undefined || cancelled) return;

        if (!bitrateTouchedRef.current && info.bitrate !== undefined) {
          customBitrateState[1](bpsToKbps(info.bitrate));
        }
        if (!sampleRateTouchedRef.current && info.sampleRate !== undefined) {
          customSampleRateState[1](hzToKHz(info.sampleRate));
        }
      })
      .catch(() => undefined);

    return (): void => {
      cancelled = true;
    };
  }, [probePath]);

  const toggleItem = (name: string): void => {
    setSelected(selected.includes(name) ? selected.filter((member) => member !== name) : [...selected, name]);
  };

  const start = (): void => {
    const audioOptions = resolveAudioPresetOptions(audioPreset, {
      bitrateKbps: customBitrate,
      sampleRateKHz: customSampleRate,
    });

    props.onStart(selected, {
      quality: resolveImagePresetQuality(imagePreset, customQuality),
      bitrate: audioOptions.bitrate,
      sampleRate: audioOptions.sampleRate,
      coverOrigin: cover,
    });
  };

  const handleStart = (): void => {
    if (cover) setConfirming(true);
    else start();
  };

  return (
    <>
      <Modal
        open={props.open}
        title="瘦身转码"
        width={720}
        closable={!props.busy}
        maskClosable={!props.busy}
        onCancel={props.onCancel}
        footer={
          <div className="asset-transcode-footer">
            <Button
              size="small"
              autoInsertSpace={false}
              disabled={props.busy}
              data-test-id="asset-transcode-cancel"
              onClick={props.onCancel}
            >
              取消
            </Button>
            <Button
              size="small"
              type="primary"
              autoInsertSpace={false}
              disabled={selected.length === 0 || props.busy}
              data-test-id="asset-transcode-start"
              onClick={handleStart}
            >
              开始转换
            </Button>
          </div>
        }
      >
        <div className="asset-transcode-body">
          <div className="asset-transcode-section">
            <div className="asset-transcode-format" data-test-id="asset-transcode-format">
              {isImage ? ASSET_TRANSCODE_IMAGE_FORMAT_HINT : ASSET_TRANSCODE_AUDIO_FORMAT_HINT}
            </div>
          </div>
          <div className="asset-transcode-section">
            <div className="asset-transcode-select-actions">
              <Button
                size="small"
                autoInsertSpace={false}
                data-test-id="asset-transcode-select-all"
                onClick={(): void => setSelected([...names])}
              >
                全选
              </Button>
              <Button
                size="small"
                autoInsertSpace={false}
                data-test-id="asset-transcode-select-none"
                onClick={(): void => setSelected([])}
              >
                全不选
              </Button>
            </div>
            {names.length === 0 ? (
              <div className="asset-transcode-empty" data-test-id="asset-transcode-empty">
                当前分类下没有可转码的素材。
              </div>
            ) : (
              <div className="asset-transcode-list" data-test-id="asset-transcode-list">
                {names.map((name) => (
                  <label key={name} className="asset-transcode-item">
                    <Checkbox
                      checked={selected.includes(name)}
                      data-test-id={`asset-transcode-item-${name}`}
                      onChange={(): void => toggleItem(name)}
                    />
                    <span className="asset-transcode-name" title={name}>
                      {name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="asset-transcode-section">
            <div className="asset-transcode-preset">
              {isImage ? (
                <Segmented<AssetImagePreset>
                  data-test-id="asset-transcode-image-preset"
                  value={imagePreset}
                  options={imagePresetOptions}
                  onChange={setImagePreset}
                />
              ) : (
                <Segmented<AssetAudioPreset>
                  data-test-id="asset-transcode-audio-preset"
                  value={audioPreset}
                  options={audioPresetOptions}
                  onChange={setAudioPreset}
                />
              )}
            </div>
            <div className="asset-transcode-effective" data-test-id="asset-transcode-effective">
              {effectiveText}
            </div>
            {showQualityInput ? (
              <div className="asset-transcode-params">
                <label className="asset-transcode-param">
                  <span>WebP 质量</span>
                  <InputNumber
                    min={0}
                    max={100}
                    value={customQuality}
                    data-test-id="asset-transcode-quality"
                    onChange={(value): void => setCustomQuality(value ?? ASSET_DEFAULT_WEBP_QUALITY)}
                  />
                </label>
              </div>
            ) : null}
            {showAudioInputs ? (
              <div className="asset-transcode-params">
                <label className="asset-transcode-param">
                  <span>码率</span>
                  <InputNumber
                    min={1}
                    addonAfter="kbps"
                    value={customBitrate}
                    data-test-id="asset-transcode-bitrate"
                    onChange={(value): void => {
                      bitrateTouchedRef.current = true;
                      setCustomBitrate(value ?? bpsToKbps(ASSET_DEFAULT_OPUS_BITRATE));
                    }}
                  />
                </label>
                <label className="asset-transcode-param">
                  <span>采样率</span>
                  <InputNumber
                    min={1}
                    step={0.1}
                    precision={1}
                    addonAfter="kHz"
                    value={customSampleRate}
                    data-test-id="asset-transcode-sample-rate"
                    onChange={(value): void => {
                      sampleRateTouchedRef.current = true;
                      setCustomSampleRate(value ?? hzToKHz(ASSET_DEFAULT_OPUS_SAMPLE_RATE));
                    }}
                  />
                </label>
              </div>
            ) : null}
            <div className="asset-transcode-note" data-test-id="asset-transcode-quality-note">
              {ASSET_TRANSCODE_QUALITY_NOTE}
            </div>
            {isImage ? (
              <div className="asset-transcode-note" data-test-id="asset-transcode-pixel-art-note">
                {ASSET_TRANSCODE_PIXEL_ART_NOTE}
              </div>
            ) : null}
          </div>
          <div className="asset-transcode-section">
            <label className="asset-transcode-cover">
              <Checkbox
                checked={cover}
                data-test-id="asset-transcode-cover"
                onChange={(event): void => setCover(event.target.checked)}
              />
              <span>覆盖旧文件</span>
            </label>
            {cover ? null : (
              <div className="asset-transcode-note" data-test-id="asset-transcode-origin-hint">
                {ASSET_TRANSCODE_KEEP_ORIGIN_HINT}
              </div>
            )}
            {cover || firstSelected === undefined ? null : (
              <div className="asset-transcode-note" data-test-id="asset-transcode-origin-example">
                例如 {firstSelected.path} → {resolveOriginPath(firstSelected.path)}
              </div>
            )}
          </div>
          {props.busy ? (
            <div className="asset-transcode-section asset-transcode-busy" data-test-id="asset-transcode-busy">
              <Spin size="small" />
              <span>{ASSET_TRANSCODE_BUSY_TEXT}</span>
            </div>
          ) : null}
        </div>
      </Modal>
      {confirming ? (
        <Modal
          open
          title="覆盖旧文件？"
          closable={false}
          maskClosable={false}
          keyboard={false}
          onCancel={(): void => setConfirming(false)}
          footer={
            <div className="asset-transcode-confirm-footer">
              <Button
                size="small"
                autoInsertSpace={false}
                data-test-id="asset-transcode-confirm-cancel"
                onClick={(): void => setConfirming(false)}
              >
                取消
              </Button>
              <Button
                size="small"
                type="primary"
                danger
                autoInsertSpace={false}
                data-test-id="asset-transcode-confirm"
                onClick={(): void => {
                  setConfirming(false);
                  start();
                }}
              >
                开始转换
              </Button>
            </div>
          }
        >
          原文件将被替换，无法找回。
        </Modal>
      ) : null}
    </>
  );
}
