import { Button, Checkbox, InputNumber, Modal, Spin } from 'antd';
import { ReactElement, useState } from 'react';
import { AssetCategoryKind } from '../../react';
import {
  ASSET_DEFAULT_OPUS_BITRATE,
  ASSET_DEFAULT_OPUS_SAMPLE_RATE,
  ASSET_DEFAULT_WEBP_QUALITY,
  ASSET_TRANSCODE_AUDIO_FORMAT_HINT,
  ASSET_TRANSCODE_BUSY_TEXT,
  ASSET_TRANSCODE_IMAGE_FORMAT_HINT,
  IAssetTranscodeOptions,
} from '../transcode/types';

// 瘦身转码弹窗：正文按「输出格式 / 素材选择 / 参数 / 覆盖选项」分区，素材列表竖向排列并在过长时自己滚动；
// 「覆盖旧文件」默认勾选并在覆盖前做破坏性二次确认；转换进行中显示「正在转码…」并禁用开始与取消。

export interface ITranscodeModalProps {
  /** 是否打开弹窗 */
  readonly open: boolean;
  /** 当前分类的大分类，决定参数区 */
  readonly kind: AssetCategoryKind;
  /** 当前分类下可选的素材名 */
  readonly names: readonly string[];
  /** 是否正在批量转码 */
  readonly busy: boolean;
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
 * 瘦身转码弹窗：素材多选 + 分类参数 + 覆盖勾选（默认勾选）+ 破坏性二次确认 + 进度
 * @param props 弹窗 props
 * @returns 转码弹窗元素
 */
export function TranscodeModal(props: ITranscodeModalProps): ReactElement {
  const selectedState = useState<readonly string[]>(() => [...props.names]);
  const selected = selectedState[0];
  const setSelected = selectedState[1];

  const qualityState = useState(ASSET_DEFAULT_WEBP_QUALITY);
  const bitrateState = useState(ASSET_DEFAULT_OPUS_BITRATE);
  const sampleRateState = useState(ASSET_DEFAULT_OPUS_SAMPLE_RATE);
  const coverState = useState(true);
  const confirmingState = useState(false);

  const cover = coverState[0];
  const setCover = coverState[1];
  const confirming = confirmingState[0];
  const setConfirming = confirmingState[1];

  const toggleItem = (name: string): void => {
    setSelected(selected.includes(name) ? selected.filter((member) => member !== name) : [...selected, name]);
  };

  const start = (): void => {
    props.onStart(selected, {
      quality: qualityState[0],
      bitrate: bitrateState[0],
      sampleRate: sampleRateState[0],
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
              {props.kind === AssetCategoryKind.Image
                ? ASSET_TRANSCODE_IMAGE_FORMAT_HINT
                : ASSET_TRANSCODE_AUDIO_FORMAT_HINT}
            </div>
          </div>
          <div className="asset-transcode-section">
            <div className="asset-transcode-select-actions">
              <Button
                size="small"
                autoInsertSpace={false}
                data-test-id="asset-transcode-select-all"
                onClick={(): void => setSelected([...props.names])}
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
            {props.names.length === 0 ? (
              <div className="asset-transcode-empty" data-test-id="asset-transcode-empty">
                当前分类下没有可转码的素材。
              </div>
            ) : (
              <div className="asset-transcode-list" data-test-id="asset-transcode-list">
                {props.names.map((name) => (
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
            <div className="asset-transcode-params">
              {props.kind === AssetCategoryKind.Image ? (
                <label className="asset-transcode-param">
                  <span>WebP 质量</span>
                  <InputNumber
                    min={0}
                    max={100}
                    value={qualityState[0]}
                    data-test-id="asset-transcode-quality"
                    onChange={(value): void => qualityState[1](value ?? ASSET_DEFAULT_WEBP_QUALITY)}
                  />
                </label>
              ) : (
                <>
                  <label className="asset-transcode-param">
                    <span>码率</span>
                    <InputNumber
                      min={1}
                      addonAfter="bps"
                      value={bitrateState[0]}
                      data-test-id="asset-transcode-bitrate"
                      onChange={(value): void => bitrateState[1](value ?? ASSET_DEFAULT_OPUS_BITRATE)}
                    />
                  </label>
                  <label className="asset-transcode-param">
                    <span>采样率</span>
                    <InputNumber
                      min={1}
                      addonAfter="Hz"
                      value={sampleRateState[0]}
                      data-test-id="asset-transcode-sample-rate"
                      onChange={(value): void => sampleRateState[1](value ?? ASSET_DEFAULT_OPUS_SAMPLE_RATE)}
                    />
                  </label>
                </>
              )}
            </div>
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
