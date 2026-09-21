import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';

export interface CollectionControlProps<T> {
  items: readonly T[];
  disabled?: boolean;
  emptyText?: string;
  createLabel?: string;
  itemKey?: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  onCreate: () => void;
  onRemove: (index: number) => void;
  onMove: (index: number, nextIndex: number) => void;
  onSelect?: (index: number) => void;
  selectedIndex?: number;
  reorderMode?: 'buttons' | 'drag';
}

export function CollectionControl<T>({
  items,
  disabled = false,
  emptyText = '暂无项目',
  createLabel = '添加',
  itemKey = (_item, index) => String(index),
  renderItem,
  onCreate,
  onRemove,
  onMove,
  onSelect,
  selectedIndex,
  reorderMode = 'buttons',
}: CollectionControlProps<T>) {
  const [draggingIndex, setDraggingIndex] = useState<number>();
  const [dragOverIndex, setDragOverIndex] = useState<number>();
  return (
    <div className="schemaCollection" data-test-id="schema-collection">
      {items.length === 0 ? <div className="schemaCollectionEmpty">{emptyText}</div> : null}
      <div className="schemaCollectionItems">
        {items.map((item, index) => (
          <div
            key={itemKey(item, index)}
            className={`schemaCollectionItem${selectedIndex === index ? ' selected' : ''}${draggingIndex === index ? ' dragging' : ''}${dragOverIndex === index ? ' dragOver' : ''}`}
            data-test-id={`schema-collection-item-${index}`}
            onClick={() => onSelect?.(index)}
            onDragOver={(event) => {
              if (reorderMode !== 'drag' || draggingIndex == null || disabled) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDragOverIndex(index);
            }}
            onDrop={(event) => {
              if (reorderMode !== 'drag' || draggingIndex == null || disabled) return;
              event.preventDefault();
              if (draggingIndex !== index) onMove(draggingIndex, index);
              setDraggingIndex(undefined);
              setDragOverIndex(undefined);
            }}
          >
            {reorderMode === 'drag' ? (
              <span
                className="schemaCollectionDragHandle"
                draggable={!disabled}
                aria-label={`拖拽第 ${index + 1} 项排序`}
                title="拖拽排序"
                onClick={(event) => event.stopPropagation()}
                onDragStart={(event) => {
                  if (disabled) {
                    event.preventDefault();
                    return;
                  }
                  event.stopPropagation();
                  event.dataTransfer.effectAllowed = 'move';
                  setDraggingIndex(index);
                  setDragOverIndex(index);
                }}
                onDragEnd={() => {
                  setDraggingIndex(undefined);
                  setDragOverIndex(undefined);
                }}
              >
                <GripVertical size={15} aria-hidden="true" />
              </span>
            ) : null}
            <div className="schemaCollectionContent">{renderItem(item, index)}</div>
            <div className="schemaCollectionActions">
              {reorderMode === 'buttons' ? (
                <>
                  <button
                    type="button"
                    className="schemaTableIconButton"
                    aria-label={`上移第 ${index + 1} 项`}
                    title="上移"
                    disabled={disabled || index === 0}
                    onClick={(event) => {
                      event.stopPropagation();
                      onMove(index, index - 1);
                    }}
                  >
                    <ArrowUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="schemaTableIconButton"
                    aria-label={`下移第 ${index + 1} 项`}
                    title="下移"
                    disabled={disabled || index === items.length - 1}
                    onClick={(event) => {
                      event.stopPropagation();
                      onMove(index, index + 1);
                    }}
                  >
                    <ArrowDown size={14} aria-hidden="true" />
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="schemaTableIconButton danger"
                aria-label={`删除第 ${index + 1} 项`}
                title="删除"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(index);
                }}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="schemaCollectionCreate" disabled={disabled} onClick={onCreate}>
        <Plus size={14} aria-hidden="true" />
        {createLabel}
      </button>
    </div>
  );
}
