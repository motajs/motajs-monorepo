import { Button, Input, Modal, Tooltip } from 'antd';
import { GripVertical, Plus, Settings, Trash2 } from 'lucide-react';
import { type FC, useCallback, useEffect, useRef, useState } from 'react';
import {
  saveMapLayerSettings,
  type MapLayerDefinition,
  type MapLayerSettingsState,
  validateMapLayers,
} from '@/project/settings/mapLayerSettings';
import { notifyError, notifySuccess } from '@/utils/notify';

export interface LayerSettingsButtonProps {
  settings: MapLayerSettingsState;
}

function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function nextLayer(layers: readonly MapLayerDefinition[]): MapLayerDefinition {
  const used = new Set(layers.map((layer) => layer.property));
  let index = 1;
  while (used.has(`layer${index}`)) index += 1;
  return { name: `新图层 ${index}`, property: `layer${index}` };
}

export const LayerSettingsButton: FC<LayerSettingsButtonProps> = ({ settings }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MapLayerDefinition[]>(() => settings.layers.map((layer) => ({ ...layer })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const dragIndex = useRef<number | null>(null);

  useEffect(() => {
    if (!open) setDraft(settings.layers.map((layer) => ({ ...layer })));
  }, [open, settings.layers]);

  const show = useCallback(() => {
    setDraft(settings.layers.map((layer) => ({ ...layer })));
    setError(settings.status === 'error' ? settings.error.message : undefined);
    setOpen(true);
  }, [settings]);

  const update = useCallback((index: number, key: keyof MapLayerDefinition, value: string) => {
    setDraft((current) =>
      current.map((layer, currentIndex) => (currentIndex === index ? { ...layer, [key]: value } : layer)),
    );
    setError(undefined);
  }, []);

  const remove = useCallback((index: number) => {
    setDraft((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setError(undefined);
  }, []);

  const save = useCallback(async () => {
    try {
      const normalized = validateMapLayers(draft);
      setSaving(true);
      await saveMapLayerSettings(normalized);
      setOpen(false);
      notifySuccess('地图图层配置已保存');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      notifyError(message);
    } finally {
      setSaving(false);
    }
  }, [draft]);

  return (
    <>
      <Tooltip title={settings.status === 'error' ? `图层配置错误：${settings.error.message}` : '配置地图图层'}>
        <Button
          type="text"
          size="small"
          danger={settings.status === 'error'}
          aria-label="配置地图图层"
          data-test-id="layer-settings-open"
          icon={<Settings size={15} />}
          onClick={show}
        />
      </Tooltip>
      <Modal
        title="配置地图图层"
        open={open}
        width={560}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        onOk={save}
        onCancel={() => setOpen(false)}
        destroyOnHidden
      >
        <p className="map-layer-settings-help">
          列表顺序即由下到上的绘制顺序；属性名对应楼层数据中的矩阵字段。事件层 map 必须保留。
        </p>
        <div className="map-layer-settings-header" aria-hidden="true">
          <span />
          <span>图层名称</span>
          <span>属性名</span>
          <span />
        </div>
        <div className="map-layer-settings-list" data-test-id="layer-settings-list">
          {draft.map((layer, index) => (
            <div
              className="map-layer-settings-row"
              key={index}
              onDragEnter={(event) => {
                event.preventDefault();
                if (dragIndex.current == null || dragIndex.current === index) return;
                setDraft((current) => moveItem(current, dragIndex.current as number, index));
                dragIndex.current = index;
              }}
              onDragOver={(event) => event.preventDefault()}
            >
              <button
                type="button"
                className="map-layer-drag-handle"
                draggable
                aria-label={`拖动${layer.name}`}
                onDragStart={(event) => {
                  dragIndex.current = index;
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  dragIndex.current = null;
                }}
              >
                <GripVertical size={16} />
              </button>
              <Input
                value={layer.name}
                aria-label={`图层名称 ${index + 1}`}
                onChange={(event) => update(index, 'name', event.target.value)}
              />
              <Input
                value={layer.property}
                disabled={layer.property === 'map'}
                aria-label={`图层属性名 ${index + 1}`}
                onChange={(event) => update(index, 'property', event.target.value)}
              />
              <Button
                type="text"
                danger
                disabled={layer.property === 'map'}
                aria-label={`删除${layer.name}`}
                icon={<Trash2 size={15} />}
                onClick={() => remove(index)}
              />
            </div>
          ))}
        </div>
        <Button
          type="dashed"
          size="small"
          icon={<Plus size={14} />}
          onClick={() => setDraft((current) => [...current, nextLayer(current)])}
        >
          添加图层
        </Button>
        {error && (
          <div className="map-layer-settings-error" role="alert">
            {error}
          </div>
        )}
      </Modal>
    </>
  );
};
