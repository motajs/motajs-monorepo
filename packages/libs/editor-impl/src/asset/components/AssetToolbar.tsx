import { Button, Slider, Space } from 'antd';
import { ReactElement } from 'react';
import { ASSET_CARD_MAX_WIDTH, ASSET_CARD_MIN_WIDTH, ASSET_CARD_WIDTH_STEP } from '../constants';
import { IAssetUpload } from '../types';
import { AssetFileInput } from './AssetFileInput';

export interface IAssetToolbarProps {
  /** 左侧显示的当前分类名 */
  readonly title: string;
  /** 当前卡片框宽度（px），由面板视图持有 */
  readonly cardWidth: number;
  /** 是否存在尚未落盘的改动 */
  readonly unsaved: boolean;
  /** 加载中等不可操作时禁用保存与新增 */
  readonly disabled: boolean;
  /** 当前分类能否转码；为 false 时禁用「瘦身转码」 */
  readonly transcodeEnabled: boolean;
  /** 新增素材时可选的扩展名过滤，如 `.png,.jpg`；缺省不限制 */
  readonly addAccept?: string;
  /**
   * 图标大小滑块变化时回传新的卡片框宽度
   * @param width 新的卡片框宽度（px）
   */
  onCardWidthChange(width: number): void;
  /** 把未落盘的列表与配置改动写回 */
  onSave?(): void;
  /** 打开瘦身转码入口 */
  onTranscode?(): void;
  /**
   * 上传一个本地文件为当前分类新增素材
   * @param upload 上传的原始文件名与字节
   */
  onAddAsset?(upload: IAssetUpload): void;
  /**
   * 选中的文件被拒绝时向用户提示原因
   * @param reason 拒绝对用户显示的原因
   */
  onReject?(reason: string): void;
}

/**
 * 素材面板工具栏：左侧分类名，中间图标大小滑块，右侧保存 / 瘦身转码 / 新增素材
 * @param props 工具栏 props
 * @returns 工具栏元素
 */
export function AssetToolbar(props: IAssetToolbarProps): ReactElement {
  return (
    <div className="asset-toolbar" data-test-id="asset-toolbar">
      <span className="asset-toolbar-title" title={props.title}>
        {props.title}
      </span>
      <span className="asset-toolbar-size" data-test-id="asset-toolbar-card-size">
        <span className="asset-toolbar-size-label">图标大小</span>
        <Slider
          className="asset-toolbar-size-slider"
          min={ASSET_CARD_MIN_WIDTH}
          max={ASSET_CARD_MAX_WIDTH}
          step={ASSET_CARD_WIDTH_STEP}
          value={props.cardWidth}
          onChange={props.onCardWidthChange}
        />
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
        <AssetFileInput
          label="新增素材"
          primary
          testId="asset-toolbar-add"
          accept={props.addAccept}
          disabled={props.disabled}
          onPick={(upload): void => {
            props.onAddAsset?.(upload);
          }}
          onReject={props.onReject}
        />
      </Space>
    </div>
  );
}
