import { useImageAssetUrl } from "@/hooks/useImageAssetUrl";
import { useModelResourceSuspense } from "@/hooks/suspense";
import { MATERIAL_SHEET_IMAGES, projectAssets } from "@/project/assets";
import {
  projectModel,
  tilesetCellIdnum,
  type BlockRegistry,
  type TilesetCatalog,
} from "@/project/model/projectModel";
import { Modal } from "antd";
import { type FC, useCallback, useEffect, useMemo, useState } from "react";
import "./block-picker.css";

const ROWS_PER_COLUMN = 30;
const CELL_SIZE = 36;

interface BlockChoice {
  id: string;
  idnum: number;
  categoryId: string;
  path: string;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
}

interface BlockCategory {
  id: string;
  label: string;
  choices: BlockChoice[];
}

interface ImageUrlState {
  key: string;
  urls: Map<string, string>;
}

function blockCategories(
  blocks: BlockRegistry,
  tilesets: TilesetCatalog,
): BlockCategory[] {
  const categories = new Map<string, BlockCategory>();
  const seenIds = new Set<string>();

  for (const block of blocks.values()) {
    const id = typeof block.id === "string" ? block.id : "";
    const images = typeof block.images === "string" ? block.images : "";
    if (!id || id === "empty" || id === "none" || !images || seenIds.has(id)) continue;

    if (!block.materialPath || typeof block.y !== "number") continue;
    const height = typeof block.height === "number"
      ? block.height
      : images.endsWith("48") ? 48 : 32;
    const width = typeof block.width === "number" ? block.width : 32;
    seenIds.add(id);

    const categoryId = `cls:${images}`;
    const category = categories.get(categoryId) ?? { id: categoryId, label: images, choices: [] };
    category.choices.push({
      id,
      idnum: block.idnum,
      categoryId,
      path: block.materialPath,
      sourceX: (block.x ?? 0) * width,
      sourceY: block.y * height,
      sourceWidth: width,
      sourceHeight: height,
    });
    categories.set(categoryId, category);
  }

  for (const category of categories.values()) {
    category.choices.sort((left, right) => (
      left.sourceY - right.sourceY
      || left.sourceX - right.sourceX
      || left.idnum - right.idnum
    ));
  }

  for (const entry of tilesets.entries) {
    const categoryId = `tileset:${entry.name}`;
    const choices: BlockChoice[] = [];
    for (let y = 0; y < entry.rows; y += 1) {
      for (let x = 0; x < entry.columns; x += 1) {
        const idnum = tilesetCellIdnum(entry, x, y);
        choices.push({
          id: `X${idnum}`,
          idnum,
          categoryId,
          path: entry.path,
          sourceX: x * 32,
          sourceY: y * 32,
          sourceWidth: 32,
          sourceHeight: 32,
        });
      }
    }
    categories.set(categoryId, { id: categoryId, label: entry.name, choices });
  }

  const order = new Map<string, number>([
    ...MATERIAL_SHEET_IMAGES.map((name, index) => [`cls:${name}`, index] as const),
    ["cls:autotile", MATERIAL_SHEET_IMAGES.length],
  ]);
  return [...categories.values()]
    .filter((category) => category.choices.length > 0)
    .sort((left, right) => (
      (order.get(left.id) ?? Number.MAX_SAFE_INTEGER)
      - (order.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      || left.label.localeCompare(right.label)
    ));
}

function useBlockImageUrls(choices: readonly BlockChoice[]): Map<string, string> {
  const paths = useMemo(() => [...new Set(choices.map((choice) => choice.path))], [choices]);
  const pathsKey = paths.join("\n");
  const [state, setState] = useState<ImageUrlState>({ key: "", urls: new Map() });

  useEffect(() => {
    let active = true;
    let scheduled = false;
    const cache = new Map<string, { revision: number; url: string }>();
    const resources = paths.map((path) => [path, projectAssets.image(path)] as const);

    const publish = () => {
      scheduled = false;
      if (!active) return;
      let changed = false;
      for (const [path, resource] of resources) {
        const content = resource.snapshot();
        if (content.status === "idle") void resource.ensureLoaded();
        if (content.status !== "loaded") continue;
        const previous = cache.get(path);
        if (previous?.revision === content.value.revision) continue;
        if (previous) URL.revokeObjectURL(previous.url);
        const bytes = new Uint8Array(content.value.bytes);
        const url = URL.createObjectURL(new Blob([bytes.buffer], { type: "image/png" }));
        cache.set(path, { revision: content.value.revision, url });
        changed = true;
      }
      if (changed) {
        setState({ key: pathsKey, urls: new Map([...cache].map(([path, entry]) => [path, entry.url])) });
      }
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(publish);
    };
    const unsubscribes = resources.map(([, resource]) => resource.subscribe(schedule));
    schedule();
    return () => {
      active = false;
      for (const unsubscribe of unsubscribes) unsubscribe();
      for (const entry of cache.values()) URL.revokeObjectURL(entry.url);
    };
  }, [paths, pathsKey]);

  return state.key === pathsKey ? state.urls : new Map();
}

const BlockImage: FC<{ choice?: BlockChoice; url?: string }> = ({ choice, url }) => {
  if (!choice || !url) return <span className="blockPickerMissing">?</span>;
  const visibleHeight = Math.min(32, choice.sourceHeight);
  return (
    <span className="blockPickerSprite" aria-hidden="true">
      <img
        src={url}
        alt=""
        draggable={false}
        style={{
          left: -choice.sourceX,
          top: -(choice.sourceY + choice.sourceHeight - visibleHeight),
        }}
      />
    </span>
  );
};

const CurrentBlockPreview: FC<{ choice?: BlockChoice }> = ({ choice }) => {
  const { url } = useImageAssetUrl(choice?.path ?? "project/materials/terrains.png");
  return <BlockImage choice={choice} url={url ?? undefined} />;
};

const BlockChoiceGrid: FC<{
  category: BlockCategory;
  selectedId?: string;
  onSelect(choice: BlockChoice): void;
  onConfirm(choice: BlockChoice): void;
}> = ({ category, selectedId, onSelect, onConfirm }) => {
  const urls = useBlockImageUrls(category.choices);
  return (
    <div
      className="blockPickerGrid"
      data-test-id="block-picker-grid"
      style={{
        gridTemplateRows: `repeat(${Math.min(ROWS_PER_COLUMN, category.choices.length)}, ${CELL_SIZE}px)`,
      }}
    >
      {category.choices.map((choice) => (
        <button
          key={`${choice.id}:${choice.idnum}`}
          type="button"
          className={choice.id === selectedId ? "selected" : undefined}
          data-test-id={`block-picker-choice-${choice.id}`}
          aria-label={`${choice.id} (${choice.idnum})`}
          title={`${choice.id} (${choice.idnum})`}
          onClick={() => onSelect(choice)}
          onDoubleClick={() => onConfirm(choice)}
        >
          <BlockImage choice={choice} url={urls.get(choice.path)} />
        </button>
      ))}
    </div>
  );
};

export interface BlockPickerFieldProps {
  value: unknown;
  disabled?: boolean;
  onCommit(value: string): void | Promise<void>;
}

export const BlockPickerField: FC<BlockPickerFieldProps> = ({ value, disabled, onCommit }) => {
  const blockResource = useMemo(() => projectModel.blockRegistry(), []);
  const blocks = useModelResourceSuspense(blockResource);
  const tilesetResource = useMemo(() => projectModel.tilesetCatalog(), []);
  const tilesets = useModelResourceSuspense(tilesetResource);
  const categories = useMemo(() => blockCategories(blocks, tilesets), [blocks, tilesets]);
  const choiceById = useMemo(() => new Map(
    categories.flatMap((category) => category.choices.map((choice) => [choice.id, choice] as const)),
  ), [categories]);
  const currentId = typeof value === "string" ? value : "";
  const currentChoice = choiceById.get(currentId);
  const [open, setOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState(currentChoice?.categoryId ?? categories[0]?.id ?? "");
  const [draftId, setDraftId] = useState(currentId);
  const activeCategory = categories.find((category) => category.id === activeCategoryId) ?? categories[0];
  const draftChoice = choiceById.get(draftId);

  const show = useCallback(() => {
    if (disabled) return;
    setDraftId(currentId);
    setActiveCategoryId(currentChoice?.categoryId ?? categories[0]?.id ?? "");
    setOpen(true);
  }, [categories, currentChoice, currentId, disabled]);
  const commit = useCallback(async (choice: BlockChoice | undefined = draftChoice) => {
    if (!choice) return;
    try {
      await onCommit(choice.id);
      setOpen(false);
    } catch {
      // Field Renderer already preserves the editing state and reports the write error.
    }
  }, [draftChoice, onCommit]);

  return (
    <div className="blockPickerField" data-test-id="block-picker-field">
      <CurrentBlockPreview choice={currentChoice} />
      <code title={currentId}>{currentId || "未设置"}</code>
      <button type="button" disabled={disabled || categories.length === 0} onClick={show}>选择</button>
      <Modal
        title="选择图块"
        open={open}
        width={900}
        okText="确定"
        cancelText="取消"
        okButtonProps={{ disabled: !draftChoice, "data-test-id": "block-picker-confirm" }}
        onCancel={() => setOpen(false)}
        onOk={() => void commit()}
        destroyOnHidden
      >
        <div className="blockPicker" data-test-id="block-picker-modal">
          <aside data-test-id="block-picker-categories">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={category.id === activeCategory?.id ? "active" : undefined}
                data-test-id={`block-picker-category-${category.id}`}
                onClick={() => setActiveCategoryId(category.id)}
              >
                <span>{category.label}</span>
                <small>{category.choices.length}</small>
              </button>
            ))}
          </aside>
          <main>
            <div className="blockPickerViewport" data-test-id="block-picker-viewport">
              {activeCategory
                ? (
                  <BlockChoiceGrid
                    category={activeCategory}
                    selectedId={draftId}
                    onSelect={(choice) => setDraftId(choice.id)}
                    onConfirm={(choice) => void commit(choice)}
                  />
                )
                : <div className="blockPickerEmpty">没有可选图块</div>}
            </div>
            <div className="blockPickerStatus">
              <CurrentBlockPreview choice={draftChoice} />
              <span>{draftChoice ? `${draftChoice.id} · ${draftChoice.idnum}` : "请选择一个图块"}</span>
              <small>每列最多 {ROWS_PER_COLUMN} 个；区域支持横向和纵向滚动</small>
            </div>
          </main>
        </div>
      </Modal>
    </div>
  );
};
