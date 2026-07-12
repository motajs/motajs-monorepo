import type { PanelId } from "@/stores/PanelStore";
import type { LocSelection } from "@/stores/locState";
import type { PrefabSelection } from "@/stores/prefabState";
import type { GridPOD, LocPOD, RectPOD } from "@/utils/coordinate";
import type {
  BrushMod,
  LayerMod,
} from "@/MapEditor/MapEditorStore";
import type { SelectedBlock } from "@/MapEditor/MaterialPanel/types";

export interface EditorViewport {
  activePanel: PanelId;
  floorId?: string;
  map: {
    pos: LocPOD;
    selectedBlock?: SelectedBlock;
    layer: LayerMod;
    brush: BrushMod;
    bigmap: boolean;
    bigmapInfo: { top: number; left: number; size: number };
    offset: LocPOD;
    selectedArea: RectPOD | null;
    tileSize: GridPOD;
    showMovable: boolean;
  };
  locSelection: LocSelection | null;
  prefabSelection: PrefabSelection | null;
}

export interface EditorViewportProvider {
  capture(): EditorViewport;
  restore(viewport: EditorViewport): void | Promise<void>;
}

let provider: EditorViewportProvider | null = null;

export function registerEditorViewportProvider(
  next: EditorViewportProvider,
): () => void {
  provider = next;
  return () => {
    if (provider === next) provider = null;
  };
}

export function captureEditorViewport(): EditorViewport | null {
  return provider?.capture() ?? null;
}

export async function restoreEditorViewport(
  viewport: EditorViewport | null,
): Promise<void> {
  if (viewport && provider) await provider.restore(viewport);
}
