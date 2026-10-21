import { Button, Modal } from 'antd';
import { ReactElement, useState } from 'react';
import { AssetCategoryKind } from '../../react';
import {
  ASSET_DELETE_CONFIRM_TEXT,
  ASSET_UNREGISTER_CONFIRM_TEXT,
  ASSET_UNREGISTER_FINAL_CONFIRM_TEXT,
} from '../constants';
import { resolveKindFileExtensions } from '../model/internal/assetFileTypes';
import { IAssetEntry, IAssetUpload } from '../types';
import { AssetFileInfo } from './AssetFileInfo';
import { AssetFileInput } from './AssetFileInput';
import { AssetPreview } from './AssetPreview';

export interface IAssetDetailProps {
  /** 当前选中的素材；未选中时为 undefined */
  readonly entry?: IAssetEntry;
  /** 当前分类的大分类，决定预览形态 */
  readonly kind: AssetCategoryKind;
  /**
   * 用本地文件替换当前素材
   * @param upload 上传的原始文件名与字节
   */
  onReplace?(upload: IAssetUpload): void;
  /**
   * 选中的文件被拒绝时向用户提示原因
   * @param reason 拒绝对用户显示的原因
   */
  onReject?(reason: string): void;
  /** 删除当前素材 */
  onDelete?(): void;
  /** 打开当前素材的配置表单 */
  onOpenConfig?(): void;
  /** 把当前未登记素材登记进列表 */
  onRegister?(): void;
  /** 注销当前已登记素材（只改列表与配置，不删文件） */
  onUnregister?(): void;
  /**
   * 读取某素材字节，供预览使用
   * @param path 素材字节文件路径
   * @returns 字节；文件不存在或读取失败时为 undefined
   */
  loadBytes(path: string): Promise<Uint8Array | undefined>;
}

/**
 * 素材详情 / 预览栏：未选中给引导文案，选中后给名称 / 路径 / 缺失提示 / 预览 / 操作行
 *
 * 删除前弹 antd `Modal` 二次确认（破坏性按钮标 `danger`）；替换经 `AssetFileInput` 把
 * 上传的名字与字节交给上层；未登记素材给「注册到游戏」，已登记素材给「注销」并需连点两次确认；
 * 所有文本经 React 文本节点渲染。
 * @param props 详情 props
 * @returns 详情元素
 */
export function AssetDetail(props: IAssetDetailProps): ReactElement {
  const entry = props.entry;
  const confirmingState = useState(false);
  const confirming = confirmingState[0];
  const setConfirming = confirmingState[1];
  const unregisterStepState = useState<number>(0);
  const unregisterStep = unregisterStepState[0];
  const setUnregisterStep = unregisterStepState[1];

  if (entry === undefined) {
    return (
      <div className="asset-detail" data-test-id="asset-detail">
        <div className="asset-detail-empty" data-test-id="asset-detail-empty">
          选择一个素材查看详情
        </div>
      </div>
    );
  }

  return (
    <div className="asset-detail" data-test-id="asset-detail">
      <div className="asset-detail-title">{entry.name}</div>
      <div className="asset-detail-path" title={entry.path}>
        {entry.path}
      </div>
      {entry.exists ? (
        <AssetFileInfo
          key={entry.path}
          kind={props.kind}
          path={entry.path}
          byteVersion={entry.byteVersion ?? 0}
          loadBytes={props.loadBytes}
        />
      ) : null}
      {entry.exists ? null : (
        <div className="asset-detail-hint" data-test-id="asset-detail-missing">
          文件已登记，但工程目录中不存在。
        </div>
      )}
      <div className="asset-detail-preview">
        <AssetPreview
          key={entry.path}
          kind={props.kind}
          path={entry.path}
          byteVersion={entry.byteVersion ?? 0}
          loadBytes={(): Promise<Uint8Array | undefined> => props.loadBytes(entry.path)}
        />
      </div>
      <div className="asset-detail-actions">
        <AssetFileInput
          label="替换"
          testId="asset-detail-replace"
          accept={resolveKindFileExtensions(props.kind).join(',')}
          onPick={(upload): void => {
            props.onReplace?.(upload);
          }}
          onReject={props.onReject}
        />
        <Button
          size="small"
          autoInsertSpace={false}
          data-test-id="asset-detail-delete"
          onClick={(): void => setConfirming(true)}
        >
          删除
        </Button>
        {entry.registered ? (
          <Button size="small" autoInsertSpace={false} data-test-id="asset-detail-config" onClick={props.onOpenConfig}>
            配置
          </Button>
        ) : null}
        {entry.registered ? (
          <Button
            size="small"
            autoInsertSpace={false}
            data-test-id="asset-detail-unregister"
            onClick={(): void => setUnregisterStep(1)}
          >
            注销
          </Button>
        ) : (
          <Button
            size="small"
            autoInsertSpace={false}
            data-test-id="asset-detail-register"
            onClick={(): void => props.onRegister?.()}
          >
            注册到游戏
          </Button>
        )}
      </div>
      {unregisterStep === 1 ? (
        <Modal
          open
          title="注销素材"
          closable={false}
          maskClosable={false}
          keyboard={false}
          onCancel={(): void => setUnregisterStep(0)}
          footer={
            <div className="asset-detail-delete-footer">
              <Button
                size="small"
                autoInsertSpace={false}
                data-test-id="asset-unregister-cancel"
                onClick={(): void => setUnregisterStep(0)}
              >
                取消
              </Button>
              <Button
                size="small"
                type="primary"
                autoInsertSpace={false}
                data-test-id="asset-unregister-next"
                onClick={(): void => setUnregisterStep(2)}
              >
                继续
              </Button>
            </div>
          }
        >
          {ASSET_UNREGISTER_CONFIRM_TEXT}
        </Modal>
      ) : null}
      {unregisterStep === 2 ? (
        <Modal
          open
          title="再次确认注销"
          closable={false}
          maskClosable={false}
          keyboard={false}
          onCancel={(): void => setUnregisterStep(0)}
          footer={
            <div className="asset-detail-delete-footer">
              <Button
                size="small"
                autoInsertSpace={false}
                data-test-id="asset-unregister-final-cancel"
                onClick={(): void => setUnregisterStep(0)}
              >
                取消
              </Button>
              <Button
                size="small"
                type="primary"
                danger
                autoInsertSpace={false}
                data-test-id="asset-unregister-final-confirm"
                onClick={(): void => {
                  setUnregisterStep(0);
                  props.onUnregister?.();
                }}
              >
                确认注销
              </Button>
            </div>
          }
        >
          {ASSET_UNREGISTER_FINAL_CONFIRM_TEXT}
        </Modal>
      ) : null}
      {confirming ? (
        <Modal
          open
          title="删除素材"
          closable={false}
          maskClosable={false}
          keyboard={false}
          onCancel={(): void => setConfirming(false)}
          footer={
            <div className="asset-detail-delete-footer">
              <Button
                size="small"
                autoInsertSpace={false}
                data-test-id="asset-delete-cancel"
                onClick={(): void => setConfirming(false)}
              >
                取消
              </Button>
              <Button
                size="small"
                type="primary"
                danger
                autoInsertSpace={false}
                data-test-id="asset-delete-confirm"
                onClick={(): void => {
                  setConfirming(false);
                  props.onDelete?.();
                }}
              >
                删除
              </Button>
            </div>
          }
        >
          {ASSET_DELETE_CONFIRM_TEXT}
        </Modal>
      ) : null}
    </div>
  );
}
