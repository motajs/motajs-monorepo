import { Button, Modal } from 'antd';
import { ReactElement, useEffect, useRef } from 'react';
import { IPanelCandidateModalProps } from '../types';
import '../../react/modal.css';
import '../explorer.css';

/** 弹窗根节点的数据属性：antd `Modal` 会把 `data-*` 透传到对话框根元素 */
const DIALOG_ATTRS: Record<string, string> = { 'data-test-id': 'explorer-candidate-dialog' };

/**
 * 候选面板弹窗：列出能打开该文件的全部面板类型，用户点选后才继续打开
 *
 * 弹窗只在候选 ≥ 2 时挂载，因此没有空态 / 加载态 / 错误态；候选名称与图标只从 props 读取，
 * 不自行查询面板类型注册表。所有文本经 React 文本节点渲染，绝不注入原始 HTML。
 * @param props 待打开路径、候选面板类型与两个回调
 * @returns 候选面板弹窗元素
 */
export function PanelCandidateModal(props: IPanelCandidateModalProps): ReactElement {
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect((): void => {
    if (firstRef.current !== null) firstRef.current.focus();
  }, []);

  return (
    <Modal
      open
      {...DIALOG_ATTRS}
      title="选择打开方式"
      width={420}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
      closable={false}
      maskClosable={false}
      keyboard
      onCancel={props.onCancel}
      footer={
        <div className="eimodal-footer">
          <Button
            size="small"
            autoInsertSpace={false}
            data-test-id="explorer-candidate-cancel"
            onClick={props.onCancel}
          >
            取消
          </Button>
        </div>
      }
    >
      <div className="efx-candidate-path" data-test-id="explorer-candidate-path" title={props.path}>
        {`文件：${props.path}`}
      </div>
      <div className="eimodal-list efx-candidate-list">
        {props.candidates.map((type, index) => (
          <button
            key={type.id}
            ref={index === 0 ? firstRef : undefined}
            type="button"
            className="efx-candidate"
            data-test-id={`explorer-candidate-${type.id}`}
            title={type.name}
            onClick={(): void => props.onSelect(type.id)}
          >
            <span className="efx-candidate-icon" aria-hidden="true">
              {type.icon}
            </span>
            <span className="efx-candidate-name">{type.name}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
