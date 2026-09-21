/**
 * 内置的外部编辑器集成
 * 根据字段类型调用对应的外部编辑器
 */

import type { FieldConfig, FieldType } from './types';
import { callTableMetaFunctionString, getTableMetaContext } from '@/project/tableMeta/TableMetaEvaluator';
import type { CodeEditorCapability } from '@/Workbench/CodeEditor/CodeEditorContext';
import type { EventEditorCapability } from '@/Workbench/EventsEditor/EventEditorContext';
import type { SelectPointOpen } from '@/Workbench/modals/SelectPoint';
import type { SelectMaterialOpen } from '@/Workbench/modals/SelectMaterial';
import type { CheckboxSetOpen } from '@/Workbench/modals/CheckboxSet';

export interface ExternalEditorCapabilities {
  codeEditor?: CodeEditorCapability;
  eventEditor?: EventEditorCapability;
  selectPoint?: SelectPointOpen;
  selectMaterial?: SelectMaterialOpen;
  checkboxSet?: CheckboxSetOpen;
}

/**
 * 打开外部编辑器
 *
 * 根据字段类型调用对应的外部编辑器：
 * 所有入口都通过 React capability 调度，不读取旧编辑器全局对象。
 *
 * @param field - 字段路径
 * @param type - 字段类型
 * @param config - 字段配置
 * @param getValue - 获取字段值的函数
 * @param setValue - 设置字段值的函数
 */
export function openExternalEditor(
  field: string,
  type: FieldType | undefined,
  config: FieldConfig,
  getValue: (field: string) => unknown,
  setValue: (field: string, value: unknown) => void | Promise<void>,
  capabilities: ExternalEditorCapabilities = {},
): void {
  switch (type) {
    case 'event': {
      const eventEditor = capabilities.eventEditor;
      if (eventEditor) {
        const currentValue = getValue(field);
        // 传入原始数据（已解析的对象），不是 JSON 字符串
        const initialValue = currentValue ?? [];

        eventEditor.open({
          contextId: `table:${field}`,
          entryType: config._event || 'common',
          initialValue,
          onConfirm: (value) => setValue(field, value),
        });
      } else {
        console.warn('EventEditor capability not available');
      }
      break;
    }

    case 'textarea': {
      const codeEditor = capabilities.codeEditor;
      if (codeEditor) {
        // 获取当前值
        const currentValue = getValue(field);

        // 旧编辑器根据表格中 JSON 值是否带引号判断字符串模式。
        const isString =
          config._string === true ||
          typeof currentValue === 'string' ||
          (currentValue == null && /^\s*function\b/.test(config._template || ''));

        // 准备初始值
        let initialValue: string;
        if (isString) {
          // 字符串模式：直接使用字符串值
          initialValue = currentValue != null ? String(currentValue) : config._template || '';
        } else {
          // 对象模式：JSON 序列化
          if (currentValue != null) {
            try {
              initialValue = JSON.stringify(currentValue, null, 2);
            } catch {
              initialValue = String(currentValue);
            }
          } else {
            initialValue = config._template || '';
          }
        }

        const onConfirm = (value: string) => {
          let newValue: unknown;
          if (isString) {
            newValue = value;
          } else {
            try {
              // Legacy table values are JavaScript expressions, not strict JSON.
              // eslint-disable-next-line @typescript-eslint/no-implied-eval
              newValue = eval(`(${value || 'null'})`);
            } catch {
              newValue = value;
            }
          }
          setValue(field, newValue);
        };

        codeEditor.open({
          contextId: `table:${field}`,
          initialValue,
          lint: config._lint,
          preview: config._preview,
          onConfirm,
        });
      } else {
        console.warn('CodeEditor capability not available');
      }
      break;
    }

    case 'material': {
      const selectMaterial = capabilities.selectMaterial;
      if (selectMaterial && config._directory) {
        const currentValue = getValue(field);
        const title = config._docs || (typeof config._data === 'string' ? config._data : '') || '请选择素材';
        const transform = (one: string): string | null => {
          if (!/^[-A-Za-z0-9_.]+$/.test(one)) return null;
          if (!config._transform) return one;
          const transformed = callTableMetaFunctionString<unknown>(
            config._transform,
            [one],
            getTableMetaContext(config),
          ).value;
          return typeof transformed === 'string' || transformed === null ? transformed : one;
        };
        const applySelection = (data: string[]) => {
          let newValue: unknown = data;
          if (config._onconfirm) {
            newValue =
              callTableMetaFunctionString<unknown>(config._onconfirm, [currentValue, data], getTableMetaContext(config))
                .value ?? data;
          }
          setValue(field, newValue);
        };

        void selectMaterial({
          title,
          value: currentValue as string | string[] | undefined,
          directory: config._directory,
          source: config._directory.includes(':images')
            ? { kind: 'project-images', includeLogical: true }
            : config._directory.includes('animates')
              ? { kind: 'animations' }
              : { kind: 'directory', path: config._directory },
          transform,
        }).then((data) => {
          if (data) applySelection(data);
        });
      } else {
        console.warn('selectMaterial capability not available');
      }
      break;
    }

    case 'point': {
      const selectPoint = capabilities.selectPoint;
      if (selectPoint) {
        let x = 0;
        let y = 0;
        const currentValue = getValue(field);

        if (currentValue != null) {
          try {
            const loc = currentValue as unknown[];
            if (Array.isArray(loc) && loc.length === 2) {
              x = Number(loc[0]) || 0;
              y = Number(loc[1]) || 0;
            }
          } catch {
            // 保持默认值
          }
        }

        void selectPoint({ x, y, bigmap: false }).then((result) => {
          if (result) setValue(field, [Number(result.x), Number(result.y)]);
        });
      } else {
        console.warn('selectPoint capability not available');
      }
      break;
    }

    case 'popCheckboxSet': {
      const checkboxSet = capabilities.checkboxSet;
      if (checkboxSet && config._checkboxSet) {
        const currentValue = getValue(field);
        const checkboxSetConfig =
          typeof config._checkboxSet === 'function' ? config._checkboxSet() : config._checkboxSet;

        const title = config._docs || (typeof config._data === 'string' ? config._data : '') || '请选择多选项';
        void checkboxSet({ value: currentValue, comments: checkboxSetConfig, title }).then((value) => {
          if (value !== null) setValue(field, value.length === 0 ? 0 : value);
        });
      } else {
        console.warn('CheckboxSet capability not available or config._checkboxSet not provided');
      }
      break;
    }

    default:
      // 对于其他类型（select, checkbox, checkboxSet, disable），不需要外部编辑器
      break;
  }
}
