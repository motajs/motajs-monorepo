import { Button, Tooltip } from "antd";
import { TableProperties } from "lucide-react";
import type { FC } from "react";
import { type BuiltinSchemaDefinition, useProjectSchema } from "./projectSchema";
import { toggleSchemaCustomization, useSchemaCustomizationState } from "./schemaCustomizationState";

export interface SchemaCustomizationButtonProps {
  definition: BuiltinSchemaDefinition;
}

export const SchemaCustomizationButton: FC<SchemaCustomizationButtonProps> = ({ definition }) => {
  const schema = useProjectSchema(definition);
  const state = useSchemaCustomizationState(definition.uiSchema.schemaId);
  const hasOverride = schema.status !== "loading" && (schema.hasFieldOverride || schema.hasUiOverride);
  return (
    <Tooltip title={state.enabled ? "退出当前表格的结构编辑模式" : "自定义当前新版表格"}>
      <Button
        danger={schema.status === "error"}
        disabled={schema.status === "loading"}
        icon={<TableProperties size={14} />}
        size="small"
        type={state.enabled ? "primary" : "text"}
        onClick={() => toggleSchemaCustomization(definition.uiSchema.schemaId)}
      >
        {state.enabled ? "完成自定义" : `自定义表格${hasOverride ? " ·" : ""}`}
      </Button>
    </Tooltip>
  );
};
