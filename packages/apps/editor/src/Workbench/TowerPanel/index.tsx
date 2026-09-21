import {
  ConstantValueSource,
  ContentValueSource,
  ObjectReferenceRoot,
  ProjectSchemaTable,
  RegistryReferenceRoot,
  SchemaCustomizationButton,
  type RawSlot,
  type ReferenceUpdate,
  type SchemaScope,
  type ValueSource,
} from '@/components/SchemaTable';
import { towerSchemaDefinition } from '@/components/SchemaTable/builtinSchemas';
import { EditModeSegmented, Table, type CommentObject } from '@/components/Table';
import type { EditMode, TableAction } from '@/components/Table/types';
import type { Content } from '@/fs/types';
import { useTableMetaSuspense, useTowerDataSuspense } from '@/hooks';
import { useResourceSuspense } from '@/hooks/suspense';
import { projectAssets, type AssetDirectorySnapshot } from '@/project/assets';
import { tableCommands } from '@/project/commands';
import { projectData } from '@/project/data/projectData';
import { buildTowerDiagnostics } from '@/project/model/towerDiagnostics';
import type { Action } from '@/utils/action';
import { buildFieldPath } from '@/utils/fieldPath';
import { notifyCommandResult, notifyError, notifySuccess } from '@/utils/notify';
import { Anchor, Segmented } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react';
import { ContentLeftTab } from '../components/ContentLeftTab';
import './tower-panel.css';

const TOWER_GROUPS = [
  ['tower-project', '工程信息'],
  ['tower-structure', '游戏结构'],
  ['tower-opening', '标题与开场'],
  ['tower-hero', '初始勇士'],
  ['tower-values', '系统数值'],
  ['tower-status', '状态栏'],
  ['tower-flags', '系统开关'],
  ['tower-styles', '主样式'],
  ['tower-rest', '其他字段'],
] as const;

type TowerTableVersion = 'schema' | 'legacy';

function processMainFields(data: Record<string, unknown>, commentObj: CommentObject): Record<string, unknown> {
  const result = { ...data, main: {} };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mainCommentData = (commentObj as any)?._data?.main?._data;
  const dataMain = data.main as Record<string, unknown> | undefined;
  if (mainCommentData && typeof mainCommentData === 'object') {
    const mainData: Record<string, unknown> = {};
    for (const key of Object.keys(mainCommentData)) {
      mainData[key] = dataMain && key in dataMain ? dataMain[key] : null;
    }
    result.main = mainData;
  }
  return result;
}

const LegacyTowerTable: FC<{ editMode: EditMode }> = ({ editMode }) => {
  const [tower] = useTowerDataSuspense();
  const meta = useTableMetaSuspense('dataComment');
  const data = useMemo(() => processMainFields(tower as unknown as Record<string, unknown>, meta), [meta, tower]);
  const handleChange = useCallback(async (action: TableAction) => {
    try {
      const result = await tableCommands.patchTower([action as Action]);
      notifyCommandResult(result, '保存成功！');
    } catch (error) {
      notifyError(error);
    }
  }, []);
  return <Table data={data} commentObj={meta} onChange={handleChange} editMode={editMode} />;
};

function mapDirectory(content: Content<AssetDirectorySnapshot>, accept: (name: string) => boolean): Content<string[]> {
  if (content.status !== 'loaded') return content;
  return { status: 'loaded', value: content.value.entries.filter(accept) };
}

