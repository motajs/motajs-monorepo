import { useImageAssetUrl } from '@/hooks/useImageAssetUrl';
import { useResourceSuspense, useTowerDataSuspense } from '@/hooks/suspense';
import { projectAssets } from '@/project/assets';
import { materialCommands, tableCommands } from '@/project/commands';
import { projectData } from '@/project/data/projectData';
import { projectModel, type ProjectImageEntry } from '@/project/model/projectModel';
import type { TowerData } from '@/services/tower';
import { useSignal } from '@/hooks/useFs';
import { notifyCommandResult, notifyError, notifySuccess } from '@/utils/notify';
import { Checkbox, Input, InputNumber, Modal } from 'antd';
import {
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FolderOpen,
  GripVertical,
  Image as ImageIcon,
  Music,
  Puzzle,
  Shapes,
  Volume2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FC, type ReactNode } from 'react';
import { AppendPicPanel } from '../AppendPicPanel';
import './resources-workspace.css';

type ResourcePageId =
  'images' | 'bgms' | 'sounds' | 'animates' | 'fonts' | 'tilesets' | 'autotiles' | 'materials' | 'append';

interface DirectoryDescriptor {
  id: ResourcePageId;
  label: string;
  path: string;
  registry?: keyof TowerData['main'];
  accept(name: string): boolean;
  toRegistry?(name: string): string;
  fromRegistry?(name: string): string;
  kind: 'image' | 'audio' | 'animation' | 'font' | 'file';
}

interface ResourceSelection {
  descriptor: DirectoryDescriptor;
  name: string;
  splitEntry?: ProjectImageEntry;
}

const DIRECTORIES: Record<string, DirectoryDescriptor> = {
  images: {
    id: 'images',
    label: '图片',
    path: 'project/images',
    registry: 'images',
    accept: (name) => /\.(png|jpe?g|gif)$/i.test(name),
    kind: 'image',
  },
  bgms: {
    id: 'bgms',
    label: '背景音乐',
    path: 'project/bgms',
    registry: 'bgms',
    accept: (name) => /\.(mp3|ogg|wav|m4a|flac)$/i.test(name),
    kind: 'audio',
  },
  sounds: {
    id: 'sounds',
    label: '音效',
    path: 'project/sounds',
    registry: 'sounds',
    accept: (name) => /\.(mp3|ogg|wav|m4a|flac)$/i.test(name),
    kind: 'audio',
  },
  animates: {
    id: 'animates',
    label: '动画',
    path: 'project/animates',
    registry: 'animates',
    accept: (name) => name.endsWith('.animate'),
    toRegistry: (name) => name.replace(/\.animate$/i, ''),
    fromRegistry: (name) => `${name}.animate`,
    kind: 'animation',
  },
  fonts: {
    id: 'fonts',
    label: '字体',
    path: 'project/fonts',
    registry: 'fonts',
    accept: (name) => /\.ttf$/i.test(name),
    toRegistry: (name) => name.replace(/\.ttf$/i, ''),
    fromRegistry: (name) => `${name}.ttf`,
    kind: 'font',
  },
  tilesets: {
    id: 'tilesets',
    label: '瓦片图集',
    path: 'project/tilesets',
    registry: 'tilesets',
    accept: (name) => /\.png$/i.test(name),
    kind: 'image',
  },
  autotiles: {
    id: 'autotiles',
    label: '自动元件',
    path: 'project/autotiles',
    accept: (name) => /\.png$/i.test(name),
    toRegistry: (name) => name.replace(/\.png$/i, ''),
    fromRegistry: (name) => `${name}.png`,
    kind: 'image',
  },
  materials: {
    id: 'materials',
    label: '系统图块',
    path: 'project/materials',
    accept: (name) => /\.png$/i.test(name),
    kind: 'image',
  },
};

const NAV_ITEMS: Array<[ResourcePageId, string, ReactNode]> = [
  ['images', '图片', <ImageIcon size={16} />],
  ['bgms', '背景音乐', <Music size={16} />],
  ['sounds', '音效', <Volume2 size={16} />],
  ['animates', '动画', <FileArchive size={16} />],
  ['fonts', '字体', <FileText size={16} />],
  ['tilesets', '瓦片图集', <Shapes size={16} />],
  ['autotiles', '自动元件', <Puzzle size={16} />],
  ['materials', '系统图块', <FileImage size={16} />],
  ['append', '追加图块', <FolderOpen size={16} />],
];

