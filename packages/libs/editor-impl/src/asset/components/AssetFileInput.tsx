import { Button } from 'antd';
import { ChangeEvent, ReactElement, useRef } from 'react';
import { ASSET_MAX_UPLOAD_BYTES } from '../constants';
import { IAssetUpload } from '../types';

export interface IAssetFileInputProps {
  /** 按钮上显示的文案 */
  readonly label: string;
  /** 文件选择框的扩展名过滤，如 `.png,.jpg`；缺省不限制 */
  readonly accept?: string;
  /** 用主按钮样式呈现 */
  readonly primary?: boolean;
  /** 不可操作时禁用按钮与选择框 */
  readonly disabled?: boolean;
  /** 按钮与选择框的测试标记基名（选择框追加 `-input`） */
  readonly testId: string;
  /**
   * 选中一个文件后回调其名字与字节
   * @param upload 上传的原始文件名与字节
   */
  onPick(upload: IAssetUpload): void;
  /**
   * 文件被拒绝时回调原因
   * @param reason 拒绝对用户显示的原因
   */
  onReject?(reason: string): void;
}

/**
 * 处理一次文件选择：把选中的文件读成字节交给上层；体积超限时在读取字节前拒绝
 * @param event 文件选择框的变更事件
 * @param props 组件的选择与拒绝回调
 */
async function handleFileChange(event: ChangeEvent<HTMLInputElement>, props: IAssetFileInputProps): Promise<void> {
  const files = event.target.files;
  const file = !files || files.length === 0 ? undefined : files[0];

  // 必须先取文件再清空：真实浏览器里置空 value 会让同一个 FileList 一起变空。
  // 清空仍然保留，允许再次选中同一个文件。
  event.target.value = '';
  if (file === undefined) return;

  if (file.size > ASSET_MAX_UPLOAD_BYTES) {
    if (props.onReject !== undefined) props.onReject('文件过大，单个素材不能超过 32 MiB');
    return;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  props.onPick({ name: file.name, bytes });
}

/**
 * 文件选择入口：隐藏的原生 `<input type="file">` 配一个文案按钮触发
 *
 * 只用标准的 `<input ref>` 模式，不触碰 `document`；字节经 `arrayBuffer` 读取，
 * 超限在读取前拦下并回调 `onReject`。
 * @param props 文件选择入口 props
 * @returns 按钮与隐藏选择框
 */
export function AssetFileInput(props: IAssetFileInputProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        size="small"
        type={props.primary ? 'primary' : 'default'}
        autoInsertSpace={false}
        disabled={props.disabled}
        data-test-id={props.testId}
        onClick={(): void => inputRef.current?.click()}
      >
        {props.label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={props.accept}
        style={{ display: 'none' }}
        data-test-id={`${props.testId}-input`}
        onChange={(event): void => {
          void handleFileChange(event, props);
        }}
      />
    </>
  );
}
