import { useImageAssetUrl } from "@/hooks/useImageAssetUrl";
import { useModelResourceSuspense } from "@/hooks/suspense";
import { projectModel, type ProjectImageEntry } from "@/project/model/projectModel";
import { Input, InputNumber, Modal } from "antd";
import {
  type FC,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface ImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageAssetSelection {
  name: string;
  crop?: ImageCrop;
  preserveCrop?: boolean;
}

export interface ImageAssetPickerInitial {
  name: string;
  path?: string;
  crop?: ImageCrop;
}

interface ImageAssetPickerModalProps {
  title: string;
  okText?: string;
  initial?: ImageAssetPickerInitial;
  includeLogical?: boolean;
  crop?: boolean;
  accept?: (entry: ProjectImageEntry) => boolean;
  onClose(): void;
  onConfirm(selection: ImageAssetSelection): void;
}

const CatalogImage: FC<{
  entry: ProjectImageEntry;
  className?: string;
}> = ({ entry, className }) => {
  const { url } = useImageAssetUrl(entry.path);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!url || !entry.crop || !canvasRef.current) return;
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = entry.crop?.width ?? 1;
      canvas.height = entry.crop?.height ?? 1;
      if (!entry.crop) return;
      canvas.getContext("2d")?.drawImage(
        image,
        entry.crop.x,
        entry.crop.y,
        entry.crop.width,
        entry.crop.height,
        0,
        0,
        entry.crop.width,
        entry.crop.height,
      );
    };
    image.src = url;
  }, [entry.crop, url]);
  if (!url) return <span>加载中</span>;
  if (entry.crop) return <canvas ref={canvasRef} className={className} />;
  return <img className={className} src={url} alt="" draggable={false} />;
};

const ImageAssetTile: FC<{
  entry: ProjectImageEntry;
  selected: boolean;
  onSelect(): void;
  onConfirm(): void;
}> = ({ entry, selected, onSelect, onConfirm }) => (
  <button
    type="button"
    className={`floorImageAssetTile${selected ? " selected" : ""}`}
    data-test-id={`image-asset-option-${entry.name}`}
    title={entry.name}
    onClick={onSelect}
    onDoubleClick={(event) => {
      event.preventDefault();
      onConfirm();
    }}
  >
    <span className="floorImageAssetThumbnail">
      <CatalogImage entry={entry} />
    </span>
    <span>{entry.name}</span>
  </button>
);

