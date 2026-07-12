import { useCallback, useMemo, useRef, type FC } from 'react';
import type { TableRowProps, FieldType, CheckboxSetConfig, FieldConfig } from '../types';
import { ActionButtons } from './ActionButtons';
import {
  TextareaInput,
  SelectInput,
  CheckboxInput,
  CheckboxSet,
  ColorInput,
} from './inputs';
import { checkRange, getByFieldPath, getParentFieldPath } from '../utils';
import { DataStore } from '../stores';
import { openExternalEditor } from '../externalEditor';
import { noop } from '@/utils/empty';
import { useCodeEditor } from '@/Workbench/CodeEditor/CodeEditorContext';
import { useEventEditor } from '@/Workbench/EventsEditor/EventEditorContext';
import { useSelectPointModalAction } from '@/Workbench/modals/SelectPoint';
import { useSelectMaterialModalAction } from '@/Workbench/modals/SelectMaterial';
import { useCheckboxSetModalAction } from '@/Workbench/modals/CheckboxSet';
import { notifyError, notifySuccess } from '@/utils/notify';

/**
 * 根据字段类型渲染对应的输入组件
 */
const renderInput = (
  type: FieldType | undefined,
  value: unknown,
  config: FieldConfig,
  onChange: (value: unknown) => void,
): React.ReactNode => {
  switch (type) {
    case 'select':
      return (
        <SelectInput
          value={value}
          options={config._select?.values ?? []}
          onChange={onChange}
        />
      );

    case 'checkbox':
      return (
        <CheckboxInput
          value={Boolean(value)}
          onChange={onChange}
        />
      );

    case 'checkboxSet': {
      // 获取 checkboxSet 配置，支持函数形式
      const checkboxSetConfig: CheckboxSetConfig | undefined =
        typeof config._checkboxSet === 'function'
          ? config._checkboxSet()
          : config._checkboxSet;

      return (
        <CheckboxSet
          value={value}
          keys={checkboxSetConfig?.key ?? []}
          prefixStrings={checkboxSetConfig?.prefix ?? []}
          onChange={onChange}
        />
      );
    }

    case 'color':
      return (
        <ColorInput
          value={value}
          onChange={onChange}
        />
      );

    case 'disable':
      return (
        <TextareaInput
          value={value}
          indent={config.indent}
          disabled
          readonly
          onChange={onChange}
        />
      );

    // textarea, event, material, point, popCheckboxSet 都使用 TextareaInput
    // 它们的特殊编辑功能通过编辑按钮触发
    default:
      return (
        <TextareaInput
          value={value}
          indent={config.indent}
          onChange={onChange}
        />
      );
  }
};

/**
 * HTML 转义函数
 * 用于在 title 属性中安全显示内容
 */
const htmlEscape = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/**
 * TableRow 组件
 *
 * 渲染表格的叶节点行，包含：
 * - 字段名称列
 * - 注释列
 * - 值输入列（根据 config._type 选择对应的输入组件）
 * - 操作按钮列
 *
 * 架构说明：
 * - 直接访问 DataStore 获取回调，避免 props 传递
 * - 统一处理 checkRange 验证，无论值来自直接输入还是外部编辑器
 * - 支持双击事件（根据 editMode 执行不同操作）
 *
 * checkRange 验证：
 * - handleValueChange: 直接输入时验证
 * - handleOpenExternalEditor 内的 setValue: 外部编辑器返回值时验证
 * - 验证失败时显示错误消息并拒绝保存
 */
