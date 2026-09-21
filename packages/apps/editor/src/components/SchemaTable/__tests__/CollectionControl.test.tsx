/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollectionControl } from '../CollectionControl';

afterEach(cleanup);

describe('CollectionControl', () => {
  it('delegates item rendering, create, move, remove and selection', () => {
    const create = vi.fn();
    const move = vi.fn();
    const remove = vi.fn();
    const select = vi.fn();
    render(
      <CollectionControl
        items={['a', 'b']}
        renderItem={(item) => <span>{item}</span>}
        onCreate={create}
        onMove={move}
        onRemove={remove}
        onSelect={select}
      />,
    );

    fireEvent.click(screen.getByText('a'));
    expect(select).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole('button', { name: '下移第 1 项' }));
    expect(move).toHaveBeenCalledWith(0, 1);
    fireEvent.click(screen.getByRole('button', { name: '删除第 2 项' }));
    expect(remove).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: '添加' }));
    expect(create).toHaveBeenCalledOnce();
  });

  it('uses the left drag handle to reorder drag-mode collections', () => {
    const move = vi.fn();
    render(
      <CollectionControl
        items={['a', 'b', 'c']}
        reorderMode="drag"
        renderItem={(item) => <span>{item}</span>}
        onCreate={vi.fn()}
        onMove={move}
        onRemove={vi.fn()}
      />,
    );

    const handle = screen.getByLabelText('拖拽第 1 项排序');
    const target = screen.getByText('c').closest('.schemaCollectionItem')!;
    fireEvent.dragStart(handle, { dataTransfer: { effectAllowed: 'none' } });
    fireEvent.dragOver(target, { dataTransfer: { dropEffect: 'none' } });
    fireEvent.drop(target, { dataTransfer: { dropEffect: 'move' } });
    expect(move).toHaveBeenCalledWith(0, 2);
    expect(screen.queryByRole('button', { name: '下移第 1 项' })).toBeNull();
  });
});
