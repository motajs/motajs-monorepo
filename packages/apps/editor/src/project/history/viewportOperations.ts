/**
 * 视口相关操作（D-02）：`RestoreViewportOperation` / `NavigateFloorOperation` / `navigateFloorOperation`。
 *
 * 它们依赖 editor 的 `./viewport`（带模块级 provider 注册表），因此**留 editor**、不进 core。
 * 从 `./operations` 迁出后由本文件独立承载；`./operations` 的 shim 不再导出 `navigateFloorOperation`。
 */
import type { AppliedOperation, EditorOperation, OperationMeta } from './operations';
import { captureEditorViewport, restoreEditorViewport, type EditorViewport } from './viewport';

class RestoreViewportOperation implements EditorOperation {
  readonly meta: OperationMeta;
  private readonly viewport: EditorViewport;

  constructor(meta: OperationMeta, viewport: EditorViewport) {
    this.meta = meta;
    this.viewport = viewport;
  }

  async apply(): Promise<AppliedOperation<void>> {
    const current = captureEditorViewport();
    if (!current) return { value: undefined, inverse: this, changed: false };
    await restoreEditorViewport(this.viewport);
    return {
      value: undefined,
      inverse: new RestoreViewportOperation(this.meta, current),
      changed: true,
    };
  }
}

class NavigateFloorOperation implements EditorOperation {
  readonly meta: OperationMeta;
  private readonly floorId: string;
  private readonly onlyFromFloorId?: string;

  constructor(meta: OperationMeta, floorId: string, onlyFromFloorId?: string) {
    this.meta = meta;
    this.floorId = floorId;
    this.onlyFromFloorId = onlyFromFloorId;
  }

  async apply(): Promise<AppliedOperation<void>> {
    const current = captureEditorViewport();
    if (!current || (this.onlyFromFloorId && current.floorId !== this.onlyFromFloorId)) {
      return { value: undefined, inverse: this, changed: false };
    }
    await restoreEditorViewport({ ...current, floorId: this.floorId });
    return {
      value: undefined,
      inverse: new RestoreViewportOperation(this.meta, current),
      changed: current.floorId !== this.floorId,
    };
  }
}

export function navigateFloorOperation(
  floorId: string,
  meta: OperationMeta,
  onlyFromFloorId?: string,
): EditorOperation {
  return new NavigateFloorOperation(meta, floorId, onlyFromFloorId);
}