const ImageCropPreview: FC<{
  path: string;
  crop?: ImageCrop;
  onCropChange(crop?: ImageCrop): void;
}> = ({ path, crop, onCropChange }) => {
  const { url } = useImageAssetUrl(path);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const maxWidth = 520;
  const maxHeight = 390;
  const scale = natural.width > 0 && natural.height > 0
    ? Math.min(maxWidth / natural.width, maxHeight / natural.height)
    : 1;
  const displayWidth = Math.max(1, Math.round(natural.width * scale));
  const displayHeight = Math.max(1, Math.round(natural.height * scale));

  const point = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(natural.width - 1, Math.floor((event.clientX - rect.left) / scale))),
      y: Math.max(0, Math.min(natural.height - 1, Math.floor((event.clientY - rect.top) / scale))),
    };
  };
  const updateCrop = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start) return;
    const current = point(event);
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    onCropChange({
      x,
      y,
      width: Math.max(1, Math.abs(current.x - start.x) + 1),
      height: Math.max(1, Math.abs(current.y - start.y) + 1),
    });
  };
  const endCrop = (event: ReactPointerEvent<HTMLDivElement>) => {
    updateCrop(event);
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="floorImageCropEditor">
      <div className="floorImageCropHint">在图片上拖拽框选裁剪区域；未框选时使用完整图片。</div>
      <div className="floorImageCropStage" style={{ width: displayWidth, height: displayHeight }}>
        {url ? (
          <img
            src={url}
            alt="图片预览"
            draggable={false}
            style={{ width: displayWidth, height: displayHeight }}
            onLoad={(event) => setNatural({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })}
          />
        ) : <span className="floorImageCropLoading">正在加载预览...</span>}
        {natural.width > 0 ? (
          <div
            className="floorImageCropInteraction"
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              const start = point(event);
              dragRef.current = start;
              onCropChange({ x: start.x, y: start.y, width: 1, height: 1 });
            }}
            onPointerMove={updateCrop}
            onPointerUp={endCrop}
            onPointerCancel={endCrop}
          >
            {crop ? (
              <div
                className="floorImageCropRect"
                style={{
                  left: crop.x * scale,
                  top: crop.y * scale,
                  width: crop.width * scale,
                  height: crop.height * scale,
                }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      {crop ? (
        <div className="floorImageCropControls">
          {(["x", "y", "width", "height"] as const).map((key) => (
            <label key={key}>
              {key === "x" ? "X" : key === "y" ? "Y" : key === "width" ? "宽" : "高"}
              <InputNumber
                min={key === "width" || key === "height" ? 1 : 0}
                precision={0}
                value={crop[key]}
                onChange={(value) => {
                  const numeric = Number(value) || (key === "width" || key === "height" ? 1 : 0);
                  if (key === "x") onCropChange({ ...crop, x: Math.max(0, Math.min(natural.width - 1, numeric)) });
                  else if (key === "y") onCropChange({ ...crop, y: Math.max(0, Math.min(natural.height - 1, numeric)) });
                  else if (key === "width") onCropChange({ ...crop, width: Math.max(1, Math.min(natural.width - crop.x, numeric)) });
                  else onCropChange({ ...crop, height: Math.max(1, Math.min(natural.height - crop.y, numeric)) });
                }}
              />
            </label>
          ))}
          <button type="button" onClick={() => onCropChange(undefined)}>使用完整图片</button>
        </div>
      ) : null}
    </div>
  );
};

export const ImageAssetPickerModal: FC<ImageAssetPickerModalProps> = ({
  title,
  okText = "使用此图片",
  initial,
  includeLogical = false,
  crop: cropEnabled = false,
  accept,
  onClose,
  onConfirm,
}) => {
  const imageResource = useMemo(() => projectModel.projectImageCatalog(), []);
  const catalog = useModelResourceSuspense(imageResource);
  const entries = useMemo(
    () => catalog.entries.filter((entry) => (
      (includeLogical || entry.kind === "physical") && (accept?.(entry) ?? true)
    )),
    [accept, catalog.entries, includeLogical],
  );
  const initialName = initial?.name ?? entries[0]?.name ?? "";
  const [selectedName, setSelectedName] = useState(initialName);
  const [crop, setCrop] = useState<ImageCrop | undefined>(() => cropEnabled ? initial?.crop : undefined);
  const [cropTouched, setCropTouched] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = entries.filter((entry) => entry.name.toLowerCase().includes(query.trim().toLowerCase()));
  const selectedEntry = entries.find((entry) => entry.name === selectedName);
  const selectedPath = selectedEntry?.path ?? initial?.path ?? `project/images/${selectedName}`;
  const confirm = (name = selectedName) => {
    if (!name) return;
    if (!cropEnabled) {
      onConfirm({ name });
      return;
    }
    const sameSelection = name === selectedName;
    onConfirm({
      name,
      crop: sameSelection ? crop : undefined,
      preserveCrop: !cropTouched && name === initialName,
    });
  };

  return (
    <Modal
      title={title}
      open
      width={940}
      style={{ top: 48 }}
      okText={okText}
      cancelText="取消"
      okButtonProps={{ disabled: !selectedName }}
      onCancel={onClose}
      onOk={() => confirm()}
      destroyOnHidden
    >
      <div className="floorImageAssetPicker" data-test-id="image-asset-picker">
        <div className="floorImageAssetBrowser">
          <Input
            allowClear
            placeholder="搜索图片"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="floorImageAssetGrid">
            {filtered.map((entry) => (
              <ImageAssetTile
                key={entry.name}
                entry={entry}
                selected={entry.name === selectedName}
                onSelect={() => {
                  if (entry.name === selectedName) return;
                  setSelectedName(entry.name);
                  setCrop(undefined);
                  setCropTouched(true);
                }}
                onConfirm={() => confirm(entry.name)}
              />
            ))}
          </div>
        </div>
        <div className="floorImageAssetPreview">
          <div className="floorImageAssetPreviewTitle">{selectedName || "请选择图片"}</div>
          {selectedName && cropEnabled ? (
            <ImageCropPreview
              path={selectedPath}
              crop={crop}
              onCropChange={(nextCrop) => {
                setCrop(nextCrop);
                setCropTouched(true);
              }}
            />
          ) : null}
          {selectedEntry && !cropEnabled ? (
            <div className="floorImageStaticPreview" data-test-id="image-asset-static-preview">
              <CatalogImage entry={selectedEntry} />
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
};
