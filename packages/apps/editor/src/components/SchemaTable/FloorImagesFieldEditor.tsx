import { useImageAssetUrl } from '@/hooks/useImageAssetUrl';
import { useResourceSuspense } from '@/hooks/suspense';
import { floorImagePath } from '@/MapEditor/rendering/floorImages';
import { projectData } from '@/project/data/projectData';
import type { FloorData, FloorImageData } from '@/types';
import { FloorThumbnail } from '@/Workbench/modals/shared/FloorThumbnail';
import { Checkbox, InputNumber, Modal, Select } from 'antd';
import { Image } from 'lucide-react';
import {
  Suspense,
  type FC,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CollectionControl } from './CollectionControl';
import { evaluateExpression } from './expression';
import { ImageAssetPickerModal, type ImageAssetSelection, type ImageCrop } from './ImageAssetPickerModal';
import type { FieldSchema, SchemaScope } from './types';

interface FloorImagesFieldEditorProps {
  schema: FieldSchema;
  value: unknown;
  disabled: boolean;
  scope: SchemaScope;
  onCommit(value: unknown): Promise<void>;
}

type EditableFloorImage = Record<string, unknown>;

function isRecord(value: unknown): value is EditableFloorImage {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isEditableFloorImage(value: unknown): value is EditableFloorImage & { name: string } {
  return isRecord(value) && typeof value.name === 'string' && value.name.length > 0;
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function positiveInteger(value: unknown, fallback = 1): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function RawFloorImageItem({ value, onChange }: { value: unknown; onChange(value: unknown): void }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2) ?? 'null');
  const [error, setError] = useState<string>();
  const commit = () => {
    try {
      onChange(JSON.parse(text));
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };
  return (
    <div className="floorImageRawItem">
      <div className="schemaTableError">该项不是有效贴图对象，请直接修复 JSON。</div>
      <textarea value={text} onChange={(event) => setText(event.target.value)} onBlur={commit} />
      {error ? <div className="schemaTableError">{error}</div> : null}
    </div>
  );
}

function imageCrop(value: unknown): ImageCrop | undefined {
  if (!isRecord(value)) return undefined;
  const x = value.sx;
  const y = value.sy;
  const width = value.w;
  const height = value.h;
  if (
    typeof x !== 'number' ||
    !Number.isFinite(x) ||
    typeof y !== 'number' ||
    !Number.isFinite(y) ||
    typeof width !== 'number' ||
    !Number.isFinite(width) ||
    width <= 0 ||
    typeof height !== 'number' ||
    !Number.isFinite(height) ||
    height <= 0
  )
    return undefined;
  return { x, y, width, height };
}

function applyImageSelection(item: EditableFloorImage, selection: ImageAssetSelection): EditableFloorImage {
  const next: EditableFloorImage = { ...item, name: selection.name };
  if (selection.preserveCrop) return next;
  delete next.sx;
  delete next.sy;
  delete next.w;
  delete next.h;
  if (selection.crop) {
    next.sx = selection.crop.x;
    next.sy = selection.crop.y;
    next.w = selection.crop.width;
    next.h = selection.crop.height;
  }
  return next;
}

interface FloorImageHitboxProps {
  item: EditableFloorImage & { name: string };
  index: number;
  selected: boolean;
  floor: FloorData;
  nameMap: Readonly<Record<string, string>>;
  previewSize: number;
  onSelect(index: number): void;
  onMove(index: number, x: number, y: number): void;
}

const FloorImageHitbox: FC<FloorImageHitboxProps> = ({
  item,
  index,
  selected,
  floor,
  nameMap,
  previewSize,
  onSelect,
  onMove,
}) => {
  const path = floorImagePath(item as unknown as FloorImageData, nameMap);
  const { url } = useImageAssetUrl(path);
  const [naturalSize, setNaturalSize] = useState({ width: 32, height: 32 });
  const dragRef = useRef<{ clientX: number; clientY: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!url) return;
    const image = new window.Image();
    image.onload = () => setNaturalSize({ width: image.naturalWidth || 32, height: image.naturalHeight || 32 });
    image.src = url;
  }, [url]);

  const floorWidth = Math.max(1, finite(floor.width, 13));
  const floorHeight = Math.max(1, finite(floor.height, 13));
  const tileSize = Math.min(previewSize / floorWidth, previewSize / floorHeight);
  const scale = tileSize / 32;
  const mapLeft = Math.max(0, (previewSize - floorWidth * tileSize) / 2);
  const mapTop = Math.max(0, (previewSize - floorHeight * tileSize) / 2);
  const frame = positiveInteger(item.frame, 1);
  const width = Math.max(1, finite(item.w, naturalSize.width) / frame);
  const height = Math.max(1, finite(item.h, naturalSize.height));
  const x = finite(item.x);
  const y = finite(item.y);

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      className={`floorImageHitbox${selected ? ' selected' : ''}${item.disable || item.disabled ? ' disabled' : ''}`}
      data-test-id={`floor-image-hitbox-${index}`}
      title={`${item.name} (${x}, ${y})`}
      style={{
        left: mapLeft + x * scale,
        top: mapTop + y * scale,
        width: Math.max(8, width * scale),
        height: Math.max(8, height * scale),
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect(index);
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { clientX: event.clientX, clientY: event.clientY, x, y };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag) return;
        event.preventDefault();
        onMove(
          index,
          Math.round(drag.x + (event.clientX - drag.clientX) / scale),
          Math.round(drag.y + (event.clientY - drag.clientY) / scale),
        );
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  );
};

