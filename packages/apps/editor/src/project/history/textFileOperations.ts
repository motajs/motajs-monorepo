import { FileHandlerManager } from "@/fs/FileHandlerManager";
import type { AppliedOperation, EditorOperation, OperationMeta, OperationTarget } from "./operations";

export interface TextFileOperationOptions {
  invalidate?: () => void;
}

interface TextFileCheckpoint {
  exists: boolean;
  text?: string;
}

async function readText(path: string): Promise<string | undefined> {
  if (!await FileHandlerManager.exists(path)) return undefined;
  const handler = await FileHandlerManager.load(path);
  const content = handler.getContent();
  if (content.status !== "loaded") throw new Error(`Cannot read ${path} from ${content.status}`);
  return content.value;
}

async function writeText(path: string, text: string, options: TextFileOperationOptions): Promise<void> {
  const handler = FileHandlerManager.get(path);
  handler.update(text);
  options.invalidate?.();
}

async function deleteText(path: string, options: TextFileOperationOptions): Promise<void> {
  await FileHandlerManager.delete(path);
  options.invalidate?.();
}

function textFileTarget(path: string, options: TextFileOperationOptions): OperationTarget {
  return {
    key: `file:${path}`,
    path,
    capture: async (): Promise<TextFileCheckpoint> => {
      const text = await readText(path);
      return text === undefined ? { exists: false } : { exists: true, text };
    },
    restore: async (checkpoint) => {
      const value = checkpoint as TextFileCheckpoint;
      if (value.exists) await writeText(path, value.text ?? "", options);
      else if (await FileHandlerManager.exists(path)) await deleteText(path, options);
    },
  };
}

class WriteTextFileOperation implements EditorOperation {
  readonly targets: readonly OperationTarget[];
  readonly meta: OperationMeta;
  private readonly path: string;
  private readonly text: string;
  private readonly options: TextFileOperationOptions;

  constructor(
    meta: OperationMeta,
    path: string,
    text: string,
    options: TextFileOperationOptions,
  ) {
    this.meta = meta;
    this.path = path;
    this.text = text;
    this.options = options;
    this.targets = [textFileTarget(path, options)];
  }

  async apply(): Promise<AppliedOperation> {
    const previous = await readText(this.path);
    if (previous === this.text) {
      return { value: undefined, inverse: this, changed: false };
    }
    await writeText(this.path, this.text, this.options);
    return {
      value: undefined,
      inverse: previous === undefined
        ? new DeleteTextFileOperation(this.meta, this.path, this.options)
        : new WriteTextFileOperation(this.meta, this.path, previous, this.options),
      changed: true,
    };
  }
}

class DeleteTextFileOperation implements EditorOperation {
  readonly targets: readonly OperationTarget[];
  readonly meta: OperationMeta;
  private readonly path: string;
  private readonly options: TextFileOperationOptions;

  constructor(
    meta: OperationMeta,
    path: string,
    options: TextFileOperationOptions,
  ) {
    this.meta = meta;
    this.path = path;
    this.options = options;
    this.targets = [textFileTarget(path, options)];
  }

  async apply(): Promise<AppliedOperation> {
    const previous = await readText(this.path);
    if (previous === undefined) return { value: undefined, inverse: this, changed: false };
    await deleteText(this.path, this.options);
    return {
      value: undefined,
      inverse: new WriteTextFileOperation(this.meta, this.path, previous, this.options),
      changed: true,
    };
  }
}

export function writeTextFileOperation(
  path: string,
  text: string,
  meta: OperationMeta,
  options: TextFileOperationOptions = {},
): EditorOperation {
  return new WriteTextFileOperation(meta, path, text, options);
}

export function deleteTextFileOperation(
  path: string,
  meta: OperationMeta,
  options: TextFileOperationOptions = {},
): EditorOperation {
  return new DeleteTextFileOperation(meta, path, options);
}
