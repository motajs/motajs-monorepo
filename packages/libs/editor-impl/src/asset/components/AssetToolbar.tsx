import { Button, Space } from 'antd';
import { ReactElement } from 'react';

export interface IAssetToolbarProps {
  /** 左侧显示的当前分类名 */
  readonly title: string;
  /** 是否存在尚未落盘的改动 */
  readonly unsaved: boolean;
  /** 加载中等不可操作时禁用保存与新增 */
  readonly disabled: boolean;
  /** 当前分类能否转码；为 false 时禁用「瘦身转码」 */
  readonly transcodeEnabled: boolean;
  /** 把未落盘的列表与配置改动写回 */
  onSave?(): void;
  /** 打开瘦身转码入口 */
  onTranscode?(): void;
  /** 上传一个本地文件为当前分类新增素材 */
  onAddAsset?(): void;
}

/**
 * 素材面板工具栏：左侧分类名，右侧保存 / 瘦身转码 / 新增素材
 * @param props 工具栏 props
 * @returns 工具栏元素
 */
export function AssetToolbar(props: IAssetToolbarProps): ReactElement {
  return (
    <div className="asset-toolbar" data-test-id="asset-toolbar">
      <span className="asset-toolbar-title" title={props.title}>
        {props.title}
      </span>
      <Space size={8}>
        <Button
          size="small"
          autoInsertSpace={false}
          disabled={!props.transcodeEnabled}
          data-test-id="asset-toolbar-transcode"
          onClick={props.onTranscode}
        >
          瘦身转码
        </Button>
        <Button
          size="small"
          autoInsertSpace={false}
          disabled={!props.unsaved || props.disabled}
          data-test-id="asset-toolbar-save"
          onClick={props.onSave}
        >
          保存
        </Button>
        <Button
          size="small"
          type="primary"
          autoInsertSpace={false}
          disabled={props.disabled}
          data-test-id="asset-toolbar-add"
          onClick={props.onAddAsset}
        >
          新增素材
        </Button>
      </Space>
    </div>
  );
}
