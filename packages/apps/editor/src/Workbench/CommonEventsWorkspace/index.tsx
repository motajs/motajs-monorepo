import { useResourceSuspense } from '@/hooks/suspense';
import { tableCommands } from '@/project/commands';
import { projectData } from '@/project/data/projectData';
import { buildFieldPath } from '@/utils/fieldPath';
import { notifyCommandResult, notifyError } from '@/utils/notify';
import { Input, Modal } from 'antd';
import { Circle, Plus, Trash2 } from 'lucide-react';
import { isEqual } from 'es-toolkit';
import JSON5 from 'json5';
import { useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react';
import { useEventEditor } from '../EventsEditor/EventEditorContext';
import { setWorkspaceDraftDirty } from '../draftGuard';
import './common-events-workspace.css';

function askName(title: string, initialValue = ''): Promise<string | undefined> {
  return new Promise((resolve) => {
    let value = initialValue;
    Modal.confirm({
      title,
      icon: null,
      content: (
        <Input
          autoFocus
          defaultValue={initialValue}
          onChange={(event) => {
            value = event.target.value;
          }}
        />
      ),
      okText: '确定',
      cancelText: '取消',
      onOk: () => resolve(value.trim()),
      onCancel: () => resolve(undefined),
    });
  });
}

export const CommonEventsWorkspace: FC = () => {
  const [events] = useResourceSuspense(projectData.commonEvents());
  const editor = useEventEditor();
  const names = useMemo(() => Object.keys(events), [events]);
  const [selected, setSelected] = useState<string>(() => names[0] ?? '');
  const activeSelected =
    selected && Object.prototype.hasOwnProperty.call(events, selected) ? selected : (names[0] ?? '');
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const draftsRef = useRef(drafts);
  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    if (!activeSelected) return;
    editor.open({
      contextId: `common-event-workspace:${activeSelected}`,
      entryType: 'commonEvent',
      initialValue: draftsRef.current[activeSelected] ?? events[activeSelected] ?? [],
      onDraftChange: (value) => {
        let normalized = value;
        if (typeof value === 'string') {
          try {
            normalized = JSON5.parse(value);
          } catch {
            /* 保留尚未解析的源码草稿。 */
          }
        }
        setDrafts((current) => {
          if (!isEqual(normalized, events[activeSelected])) return { ...current, [activeSelected]: normalized };
          if (!Object.prototype.hasOwnProperty.call(current, activeSelected)) return current;
          const next = { ...current };
          delete next[activeSelected];
          return next;
        });
      },
      onConfirm: async (value) => {
        const result = await tableCommands.patchCommonEvents([['change', buildFieldPath([activeSelected]), value]]);
        if (!result.ok) throw result.error;
        setDrafts((current) => {
          const next = { ...current };
          delete next[activeSelected];
          return next;
        });
        notifyCommandResult(result, '公共事件已保存');
      },
    });
  }, [activeSelected, editor, events]);

  useEffect(() => {
    setWorkspaceDraftDirty('common-events', Object.keys(drafts).length > 0);
  }, [drafts]);

  const add = useCallback(async () => {
    const name = await askName('新增公共事件');
    if (!name) return;
    if (Object.prototype.hasOwnProperty.call(events, name)) {
      notifyError('公共事件名称不能重复');
      return;
    }
    const result = await tableCommands.patchCommonEvents([['add', buildFieldPath([name]), []]]);
    notifyCommandResult(result, '公共事件已新增');
    if (result.ok) setSelected(name);
  }, [events]);

  const rename = useCallback(
    async (name: string) => {
      const nextName = await askName('重命名公共事件', name);
      if (!nextName || nextName === name) return;
      if (Object.prototype.hasOwnProperty.call(events, nextName)) {
        notifyError('公共事件名称不能重复');
        return;
      }
      const result = await tableCommands.patchCommonEvents([
        ['add', buildFieldPath([nextName]), events[name]],
        ['delete', buildFieldPath([name]), undefined],
      ]);
      notifyCommandResult(result, '公共事件已重命名');
      if (result.ok) {
        setDrafts((current) => {
          if (!Object.prototype.hasOwnProperty.call(current, name)) return current;
          const next = { ...current, [nextName]: current[name] };
          delete next[name];
          return next;
        });
        setSelected(nextName);
      }
    },
    [events],
  );

  const remove = useCallback(
    (name: string) => {
      Modal.confirm({
        title: `删除公共事件“${name}”？`,
        content: drafts[name] !== undefined ? '这个事件还有未保存草稿，删除后草稿也会丢失。' : undefined,
        okButtonProps: { danger: true },
        okText: '删除',
        cancelText: '取消',
        onOk: async () => {
          const result = await tableCommands.patchCommonEvents([['delete', buildFieldPath([name]), undefined]]);
          notifyCommandResult(result, '公共事件已删除');
          if (result.ok) {
            setDrafts((current) => {
              const next = { ...current };
              delete next[name];
              return next;
            });
          }
        },
      });
    },
    [drafts],
  );

  return (
    <div className="commonEventsWorkspace" data-test-id="common-events-workspace">
      <aside className="commonEventList">
        <header>
          <h1>公共事件</h1>
          <button aria-label="新增公共事件" onClick={() => void add()}>
            <Plus size={16} />
          </button>
        </header>
        {names.map((name) => (
          <div className={activeSelected === name ? 'commonEventItem is-active' : 'commonEventItem'} key={name}>
            <button
              className="commonEventSelect"
              onClick={() => setSelected(name)}
              onDoubleClick={() => void rename(name)}
            >
              <span>{name}</span>
              {drafts[name] !== undefined ? (
                <i title="未保存">
                  <Circle fill="currentColor" size={12} strokeWidth={0} />
                </i>
              ) : null}
            </button>
            <button aria-label={`删除${name}`} className="commonEventDelete" onClick={() => remove(name)}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </aside>
      <main className="commonEventEditorPane">
        {activeSelected ? (
          <div id="common-event-editor-host" />
        ) : (
          <div className="commonEventEmpty">新建或选择一个公共事件</div>
        )}
      </main>
    </div>
  );
};