export const TableRow: FC<TableRowProps> = (props) => {
  const { node } = props;

  // 从 node 解构所需属性
  const { field, shortField, value, config, comment, shortComment } = node;

  // 直接从 DataStore 获取回调
  const { data, onValueChange, onAddItem, onDeleteItem, onOpenExternalEditor, editMode } = DataStore.useStore();
  const codeEditor = useCodeEditor();
  const eventEditor = useEventEditor();
  const selectPoint = useSelectPointModalAction();
  const selectMaterial = useSelectMaterialModalAction();
  const checkboxSet = useCheckboxSetModalAction();

  const type = config._type;

  // 生成用于 data-field 属性的值
  // "['main']['floorIds']" => "main-floorIds"
  const dataField = useMemo(
    () => field.slice(2, -2).split("']['").join('-'),
    [field],
  );

  // 转义后的注释，用于 title 属性
  const commentEscaped = useMemo(() => htmlEscape(comment), [comment]);

  // 序列化 config 用于存储（排除 _data 字段）
  const cobjStr = useMemo(() => {
    const configCopy = { ...config };
    delete (configCopy as Record<string, unknown>)._data;
    return htmlEscape(JSON.stringify(configCopy));
  }, [config]);

  // 处理注释按钮点击
  const handleCommentClick = useCallback(() => {
    notifySuccess(comment);
  }, [comment]);

  // 统一的值变更处理（包含 checkRange 验证）
  // 无论值来自直接输入还是外部编辑器，都会经过此验证
  const handleValueChange = useCallback((newValue: unknown) => {
    // 验证 _range
    if (!checkRange(config, newValue)) {
      notifyError(field + ' : 输入的值不合要求,请鼠标放置在注释上查看说明');
      return; // 不触发 onChange
    }
    onValueChange(field, newValue);
  }, [config, field, onValueChange]);

  // 打开外部编辑器 - 如果外部提供了回调则使用，否则使用内置实现
  // 关键：内置实现中的 setValue 使用带 checkRange 验证的逻辑
  const handleOpenExternalEditor = useCallback(() => {
    // 检查是否有外部提供的回调（非 noop）
    if (onOpenExternalEditor !== noop) {
      onOpenExternalEditor(field, config._type, config);
    } else {
      // 使用内置的外部编辑器集成
      const getValue = (f: string) => getByFieldPath(data, f);
      // 关键：使用带 checkRange 验证的 setValue
      const setValue = (f: string, newValue: unknown) => {
        if (!checkRange(config, newValue)) {
          notifyError(f + ' : 输入的值不合要求');
          return;
        }
        return onValueChange(f, newValue);
      };
      openExternalEditor(field, config._type, config, getValue, setValue, {
        codeEditor,
        eventEditor,
        selectPoint,
        selectMaterial,
        checkboxSet,
      });
    }
  }, [field, config, data, onValueChange, onOpenExternalEditor, codeEditor, eventEditor, selectPoint, selectMaterial, checkboxSet]);

  // 双击处理 - 根据 editMode 调用不同的回调
  const handleDoubleClick = useCallback(() => {
    const mode = editMode;

    if (mode === 'change') {
      // 正常编辑模式：打开外部编辑器
      handleOpenExternalEditor();
    } else if (mode === 'add') {
      // 添加模式：获取父路径，提示输入新名称
      const parentPath = getParentFieldPath(field);
      const name = prompt('请输入新项的名称');
      if (name) {
        onAddItem(parentPath, name);
      }
    } else if (mode === 'delete') {
      // 删除模式：检查是否允许删除（null 验证）
      if (!checkRange(config, null)) {
        notifyError(field + ' : 该值不允许为null，无法删除');
        return;
      }
      if (confirm('确定要删除吗？')) {
        onDeleteItem(field);
      }
    }
  }, [field, config, editMode, handleOpenExternalEditor, onAddItem, onDeleteItem]);

  // 处理复制按钮点击
  const handleCopyClick = useCallback(() => {
    if (value == null) {
      notifyError('没有赋值的内容');
      return;
    }

    const textToCopy = String(value);
    navigator.clipboard.writeText(textToCopy).then(
      () => {
        notifySuccess('复制成功！');
      },
      () => {
        notifyError('无法复制此内容，请手动选择复制');
      },
    );
  }, [value]);

  // 处理双击事件
  // 使用两次单击检测实现双击（支持移动端）
  const lastClickRef = useRef(0);

  const handleClick = useCallback(() => {
    const now = Date.now();
    if (now - lastClickRef.current < 500) {
      // 双击触发
      handleDoubleClick();
      lastClickRef.current = 0; // 重置，避免连续触发
    } else {
      lastClickRef.current = now;
    }
  }, [handleDoubleClick]);

  return (
    <tr data-field={dataField} data-test-id={`table-row-${dataField}`} onClick={handleClick}>
      {/* 字段名称列 */}
      <td title={field}>{shortField}</td>

      {/* 注释列 */}
      <td title={commentEscaped} data-cobj={cobjStr}>
        {shortComment || commentEscaped}
      </td>

      {/* 值输入列 */}
      <td>
        <div className={`etableInputDiv ${type || ''}`} data-test-id={`table-input-${dataField}`}>
          {renderInput(type, value, config, handleValueChange)}
        </div>
      </td>

      {/* 操作按钮列 */}
      <td>
        <ActionButtons
          testId={`table-edit-${dataField}`}
          showComment={!!shortComment}
          type={type}
          onCommentClick={handleCommentClick}
          onOpenExternalEditor={handleOpenExternalEditor}
          onCopyClick={handleCopyClick}
        />
      </td>
    </tr>
  );
};
