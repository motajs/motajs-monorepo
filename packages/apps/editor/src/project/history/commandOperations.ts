import type { DataResource } from "@/project/data/DataResource";
import type { Action } from "@/utils/action";
import { commandError, commandOk, type CommandResult } from "@/project/commands/types";
import { operationHistory } from "./operationHistory";
import {
  compositeOperation,
  patchResourceOperation,
  type EditorOperation,
  type OperationMeta,
} from "./operations";

export interface PatchCommandOptions {
  label: string;
  stage: string;
}

export async function executeCompositeCommand(
  operations: readonly EditorOperation<unknown>[],
  options: OperationMeta,
): Promise<CommandResult> {
  try {
    await operationHistory.execute(compositeOperation(operations, options));
    return commandOk();
  } catch (error) {
    const stage = error && typeof error === "object" && "commandStage" in error
      ? String(error.commandStage)
      : options.stage;
    return commandError(stage, error);
  }
}

export async function executePatchCommand<T>(
  resource: DataResource<T>,
  actions: readonly Action[],
  options: PatchCommandOptions,
): Promise<CommandResult> {
  try {
    await operationHistory.execute(
      patchResourceOperation(resource, actions, options),
    );
    return commandOk();
  } catch (error) {
    return commandError(options.stage, error);
  }
}
