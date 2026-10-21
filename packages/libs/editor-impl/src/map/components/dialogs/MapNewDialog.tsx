import { Button, Input, InputNumber, Modal, Spin } from 'antd';
import { ReactElement, useEffect, useState } from 'react';
import { MAP_DEFAULT_HEIGHT, MAP_DEFAULT_LAYER_NAME, MAP_DEFAULT_WIDTH } from '../../constants';
import { validateLayerName, validateMapName, validateMapSize } from '../../model/validation';
import { IMapCreateRequest, IMapSizeLimit } from '../../types';

// 新建地图弹窗：字段默认值、行内校验、创建中禁用与宿主失败原因都收在本组件。
// 开关由调用方给的 open 控制；提交中的忙碌状态是弹窗本地状态，面板只负责真正创建并回填错误。

export interface IMapNewDialogProps {
  /** 是否打开弹窗 */
  readonly open: boolean;
  /** 宿主给出的尺寸上限；缺省表示不限制 */
  readonly maxSize?: IMapSizeLimit;
  /** 现有地图名，用于重名校验 */
  readonly existingNames: readonly string[];
  /** 面板回填的宿主失败原因；没有失败时为 undefined */
  readonly error?: string;
  /**
   * 提交创建请求；失败原因由面板回填到 error
   * @param request 名称、尺寸与初始图层名
   */
  onSubmit(request: IMapCreateRequest): Promise<void>;
  /** 取消并关闭弹窗 */
  onCancel(): void;
}

/**
 * 新建地图弹窗：名称、宽高与初始图层名，提交时做行内校验
 * @param props 弹窗 props
 * @returns 新建地图弹窗元素
 */
export function MapNewDialog(props: IMapNewDialogProps): ReactElement {
  const nameState = useState('');
  const widthState = useState<number | null>(MAP_DEFAULT_WIDTH);
  const heightState = useState<number | null>(MAP_DEFAULT_HEIGHT);
  const layerNameState = useState(MAP_DEFAULT_LAYER_NAME);
  const nameErrorState = useState<string | undefined>(undefined);
  const sizeErrorState = useState<string | undefined>(undefined);
  const layerErrorState = useState<string | undefined>(undefined);
  const submittingState = useState(false);
  const name = nameState[0];
  const setName = nameState[1];
  const width = widthState[0];
  const setWidth = widthState[1];
  const height = heightState[0];
  const setHeight = heightState[1];
  const layerName = layerNameState[0];
  const setLayerName = layerNameState[1];
  const nameError = nameErrorState[0];
  const setNameError = nameErrorState[1];
  const sizeError = sizeErrorState[0];
  const setSizeError = sizeErrorState[1];
  const layerError = layerErrorState[0];
  const setLayerError = layerErrorState[1];
  const submitting = submittingState[0];
  const setSubmitting = submittingState[1];
  const maxSize = props.maxSize;
  const limitText = maxSize === undefined ? '' : `最大 ${maxSize.maxWidth} × ${maxSize.maxHeight}。`;

  useEffect((): void => {
    if (!props.open) return;

    setName('');
    setWidth(MAP_DEFAULT_WIDTH);
    setHeight(MAP_DEFAULT_HEIGHT);
    setLayerName(MAP_DEFAULT_LAYER_NAME);
    setNameError(undefined);
    setSizeError(undefined);
    setLayerError(undefined);
    setSubmitting(false);
  }, [
    props.open,
    setName,
    setWidth,
    setHeight,
    setLayerName,
    setNameError,
    setSizeError,
    setLayerError,
    setSubmitting,
  ]);

  const submit = async (): Promise<void> => {
    if (submitting) return;

    const nameMessage = validateMapName(name, props.existingNames);
    const sizeMessage = validateMapSize({ width: width ?? 0, height: height ?? 0 }, maxSize);
    const layerMessage = validateLayerName(layerName, []);

    setNameError(nameMessage ?? undefined);
    setSizeError(sizeMessage ?? undefined);
    setLayerError(layerMessage ?? undefined);

    if (nameMessage !== null || sizeMessage !== null || layerMessage !== null) return;

    setSubmitting(true);

    try {
      await props.onSubmit({ name: name.trim(), width: width ?? 0, height: height ?? 0, layerName: layerName.trim() });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={props.open}
      title="新建地图"
      width={420}
      closable={!submitting}
      maskClosable={false}
      onCancel={props.onCancel}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button
            size="small"
            autoInsertSpace={false}
            disabled={submitting}
            data-test-id="map-new-cancel"
            onClick={props.onCancel}
          >
            取消
          </Button>
          <Button
            size="small"
            type="primary"
            autoInsertSpace={false}
            disabled={submitting}
            data-test-id="map-new-submit"
            onClick={(): void => {
              void submit();
            }}
          >
            创建地图
          </Button>
        </div>
      }
    >
      <div data-test-id="map-new-dialog" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>名称</span>
          <Input
            value={name}
            placeholder="例如：sample0"
            data-test-id="map-new-name"
            onChange={(event): void => setName(event.target.value)}
          />
          {nameError === undefined ? null : (
            <span data-test-id="map-new-name-error" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {nameError}
            </span>
          )}
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 4 }}>
            <span>宽度</span>
            <InputNumber
              min={1}
              max={maxSize?.maxWidth}
              value={width}
              data-test-id="map-new-width"
              onChange={(value): void => setWidth(value)}
            />
          </label>
          <label style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 4 }}>
            <span>高度</span>
            <InputNumber
              min={1}
              max={maxSize?.maxHeight}
              value={height}
              data-test-id="map-new-height"
              onChange={(value): void => setHeight(value)}
            />
          </label>
        </div>
        <span data-test-id="map-new-size-hint">宽高以格子为单位。{limitText}</span>
        {sizeError === undefined ? null : (
          <span data-test-id="map-new-size-error" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {sizeError}
          </span>
        )}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>初始图层名称</span>
          <Input
            value={layerName}
            data-test-id="map-new-layer"
            onChange={(event): void => setLayerName(event.target.value)}
          />
          {layerError === undefined ? null : (
            <span data-test-id="map-new-layer-error" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {layerError}
            </span>
          )}
        </label>
        {props.error === undefined ? null : (
          <span data-test-id="map-new-error" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {props.error}
          </span>
        )}
        {submitting ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} data-test-id="map-new-submitting">
            <Spin size="small" />
            正在创建…
          </span>
        ) : null}
      </div>
    </Modal>
  );
}