function useAssetUrl(path: string | undefined, mime: string): string | null {
  const resource = useMemo(() => projectAssets.image(path ?? ''), [path]);
  const content = useSignal(resource.content);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (path && content.status === 'idle') void resource.ensureLoaded();
  }, [content.status, path, resource]);
  useEffect(() => {
    if (content.status !== 'loaded') return undefined;
    const next = URL.createObjectURL(new Blob([new Uint8Array(content.value.bytes)], { type: mime }));
    let active = true;
    queueMicrotask(() => {
      if (active) setUrl(next);
    });
    return () => {
      active = false;
      URL.revokeObjectURL(next);
    };
  }, [content, mime]);
  return url;
}

const ImagePreview: FC<{ path: string; name: string; compact?: boolean }> = ({ path, name, compact }) => {
  const { url } = useImageAssetUrl(path);
  const [size, setSize] = useState('');
  return url ? (
    <img
      className={compact ? 'resourceCardImage' : 'resourceDetailImage'}
      alt={name}
      src={url}
      title={size}
      onLoad={(event) => setSize(`${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}`)}
    />
  ) : (
    <div className="resourcePreviewPlaceholder">
      <FileImage size={compact ? 22 : 38} />
    </div>
  );
};

const SplitImagePreview: FC<{
  entry: ProjectImageEntry;
  compact?: boolean;
}> = ({ entry, compact }) => {
  const { url } = useImageAssetUrl(entry.path);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!url || !entry.crop || !canvasRef.current) return;
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas || !entry.crop) return;
      canvas.width = entry.crop.width;
      canvas.height = entry.crop.height;
      canvas
        .getContext('2d')
        ?.drawImage(
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
  return <canvas className={compact ? 'resourceCardImage' : 'resourceDetailImage'} ref={canvasRef} />;
};

interface SplitDefinition {
  name: string;
  width: number;
  height: number;
  prefix: string;
}

function splitDefinitions(value: unknown): SplitDefinition[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const input = item as Record<string, unknown>;
    return typeof input.name === 'string' &&
      typeof input.width === 'number' &&
      typeof input.height === 'number' &&
      typeof input.prefix === 'string'
      ? [{ name: input.name, width: input.width, height: input.height, prefix: input.prefix }]
      : [];
  });
}

const SplitImageDialog: FC<{
  definition?: SplitDefinition;
  sourceName: string;
  onCancel(): void;
  onSave(definition: SplitDefinition): Promise<void>;
}> = ({ definition, sourceName, onCancel, onSave }) => {
  const [width, setWidth] = useState<number | null>(definition?.width ?? 32);
  const [height, setHeight] = useState<number | null>(definition?.height ?? 32);
  const [prefix, setPrefix] = useState(definition?.prefix ?? `${sourceName.replace(/\.[^.]+$/, '')}_`);
  const [saving, setSaving] = useState(false);
  const valid =
    Number.isInteger(width) &&
    Number(width) > 0 &&
    Number.isInteger(height) &&
    Number(height) > 0 &&
    prefix.trim().length > 0;
  return (
    <Modal
      open
      title={`切分图片：${sourceName}`}
      okText="保存切分"
      cancelText="取消"
      okButtonProps={{ disabled: !valid, loading: saving }}
      onCancel={onCancel}
      onOk={() => {
        if (!valid) return;
        setSaving(true);
        void onSave({ name: sourceName, width: Number(width), height: Number(height), prefix: prefix.trim() })
          .catch(notifyError)
          .finally(() => setSaving(false));
      }}
    >
      <div className="splitImageForm">
        <label>
          <span>小图宽度</span>
          <InputNumber min={1} precision={0} value={width} onChange={setWidth} />
        </label>
        <label>
          <span>小图高度</span>
          <InputNumber min={1} precision={0} value={height} onChange={setHeight} />
        </label>
        <label>
          <span>文件名前缀</span>
          <Input value={prefix} onChange={(event) => setPrefix(event.target.value)} />
        </label>
      </div>
    </Modal>
  );
};

