import { Button, Checkbox, Modal, Spin } from 'antd';
import { ReactElement, useState } from 'react';
import { IMultiSelectItem } from '../types';
import '../modal.css';

export interface IMultiSelectModalProps {
  /** 是否打开弹窗 */
  readonly open: boolean;
  /** 弹窗标题 */
  readonly title: string;
  /** 可供选择的全部候选项 */
  readonly items: readonly IMultiSelectItem[];
  /** 打开时已选中的项 id 列表 */
  readonly selectedIds: readonly string[];
  /** 是否正在加载候选项；为 true 时显示加载态 */
  readonly loading?: boolean;
  /** 候选项加载失败的提示；存在时显示错误态 */
  readonly error?: string;
  /** 确认选中的 id 列表 */
  readonly onConfirm: (ids: readonly string[]) => void;
  /** 取消选择 */
  readonly onCancel: () => void;
}

/**
 * 渲染弹窗主体：错误态优先于加载态，其次空态，最后缩略图多选列表
 * @param props 弹窗 props
 * @param selected 当前选中的 id 列表
 * @param onToggle 切换一项选中状态的回调
 * @returns 弹窗主体元素
 */
function renderBody(
  props: IMultiSelectModalProps,
  selected: readonly string[],
  onToggle: (id: string) => void,
): ReactElement {
  if (props.error !== undefined) {
    return (
      <div className="eimodal-status eimodal-error" data-test-id="multiselect-error">
        {props.error}
      </div>
    );
  }

  if (props.loading === true) {
    return (
      <div className="eimodal-status" data-test-id="multiselect-loading">
        <Spin size="small" />
      </div>
    );
  }

  if (props.items.length === 0) {
    return (
      <div className="eimodal-status" data-test-id="multiselect-empty">
        暂无可选项
      </div>
    );
  }

  return (
    <div className="eimodal-list" data-test-id="multiselect-list">
      {props.items.map((item) => (
        <label key={item.id} className="eimodal-item" data-test-id={`multiselect-item-${item.id}`}>
          <Checkbox checked={selected.includes(item.id)} onChange={(): void => onToggle(item.id)} />
          {item.thumbnail === undefined ? null : (
            <img className="eimodal-thumb" src={item.thumbnail} alt={item.label} />
          )}
          <span className="eimodal-label" title={item.label}>
            {item.label}
          </span>
        </label>
      ))}
    </div>
  );
}

/**
 * 通用多选弹窗：素材选择与多选框编辑共用，候选项以缩略图多选呈现
 *
 * 候选项列表自身滚动而确认 / 取消页脚固定；所有文本经 React 文本节点渲染，绝不注入原始 HTML。
 * @param props 弹窗 props
 * @returns 多选弹窗元素
 */
export function MultiSelectModal(props: IMultiSelectModalProps): ReactElement {
  const selectedState = useState<readonly string[]>(() => [...props.selectedIds]);
  const selected = selectedState[0];
  const setSelected = selectedState[1];

  const handleToggle = (id: string): void => {
    setSelected(selected.includes(id) ? selected.filter((member) => member !== id) : [...selected, id]);
  };

  return (
    <Modal
      open={props.open}
      title={props.title}
      onCancel={props.onCancel}
      footer={
        <div className="eimodal-footer">
          <Button size="small" autoInsertSpace={false} data-test-id="multiselect-cancel" onClick={props.onCancel}>
            取消
          </Button>
          <Button
            size="small"
            type="primary"
            autoInsertSpace={false}
            data-test-id="multiselect-confirm"
            onClick={(): void => props.onConfirm(selected)}
          >
            确定
          </Button>
        </div>
      }
    >
      {renderBody(props, selected, handleToggle)}
    </Modal>
  );
}