function useResponsiveColumns(ref: React.RefObject<HTMLElement | null>): 1 | 2 | 3 {
  const [columns, setColumns] = useState<1 | 2 | 3>(1);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const update = (width: number) => setColumns(width >= 1400 ? 3 : width >= 900 ? 2 : 1);
    update(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return columns;
}

const TowerSchemaWorkspace: FC = () => {
  const [tower] = useTowerDataSuspense();
  const [items] = useResourceSuspense(projectData.items());
  const contentRef = useRef<HTMLDivElement>(null);
  const columns = useResponsiveColumns(contentRef);
  const imageDirectory = useMemo(() => projectAssets.directory('project/images'), []);
  const bgmDirectory = useMemo(() => projectAssets.directory('project/bgms'), []);
  const imageSource = useMemo(
    () =>
      new ContentValueSource<string[]>(
        'project:materials.images',
        () => mapDirectory(imageDirectory.snapshot(), (name) => /\.(png|jpg|jpeg|gif)$/i.test(name)),
        (listener) => imageDirectory.subscribe(listener),
        () => imageDirectory.ensureLoaded(),
        () => imageDirectory.reload(),
      ),
    [imageDirectory],
  );
  const bgmSource = useMemo(
    () =>
      new ContentValueSource<string[]>(
        'project:materials.bgms',
        () => mapDirectory(bgmDirectory.snapshot(), (name) => /\.(mp3|ogg|wav|m4a|flac)$/i.test(name)),
        (listener) => bgmDirectory.subscribe(listener),
        () => bgmDirectory.ensureLoaded(),
        () => bgmDirectory.reload(),
      ),
    [bgmDirectory],
  );

  const scope = useMemo<SchemaScope>(() => {
    const updatesToActions = (updates: readonly ReferenceUpdate[]): Action[] =>
      updates.map(({ path, slot }) =>
        slot.present
          ? ['change', buildFieldPath([...path]), slot.value]
          : ['delete', buildFieldPath([...path]), undefined],
      );
    const writeBatch = async (updates: readonly ReferenceUpdate[]) => {
      if (updates.some((update) => update.path.length === 0)) {
        throw new Error('不能直接替换整个全塔数据对象');
      }
      const result = await tableCommands.patchTower(updatesToActions(updates));
      if (!result.ok) throw new Error(`${result.stage}: ${result.error.message}`);
      notifySuccess('保存成功！');
    };
    const write = (path: readonly string[], slot: RawSlot<unknown>) => writeBatch([{ path, slot }]);
    return {
      roots: {
        tower: new ObjectReferenceRoot('tower', () => tower, write, writeBatch),
        project: new RegistryReferenceRoot(
          new Map<string, ValueSource<unknown>>([
            [
              'registry.floorIds',
              new ConstantValueSource('project:registry.floorIds', () => ({
                present: true,
                value: tower.main.floorIds,
              })),
            ],
            [
              'registry.items',
              new ConstantValueSource('project:registry.items', () => ({
                present: true,
                value: items,
              })),
            ],
            ['materials.images', imageSource],
            ['materials.bgms', bgmSource],
          ]),
        ),
      },
    };
  }, [bgmSource, imageSource, items, tower]);
  const diagnostics = useMemo(() => buildTowerDiagnostics(tower), [tower]);

  return (
    <div className="towerWorkspaceBody">
      <aside className="towerAnchor" aria-label="全塔属性目录">
        <Anchor
          affix={false}
          getContainer={() => contentRef.current ?? window}
          items={TOWER_GROUPS.map(([key, title]) => ({ key, href: `#${key}`, title }))}
        />
      </aside>
      <div className="towerSchemaScroll" ref={contentRef} data-test-id="tower-schema-scroll">
        <ProjectSchemaTable
          columns={columns}
          definition={towerSchemaDefinition}
          diagnostics={diagnostics}
          scope={scope}
        />
      </div>
    </div>
  );
};

export const TowerPanel: FC = () => {
  const [tableVersion, setTableVersion] = useState<TowerTableVersion>('schema');
  const [editMode, setEditMode] = useState<EditMode>('change');

  return (
    <section className="towerWorkspace" data-test-id="panel-tower">
      <header className="towerWorkspaceHeader">
        <div>
          <h1>全塔属性</h1>
          <p>工程结构、初始状态、系统数值与界面样式</p>
        </div>
        <div className="towerWorkspaceActions">
          <Segmented
            size="small"
            value={tableVersion}
            onChange={(value) => setTableVersion(value as TowerTableVersion)}
            options={[
              { label: '新版', value: 'schema' },
              { label: '旧版', value: 'legacy' },
            ]}
          />
          {tableVersion === 'legacy' ? (
            <EditModeSegmented value={editMode} onChange={setEditMode} />
          ) : (
            <SchemaCustomizationButton definition={towerSchemaDefinition} />
          )}
        </div>
      </header>
      {tableVersion === 'schema' ? (
        <TowerSchemaWorkspace />
      ) : (
        <div className="towerLegacyWorkspace">
          <ContentLeftTab id="towerLegacy" title="旧版全塔属性">
            <LegacyTowerTable editMode={editMode} />
          </ContentLeftTab>
        </div>
      )}
    </section>
  );
};