const ResourceDetail: FC<{
  descriptor: DirectoryDescriptor;
  name?: string;
  missing?: boolean;
  splitEntry?: ProjectImageEntry;
  splitDefinition?: SplitDefinition;
  onConfigureSplit?(): void;
  onRemoveSplit?(): void;
}> = ({ descriptor, name, missing, splitEntry, splitDefinition, onConfigureSplit, onRemoveSplit }) => {
  const path = splitEntry?.path ?? (name ? `${descriptor.path}/${name}` : '');
  const audioUrl = useAssetUrl(descriptor.kind === 'audio' ? path : undefined, 'audio/mpeg');
  if (!name) return <div className="resourceDetailEmpty">选择一个文件查看详情</div>;
  return (
    <div className="resourceDetail">
      <h2>{name}</h2>
      <p>{path}</p>
      {splitEntry ? (
        <div className="resourceLogicalNotice">
          逻辑切分图片 · {splitEntry.crop?.width} × {splitEntry.crop?.height}
        </div>
      ) : null}
      {missing ? <div className="resourceMissingNotice">文件已注册，但工程目录中不存在。</div> : null}
      {!missing && descriptor.kind === 'image' && splitEntry ? <SplitImagePreview entry={splitEntry} /> : null}
      {!missing && descriptor.kind === 'image' && !splitEntry ? <ImagePreview path={path} name={name} /> : null}
      {!missing && descriptor.kind === 'audio' && audioUrl ? <audio controls src={audioUrl} /> : null}
      {!missing && descriptor.kind === 'font' ? <div className="resourceFontSample">魔塔 Mota 0123456789</div> : null}
      {!missing && descriptor.kind === 'animation' ? (
        <div className="resourcePreviewPlaceholder">
          <FileArchive size={42} />
          <span>动画文件</span>
        </div>
      ) : null}
      {descriptor.id === 'images' && !missing && !splitEntry && onConfigureSplit ? (
        <div className="resourceDetailActions">
          <button type="button" onClick={onConfigureSplit}>
            {splitDefinition ? '编辑切分' : '创建切分'}
          </button>
          {splitDefinition && onRemoveSplit ? (
            <button type="button" className="danger" onClick={onRemoveSplit}>
              移除切分
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const PersistentResourceDetail: FC<{
  selection: ResourceSelection;
  onRemoved(): void;
}> = ({ selection, onRemoved }) => {
  const directory = useMemo(() => projectAssets.directory(selection.descriptor.path), [selection.descriptor.path]);
  const content = useSignal(directory.content);
  useEffect(() => {
    if (!selection.splitEntry && content.status === 'idle') void directory.ensureLoaded();
  }, [content.status, directory, selection.splitEntry]);
  const exists = selection.splitEntry || content.status !== 'loaded' || content.value.entries.includes(selection.name);
  useEffect(() => {
    if (!exists) onRemoved();
  }, [exists, onRemoved]);
  if (!exists) return <div className="resourceDetailEmpty">选择一个文件查看详情</div>;
  return <ResourceDetail descriptor={selection.descriptor} name={selection.name} splitEntry={selection.splitEntry} />;
};

async function confirmRisk(title: string, content: string): Promise<boolean> {
  return new Promise((resolve) =>
    Modal.confirm({
      title,
      content,
      okText: '继续',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    }),
  );
}

const TilesetOrder: FC<{
  values: string[];
  onChange(values: string[]): Promise<void>;
}> = ({ values, onChange }) => {
  const [dragging, setDragging] = useState<string>();
  if (values.length === 0) return null;
  return (
    <section className="tilesetOrder">
      <h3>已注册顺序</h3>
      <p>拖动会改变瓦片图集 ID 映射，请确认地图引用仍然正确。</p>
      {values.map((name) => (
        <div
          draggable
          className="tilesetOrderItem"
          key={name}
          onDragStart={() => setDragging(name)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            if (!dragging || dragging === name) return;
            const next = values.filter((item) => item !== dragging);
            const bounds = event.currentTarget.getBoundingClientRect();
            const after = event.clientY >= bounds.top + bounds.height / 2;
            const targetIndex = next.indexOf(name);
            next.splice(targetIndex + (after ? 1 : 0), 0, dragging);
            setDragging(undefined);
            void confirmRisk('调整瓦片图集顺序？', '这会改变已有 tileset 图块的数字 ID 映射。').then((confirmed) =>
              confirmed ? onChange(next) : undefined,
            );
          }}
        >
          <GripVertical size={15} />
          {name}
        </div>
      ))}
    </section>
  );
};

const DirectoryPage: FC<{
  descriptor: DirectoryDescriptor;
  selection?: ResourceSelection;
  onSelect(selection: ResourceSelection | undefined): void;
}> = ({ descriptor, selection, onSelect }) => {
  const [tower] = useTowerDataSuspense();
  const directory = useMemo(() => projectAssets.directory(descriptor.path), [descriptor.path]);
  const content = useSignal(directory.content);
  const selected = selection?.descriptor.id === descriptor.id ? selection.name : undefined;
  const [splitEditor, setSplitEditor] = useState<SplitDefinition | 'new'>();
  const [openSplitFolders, setOpenSplitFolders] = useState<Set<string>>(() => new Set());
  const registryQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [maps] = useResourceSuspense(projectData.mapBlocks());
  const imageCatalog = useMemo(() => projectModel.projectImageCatalog(), []);
  const imageCatalogContent = useSignal(imageCatalog.content);

  useEffect(() => {
    if (content.status === 'idle') void directory.ensureLoaded();
  }, [content.status, directory]);
  useEffect(() => {
    if (descriptor.id === 'images' && imageCatalogContent.status === 'idle') {
      void imageCatalog.ensureLoaded();
    }
  }, [descriptor.id, imageCatalog, imageCatalogContent.status]);

  const files = content.status === 'loaded' ? content.value.entries.filter(descriptor.accept) : [];
  const genericRegistered =
    descriptor.registry && Array.isArray(tower.main[descriptor.registry])
      ? (tower.main[descriptor.registry] as unknown[]).filter((item): item is string => typeof item === 'string')
      : [];
  const registered =
    descriptor.id === 'autotiles'
      ? Object.values(maps).flatMap((block) => (block.cls === 'autotile' && block.id ? [block.id] : []))
      : genericRegistered;
  const registryName = (file: string) => descriptor.toRegistry?.(file) ?? file;
  const registeredFiles = registered.map((name) => descriptor.fromRegistry?.(name) ?? name);
  const logicalEntries =
    descriptor.id === 'images' && imageCatalogContent.status === 'loaded'
      ? imageCatalogContent.value.entries.filter((entry) => entry.kind === 'split')
      : [];
  const logicalByName = new Map(logicalEntries.map((entry) => [entry.name, entry]));
  const physicalAndMissingFiles = [
    ...files,
    ...registeredFiles.filter((name) => !files.includes(name) && !logicalByName.has(name)),
  ];
  const definitions = splitDefinitions(tower.main.splitImages);
  const selectedDefinition = selected ? definitions.find((entry) => entry.name === selected) : undefined;
  const displayEntries = physicalAndMissingFiles.flatMap((name) => {
    const definition = definitions.find((item) => item.name === name);
    if (!definition) return [{ kind: 'file' as const, name }];
    const children = logicalEntries.filter((entry) => entry.path === `${descriptor.path}/${name}`);
    return [
      { kind: 'file' as const, name },
      { kind: 'split-folder' as const, name, definition, children },
      ...(openSplitFolders.has(name) ? children.map((entry) => ({ kind: 'file' as const, name: entry.name })) : []),
    ];
  });
  const selectedStillExists =
    !selected || displayEntries.some((entry) => entry.kind === 'file' && entry.name === selected);
  useEffect(() => {
    if (!selectedStillExists) onSelect(undefined);
  }, [onSelect, selectedStillExists]);

  const enqueueRegistryMutation = useCallback(
    async (mutate: (current: string[]) => string[]) => {
      const registry = descriptor.registry;
      if (!registry) return;
      const run = registryQueueRef.current.then(async () => {
        const currentValue = projectData.tower().value().main[registry];
        const current = Array.isArray(currentValue)
          ? currentValue.filter((item): item is string => typeof item === 'string')
          : [];
        const next = mutate(current);
        const result = await tableCommands.patchTower([['change', `['main']['${String(registry)}']`, next]]);
        if (!result.ok) throw result.error;
        notifyCommandResult(result, '资源注册已更新');
      });
      registryQueueRef.current = run.catch(() => undefined);
      try {
        await run;
      } catch (error) {
        notifyError(error);
      }
    },
    [descriptor.registry],
  );

  const mutateRegistry = enqueueRegistryMutation;
  const writeRegistry = useCallback(
    async (next: string[]) => {
      await enqueueRegistryMutation((current) => [
        // Reorder only entries which still exist when this queued mutation runs.
        // Entries concurrently registered after drag start are retained at the end,
        // and entries concurrently removed are not resurrected.
        ...next.filter((item) => current.includes(item)),
        ...current.filter((item) => !next.includes(item)),
      ]);
    },
    [enqueueRegistryMutation],
  );

  const toggle = async (file: string, nextChecked: boolean) => {
    const name = registryName(file);
    if (descriptor.id === 'autotiles') {
      if (nextChecked) {
        notifyCommandResult(await materialCommands.registerAutotile(name.replace(/\.png$/i, '')), '自动元件已注册');
        return;
      }
      const removal = await materialCommands.remove({ images: 'autotile', id: name.replace(/\.png$/i, '') });
      if (!removal.ok && removal.canForce) {
        const confirmed = await confirmRisk('取消注册并删除自动元件？', removal.error.message);
        if (confirmed) {
          const forced = await materialCommands.remove(
            { images: 'autotile', id: name.replace(/\.png$/i, '') },
            { force: true },
          );
          if (!forced.ok) notifyError(forced.error);
          else notifySuccess('自动元件已移除');
        }
      } else if (!removal.ok) notifyError(removal.error);
      else notifySuccess('自动元件已移除');
      return;
    }
    if (!descriptor.registry) return;
    if (!nextChecked && descriptor.id === 'tilesets') {
      const confirmed = await confirmRisk('取消注册瓦片图集？', '这可能改变后续 tileset 的数字 ID 映射。');
      if (!confirmed) return;
    }
    await mutateRegistry((current) =>
      nextChecked ? (current.includes(name) ? current : [...current, name]) : current.filter((item) => item !== name),
    );
  };

  return (
    <div className="resourceBrowser">
      <section className="resourceGridPane">
        <header>
          <h1>{descriptor.label}</h1>
          <span>{files.length} 个文件</span>
        </header>
        {content.status === 'error' ? <div className="resourceError">{content.error.message}</div> : null}
        {content.status === 'not-found' ? <div className="resourceError">目录不存在：{descriptor.path}</div> : null}
        <div className="resourceGrid">
          {displayEntries.map((display) => {
            if (display.kind === 'split-folder') {
              const open = openSplitFolders.has(display.name);
              return (
                <div
                  className={`resourceCard resourceSplitFolder${open ? ' is-open' : ''}`}
                  key={`split-folder:${display.name}`}
                  onClick={() =>
                    setOpenSplitFolders((current) => {
                      const next = new Set(current);
                      if (next.has(display.name)) next.delete(display.name);
                      else next.add(display.name);
                      return next;
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    setOpenSplitFolders((current) => {
                      const next = new Set(current);
                      if (next.has(display.name)) next.delete(display.name);
                      else next.add(display.name);
                      return next;
                    });
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="resourceCardPreview resourceSplitFolderPreview">
                    <FolderOpen size={48} />
                    {display.children[0] ? <SplitImagePreview compact entry={display.children[0]} /> : null}
                  </span>
                  <span className="resourceCardName" title={display.definition.prefix}>
                    {display.definition.prefix}* · {display.children.length} 张
                  </span>
                </div>
              );
            }
            const name = display.name;
            const splitEntry = logicalByName.get(name);
            const missing = !files.includes(name) && !splitEntry;
            const checked = registered.includes(registryName(name));
            return (
              <div
                className={`resourceCard${selected === name ? ' is-selected' : ''}${missing ? ' is-missing' : ''}`}
                data-test-id={`resource-${descriptor.id}-${name}`}
                key={name}
                onClick={() => onSelect({ descriptor, name, splitEntry })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelect({ descriptor, name, splitEntry });
                }}
                role="button"
                tabIndex={0}
              >
                <span className="resourceCardPreview">
                  {!missing && splitEntry ? (
                    <SplitImagePreview compact entry={splitEntry} />
                  ) : !missing && descriptor.kind === 'image' ? (
                    <ImagePreview compact path={`${descriptor.path}/${name}`} name={name} />
                  ) : descriptor.kind === 'audio' ? (
                    <FileAudio size={25} />
                  ) : (
                    <FileText size={25} />
                  )}
                </span>
                <span className="resourceCardName" title={name}>
                  {name}
                </span>
                {!splitEntry && (descriptor.registry || descriptor.id === 'autotiles') ? (
                  <span className="resourceRegister" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      aria-label={`注册 ${name}`}
                      checked={checked}
                      onChange={(event) => void toggle(name, event.target.checked)}
                    />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        {descriptor.id === 'tilesets' ? <TilesetOrder values={registered} onChange={writeRegistry} /> : null}
      </section>
      <aside className="resourceDetailPane">
        {selection && selection.descriptor.id !== descriptor.id ? (
          <PersistentResourceDetail selection={selection} onRemoved={() => onSelect(undefined)} />
        ) : (
          <ResourceDetail
            descriptor={descriptor}
            name={selected}
            missing={selected ? !files.includes(selected) && !logicalByName.has(selected) : false}
            splitEntry={selected ? logicalByName.get(selected) : undefined}
            splitDefinition={selectedDefinition}
            onConfigureSplit={
              selected && files.includes(selected) && /\.png$/i.test(selected)
                ? () => setSplitEditor(selectedDefinition ?? 'new')
                : undefined
            }
            onRemoveSplit={
              selectedDefinition
                ? () => {
                    void confirmRisk('移除图片切分？', `将同时移除由 ${selectedDefinition.name} 生成的逻辑图片。`).then(
                      async (confirmed) => {
                        if (!confirmed) return;
                        const next = definitions.filter((entry) => entry.name !== selectedDefinition.name);
                        notifyCommandResult(
                          await tableCommands.patchTower([['change', "['main']['splitImages']", next]]),
                          '图片切分已移除',
                        );
                      },
                    );
                  }
                : undefined
            }
          />
        )}
      </aside>
      {splitEditor && selected ? (
        <SplitImageDialog
          key={`${selected}:${JSON.stringify(splitEditor)}`}
          sourceName={selected}
          definition={splitEditor === 'new' ? undefined : splitEditor}
          onCancel={() => setSplitEditor(undefined)}
          onSave={async (definition) => {
            const next = [...definitions.filter((entry) => entry.name !== definition.name), definition];
            const result = await tableCommands.patchTower([['change', "['main']['splitImages']", next]]);
            if (!result.ok) throw result.error;
            setSplitEditor(undefined);
            notifySuccess('图片切分已保存');
          }}
        />
      ) : null}
    </div>
  );
};

export const ResourcesWorkspace: FC = () => {
  const [page, setPage] = useState<ResourcePageId>('images');
  const [selection, setSelection] = useState<ResourceSelection>();
  const descriptor = DIRECTORIES[page];
  return (
    <div className="resourcesWorkspace" data-test-id="resources-workspace">
      <aside className="resourceNavigation">
        <h1>资源管理</h1>
        {NAV_ITEMS.map(([id, label, icon]) => (
          <button
            className={page === id ? 'is-active' : ''}
            data-test-id={`resources-nav-${id}`}
            key={id}
            onClick={() => setPage(id)}
            type="button"
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </aside>
      <main className="resourcePage">
        {descriptor ? (
          <DirectoryPage key={descriptor.id} descriptor={descriptor} selection={selection} onSelect={setSelection} />
        ) : null}
        {page === 'append' ? <AppendPicPanel embedded /> : null}
      </main>
    </div>
  );
};
