import { Button, Space } from 'antd';
import type { FC } from 'react';
import { useCodeEditor } from '@/Workbench/CodeEditor/CodeEditorContext';
import { notifyError, notifySuccess } from '@/utils/notify';
import { SchemaCustomizationEditor } from './SchemaCustomizationEditor';
import { SchemaTable, type SchemaTableProps } from './SchemaTable';
import { useProjectSchema, type BuiltinSchemaDefinition, type SchemaLayer } from './projectSchema';
import { deleteSchemaOverride, loadRawSchemaOverride, saveSchemaOverride } from './schemaOverrideCommands';
import { useSchemaCustomizationState } from './schemaCustomizationState';

export interface ProjectSchemaTableProps extends Omit<SchemaTableProps, 'fieldSchemas' | 'uiSchema'> {
  definition: BuiltinSchemaDefinition;
}

const SchemaErrorRepair: FC<{
  definition: BuiltinSchemaDefinition;
  layer: SchemaLayer;
  error: Error;
  hasOverride: boolean;
}> = ({ definition, layer, error, hasOverride }) => {
  const codeEditor = useCodeEditor();
  const openRaw = async () => {
    try {
      const initialValue = await loadRawSchemaOverride(definition, layer);
      codeEditor.open({
        contextId: `project-schema:repair:${layer}:${definition.uiSchema.schemaId}`,
        initialValue,
        lint: false,
        onConfirm: async (text) => {
          await saveSchemaOverride(definition, layer, text);
          notifySuccess('Schema override 已修复');
        },
      });
    } catch (reason) {
      notifyError(reason);
    }
  };
  return (
    <div className="schemaProjectError" data-test-id="schema-project-error" role="alert">
      <strong>{layer === 'field' ? '字段定义' : '表格布局'}加载失败</strong>
      <div>{error.message}</div>
      {hasOverride ? (
        <Space>
          <Button size="small" onClick={() => void openRaw()}>
            打开原始 JSON
          </Button>
          <Button size="small" danger onClick={() => void deleteSchemaOverride(definition, layer)}>
            删除 override
          </Button>
        </Space>
      ) : (
        <div>错误来自当前内置 Schema 或其跨 Bundle 引用。</div>
      )}
    </div>
  );
};

export const ProjectSchemaTable: FC<ProjectSchemaTableProps> = ({ definition, ...props }) => {
  const schema = useProjectSchema(definition);
  const customization = useSchemaCustomizationState(definition.uiSchema.schemaId);
  if (schema.status === 'loading') return <div className="schemaProjectLoading">正在加载表格配置...</div>;
  if (schema.status === 'error') {
    return (
      <SchemaErrorRepair
        definition={definition}
        layer={schema.layer}
        error={schema.error}
        hasOverride={schema.layer === 'field' ? schema.hasFieldOverride : schema.hasUiOverride}
      />
    );
  }
  if (customization.enabled) {
    return <SchemaCustomizationEditor {...props} definition={definition} resolution={schema} />;
  }
  return <SchemaTable {...props} fieldSchemas={schema.fieldSchemas} uiSchema={schema.uiSchema} />;
};
