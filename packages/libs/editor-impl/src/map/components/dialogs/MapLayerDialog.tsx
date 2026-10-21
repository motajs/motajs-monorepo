import { Button, Input, InputRef, Modal, Spin } from 'antd';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { validateLayerName } from '../../model/validation';

// 新增图层弹窗：默认名按「图层 {N}」生成，打开时聚焦并全选；校验与提交中的状态都收在本组件。
// 宿主执行加层后返回整份文档，弹窗只负责收集名字，真正的落库与当前层切换由面板完成。

export interface IMapLayerDialogProps {
  /** 是否打开弹窗 */
  readonly open: boolean;
  /** 当前地图的图层数量，用于生成默认名 */
  readonly layerCount: number;
  /** 现有图层名，用于重名校验 */
  readonly existingNames: readonly string[];
  /** 面板回填的宿主失败原因；没有失败时为 undefined */
  readonly error?: string;
  /**
   * 提交图层名；失败原因由面板回填到 error
   * @param layerName 用户填写的图层名
   */
  onSubmit(layerName: string): Promise<void>;
  /** 取消并关闭弹窗 */
  onCancel(): void;
}

/**
 * 新增图层弹窗：单个名称字段，打开时预填并全选默认名
 * @param props 弹窗 props
 * @returns 新增图层弹窗元素
 */
export function MapLayerDialog(props: IMapLayerDialogProps): ReactElement {
  const defaultName = `图层 ${props.layerCount + 1}`;
  const nameState = useState(defaultName);
  const errorState = useState<string | undefined>(undefined);
  const submittingState = useState(false);
  const name = nameState[0];
  const setName = nameState[1];
  const error = errorState[0];
  const setError = errorState[1];
  const submitting = submittingState[0];
  const setSubmitting = submittingState[1];
  const inputRef = useRef<InputRef | null>(null);

  useEffect((): (() => void) => {
    if (!props.open) return (): void => undefined;

    setName(defaultName);
    setError(undefined);
    setSubmitting(false);

    const timer = setTimeout((): void => {
      const input = inputRef.current;

      if (input === null) return;

      input.focus();
      input.select();
    }, 0);

    return (): void => clearTimeout(timer);
  }, [props.open, defaultName, setName, setError, setSubmitting]);

  const submit = async (): Promise<void> => {
    if (submitting) return;

    const message = validateLayerName(name, props.existingNames);

    setError(message ?? undefined);

    if (message !== null) return;

    setSubmitting(true);

    try {
      await props.onSubmit(name.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={props.open}
      title="新增图层"
      width={360}
      closable={!submitting}
      maskClosable={false}
      onCancel={props.onCancel}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button
            size="small"
            autoInsertSpace={false}
            disabled={submitting}
            data-test-id="map-layer-cancel"
            onClick={props.onCancel}
          >
            取消
          </Button>
          <Button
            size="small"
            type="primary"
            autoInsertSpace={false}
            disabled={submitting}
            data-test-id="map-layer-submit"
            onClick={(): void => {
              void submit();
            }}
          >
            创建图层
          </Button>
        </div>
      }
    >
      <div data-test-id="map-layer-dialog" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>图层名称</span>
          <Input
            ref={inputRef}
            value={name}
            data-test-id="map-layer-name"
            onChange={(event): void => setName(event.target.value)}
          />
          {error === undefined ? null : (
            <span data-test-id="map-layer-name-error" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {error}
            </span>
          )}
        </label>
        {props.error === undefined ? null : (
          <span data-test-id="map-layer-error" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {props.error}
          </span>
        )}
        {submitting ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} data-test-id="map-layer-submitting">
            <Spin size="small" />
            正在创建…
          </span>
        ) : null}
      </div>
    </Modal>
  );
}
