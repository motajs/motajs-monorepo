import { useImageAssetUrl } from '@/hooks/useImageAssetUrl';
import { useModelResourceSuspense } from '@/hooks/suspense';
import { projectModel, TILESET_START_OFFSET, type BlockRegistry } from '@/project/model/projectModel';
import { useMemo, useState, type FC } from 'react';

type Direction = 'up' | 'down' | 'left' | 'right';
type PassabilitySide = 'cannotOut' | 'cannotIn';

export interface PassabilityEditingValue {
  cannotOut: string[];
  cannotIn: string[];
}

interface PassabilityFieldEditorProps {
  value: unknown;
  block?: string | number;
  disabled?: boolean;
  onCommit(value: PassabilityEditingValue): Promise<void>;
}

const directions: Direction[] = ['up', 'right', 'down', 'left'];
const labels: Record<Direction, string> = { up: '上', right: '右', down: '下', left: '左' };

interface BlockFrame {
  path: string;
  sourceX: number;
  sourceY: number;
}

function resolveRegistryBlockFrame(idnum: number, blocks: BlockRegistry): BlockFrame | undefined {
  const block = blocks.get(idnum);
  if (!block?.materialPath || typeof block.y !== 'number') return undefined;
  const height = block.images?.endsWith('48') ? 48 : 32;
  return {
    path: block.materialPath,
    sourceX: (block.x ?? 0) * 32,
    sourceY: block.y * height + height - 32,
  };
}

const BlockFrameImage: FC<{ frame: BlockFrame }> = ({ frame }) => {
  const { url } = useImageAssetUrl(frame.path);
  return url ? (
    <span className="schemaPassabilitySprite">
      <img
        src={url}
        alt=""
        draggable={false}
        style={{
          left: -frame.sourceX * 2,
          top: -frame.sourceY * 2,
          transform: 'scale(2)',
          transformOrigin: 'top left',
        }}
      />
    </span>
  ) : (
    <span>…</span>
  );
};

const RegistryBlockPreview: FC<{ block: string | number }> = ({ block }) => {
  const blockResource = useMemo(() => projectModel.blockRegistry(), []);
  const blocks = useModelResourceSuspense(blockResource);
  const idnum =
    typeof block === 'number' ? block : [...blocks.values()].find((candidate) => candidate.id === block)?.idnum;
  const frame = useMemo(() => (idnum == null ? undefined : resolveRegistryBlockFrame(idnum, blocks)), [blocks, idnum]);
  return frame ? <BlockFrameImage frame={frame} /> : <span>?</span>;
};

const TilesetBlockPreview: FC<{ idnum: number }> = ({ idnum }) => {
  const tilesetResource = useMemo(() => projectModel.tilesetCatalog(), []);
  const tilesets = useModelResourceSuspense(tilesetResource);
  const frame = useMemo(() => {
    const entry = tilesets.entries.find((candidate) => {
      const local = idnum - candidate.startIdnum;
      return local >= 0 && local < candidate.columns * candidate.rows;
    });
    if (!entry) return undefined;
    const local = idnum - entry.startIdnum;
    return {
      path: entry.path,
      sourceX: (local % entry.columns) * 32,
      sourceY: Math.floor(local / entry.columns) * 32,
    };
  }, [idnum, tilesets]);
  return frame ? <BlockFrameImage frame={frame} /> : <span>?</span>;
};

const PassabilityBlockPreview: FC<{ block: string | number }> = ({ block }) =>
  typeof block === 'number' && block >= TILESET_START_OFFSET ? (
    <TilesetBlockPreview idnum={block} />
  ) : (
    <RegistryBlockPreview block={block} />
  );

function editingValue(value: unknown): PassabilityEditingValue {
  const record =
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Partial<PassabilityEditingValue>) : {};
  return {
    cannotOut: Array.isArray(record.cannotOut) ? [...record.cannotOut] : [],
    cannotIn: Array.isArray(record.cannotIn) ? [...record.cannotIn] : [],
  };
}

export const PassabilityFieldEditor: FC<PassabilityFieldEditorProps> = ({ value, block, disabled, onCommit }) => {
  const [draft, setDraft] = useState(() => editingValue(value));

  const toggle = async (side: PassabilitySide, direction: Direction) => {
    if (disabled) return;
    const current = draft[side];
    const nextList = current.includes(direction)
      ? current.filter((item) => item !== direction)
      : [...current, direction];
    const next = { ...draft, [side]: nextList };
    setDraft(next);
    await onCommit(next);
  };
  const unknown = [...new Set([...draft.cannotOut, ...draft.cannotIn])].filter(
    (item) => !directions.includes(item as Direction),
  );

  return (
    <div className="schemaPassabilityEditor">
      <div className="schemaPassabilityDiagram" aria-label="图块出入通行方向">
        <div className="schemaPassabilityTile">
          {block == null ? <span>?</span> : <PassabilityBlockPreview block={block} />}
        </div>
        {directions.flatMap((direction) =>
          (['cannotIn', 'cannotOut'] as PassabilitySide[]).map((side) => {
            const blocked = draft[side].includes(direction);
            const sideLabel = side === 'cannotOut' ? '内侧（出）' : '外侧（入）';
            const stateLabel = blocked ? '禁止' : '允许';
            return (
              <button
                key={`${direction}:${side}`}
                type="button"
                className={`schemaPassabilityEdge ${direction} ${side === 'cannotOut' ? 'inner' : 'outer'}${blocked ? ' blocked' : ''}`}
                aria-label={`${labels[direction]}边${sideLabel}：${stateLabel}`}
                title={`${labels[direction]}边${sideLabel}：${stateLabel}，点击切换`}
                disabled={disabled}
                onClick={() => void toggle(side, direction)}
              />
            );
          }),
        )}
      </div>
      <div className="schemaPassabilityLegend">
        <span>
          <i className="inner" />
          内侧控制出
        </span>
        <span>
          <i className="outer" />
          外侧控制入
        </span>
        <span>
          <i className="blocked" />
          红色表示禁止
        </span>
      </div>
      {unknown.length > 0 ? (
        <div className="schemaTableDiagnostic warning">其他方向值：{unknown.join('、')}</div>
      ) : null}
    </div>
  );
};