interface FloorImageEditorModalProps {
  floorId: string;
  initialValue: unknown[];
  onClose(): void;
  onConfirm(value: unknown[]): Promise<void>;
}

const FloorImageEditorModal: FC<FloorImageEditorModalProps> = ({ floorId, initialValue, onClose, onConfirm }) => {
  const [floor] = useResourceSuspense(projectData.floor(floorId));
  const [tower] = useResourceSuspense(projectData.tower());
  const [draft, setDraft] = useState<unknown[]>(() => structuredClone(initialValue));
  const [selectedIndex, setSelectedIndex] = useState(draft.length > 0 ? 0 : -1);
  const [imagePicker, setImagePicker] = useState<{ index: number | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const previewSize = 440;
  const nameMap =
    tower.main.nameMap && typeof tower.main.nameMap === 'object' ? (tower.main.nameMap as Record<string, string>) : {};

  const updateItem = useCallback((index: number, update: (item: EditableFloorImage) => EditableFloorImage) => {
    setDraft((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        return update(isRecord(item) ? item : {});
      }),
    );
  }, []);

  const setProperty = useCallback(
    (index: number, key: string, value: unknown) => {
      updateItem(index, (item) => {
        const next = { ...item };
        if (value === undefined || value === '') delete next[key];
        else next[key] = value;
        return next;
      });
    },
    [updateItem],
  );

  const selected = draft[selectedIndex];
  const imagePickerValue = imagePicker?.index == null ? undefined : draft[imagePicker.index];
  const imagePickerInitial = isRecord(imagePickerValue) ? imagePickerValue : undefined;
  const imagePickerInitialSelection =
    imagePickerInitial && typeof imagePickerInitial.name === 'string'
      ? {
          name: imagePickerInitial.name,
          path: floorImagePath(imagePickerInitial as unknown as FloorImageData, nameMap),
          crop: imageCrop(imagePickerInitial),
        }
      : undefined;
  const previewFloor = useMemo<FloorData>(() => ({ ...floor, images: draft as FloorImageData[] }), [draft, floor]);

  const submit = useCallback(async () => {
    setSaving(true);
    try {
      await onConfirm(draft);
      setSaveError(undefined);
      onClose();
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  }, [draft, onClose, onConfirm]);

  return (
    <Modal
      title="编辑楼层贴图"
      open
      width={1040}
      style={{ top: 32 }}
      okText="应用贴图设置"
      cancelText="取消"
      confirmLoading={saving}
      onCancel={() => {
        if (!saving) onClose();
      }}
      onOk={() => void submit()}
      destroyOnHidden
      styles={{ body: { maxHeight: 'calc(100vh - 168px)', overflow: 'auto' } }}
    >
      <div className="floorImageEditor" data-test-id="floor-image-editor">
        <div className="floorImageEditorConfig">
          <CollectionControl
            items={draft}
            disabled={saving}
            emptyText="尚未配置楼层贴图"
            createLabel="添加贴图"
            reorderMode="drag"
            selectedIndex={selectedIndex}
            renderItem={(item) =>
              isEditableFloorImage(item) ? (
                <div className="floorImageListItem">
                  <Image size={15} aria-hidden="true" />
                  <span title={item.name}>{item.name}</span>
                  <small>
                    {String(item.canvas ?? 'bg')} · ({finite(item.x)}, {finite(item.y)})
                  </small>
                </div>
              ) : (
                <span className="schemaTableError">无效贴图项</span>
              )
            }
            onSelect={setSelectedIndex}
            onCreate={() => setImagePicker({ index: null })}
            onRemove={(index) => {
              setDraft((items) => items.filter((_item, itemIndex) => itemIndex !== index));
              setSelectedIndex((current) =>
                current === index ? Math.min(index, draft.length - 2) : current > index ? current - 1 : current,
              );
            }}
            onMove={(index, nextIndex) => {
              setDraft((items) => {
                const next = [...items];
                const [moved] = next.splice(index, 1);
                if (moved !== undefined) next.splice(nextIndex, 0, moved);
                return next;
              });
              setSelectedIndex((current) => {
                if (current === index) return nextIndex;
                if (index < nextIndex && current > index && current <= nextIndex) return current - 1;
                if (nextIndex < index && current >= nextIndex && current < index) return current + 1;
                return current;
              });
            }}
          />

          {selectedIndex >= 0 && selected != null ? (
            <div className="floorImageProperties">
              {isRecord(selected) ? (
                <>
                  <label className="wide">
                    图片
                    <button
                      type="button"
                      className="floorImageSelectButton"
                      onClick={() => setImagePicker({ index: selectedIndex })}
                    >
                      <Image size={15} aria-hidden="true" />
                      <span>{typeof selected.name === 'string' && selected.name ? selected.name : '选择图片'}</span>
                      <small>更换</small>
                    </button>
                  </label>
                  <label>
                    图层
                    <Select
                      value={selected.canvas === 'auto' || selected.canvas === 'fg' ? selected.canvas : 'bg'}
                      options={[
                        { value: 'bg', label: '背景层' },
                        { value: 'auto', label: '自动分层' },
                        { value: 'fg', label: '前景层' },
                      ]}
                      onChange={(value) => setProperty(selectedIndex, 'canvas', value)}
                    />
                  </label>
                  <label>
                    翻转
                    <Select
                      value={typeof selected.reverse === 'string' ? selected.reverse : ''}
                      options={[
                        { value: '', label: '不翻转' },
                        { value: ':x', label: '水平' },
                        { value: ':y', label: '垂直' },
                        { value: ':o', label: '中心' },
                      ]}
                      onChange={(value) => setProperty(selectedIndex, 'reverse', value)}
                    />
                  </label>
                  <label>
                    X
                    <InputNumber
                      value={finite(selected.x)}
                      onChange={(value) => setProperty(selectedIndex, 'x', value ?? 0)}
                    />
                  </label>
                  <label>
                    Y
                    <InputNumber
                      value={finite(selected.y)}
                      onChange={(value) => setProperty(selectedIndex, 'y', value ?? 0)}
                    />
                  </label>
                  <label>
                    帧数
                    <InputNumber
                      min={1}
                      precision={0}
                      placeholder="自动"
                      value={typeof selected.frame === 'number' ? selected.frame : undefined}
                      onChange={(value) => setProperty(selectedIndex, 'frame', value ?? undefined)}
                    />
                  </label>
                  <label className="wide floorImageDisable">
                    <Checkbox
                      checked={selected.disable === true || selected.disabled === true}
                      onChange={(event) => {
                        updateItem(selectedIndex, (item) => {
                          const next = { ...item };
                          delete next.disabled;
                          if (event.target.checked) next.disable = true;
                          else delete next.disable;
                          return next;
                        });
                      }}
                    />
                    初始禁用
                  </label>
                </>
              ) : (
                <RawFloorImageItem
                  value={selected}
                  onChange={(value) =>
                    setDraft((items) => items.map((item, index) => (index === selectedIndex ? value : item)))
                  }
                />
              )}
            </div>
          ) : null}
        </div>

        <div className="floorImagePreviewPanel">
          <div className="floorImagePreviewTitle">地图效果预览</div>
          <div className="floorImagePreviewHint">点击贴图可选中；拖动贴图会实时修改 X、Y。</div>
          <div className="floorImagePreviewStage" style={{ width: previewSize, height: previewSize }}>
            <FloorThumbnail
              floorId={floorId}
              floorOverride={previewFloor}
              bigmap
              viewportSize={[previewSize, previewSize]}
              style={{ position: 'absolute', inset: 0, margin: 0, pointerEvents: 'none' }}
            />
            <div className="floorImageHitboxes">
              {draft.map((item, index) =>
                isEditableFloorImage(item) ? (
                  <FloorImageHitbox
                    key={index}
                    item={item}
                    index={index}
                    selected={selectedIndex === index}
                    floor={floor}
                    nameMap={nameMap}
                    previewSize={previewSize}
                    onSelect={setSelectedIndex}
                    onMove={(itemIndex, x, y) => {
                      updateItem(itemIndex, (current) => ({ ...current, x, y }));
                    }}
                  />
                ) : null,
              )}
            </div>
          </div>
          {saveError ? <div className="schemaTableError">{saveError}</div> : null}
        </div>
      </div>
      {imagePicker ? (
        <Suspense
          fallback={
            <Modal title="加载图片" open footer={null} onCancel={() => setImagePicker(null)} destroyOnHidden>
              <div className="floorImageAssetLoading">正在读取图片资源...</div>
            </Modal>
          }
        >
          <ImageAssetPickerModal
            title={imagePicker.index == null ? '添加楼层贴图' : '选择或裁剪图片'}
            initial={imagePickerInitialSelection}
            crop
            onClose={() => setImagePicker(null)}
            onConfirm={(selection) => {
              if (imagePicker.index == null) {
                const nextIndex = draft.length;
                setDraft((items) => [...items, applyImageSelection({ canvas: 'bg', x: 0, y: 0 }, selection)]);
                setSelectedIndex(nextIndex);
              } else {
                updateItem(imagePicker.index, (item) => applyImageSelection(item, selection));
              }
              setImagePicker(null);
            }}
          />
        </Suspense>
      ) : null}
    </Modal>
  );
};

export const FloorImagesFieldEditor: FC<FloorImagesFieldEditorProps> = ({
  schema,
  value,
  disabled,
  scope,
  onCommit,
}) => {
  const descriptor = schema.editor;
  const [open, setOpen] = useState(false);
  if (descriptor.kind !== 'floorImages') return null;
  const floorIdResult = evaluateExpression(descriptor.floorId, scope);
  const floorId =
    floorIdResult.status === 'ready' && typeof floorIdResult.value === 'string' ? floorIdResult.value : undefined;
  const items = Array.isArray(value) ? value : [];

  return (
    <>
      <div className="schemaTableExternalValue floorImagesFieldValue">
        <span>{items.length > 0 ? `${items.length} 张贴图` : '未设置贴图'}</span>
        <button type="button" disabled={disabled || !floorId} onClick={() => setOpen(true)}>
          预览编辑
        </button>
      </div>
      {!floorId ? <div className="schemaTableError">无法解析当前楼层 ID</div> : null}
      {open && floorId ? (
        <FloorImageEditorModal
          floorId={floorId}
          initialValue={items}
          onClose={() => setOpen(false)}
          onConfirm={onCommit}
        />
      ) : null}
    </>
  );
};
