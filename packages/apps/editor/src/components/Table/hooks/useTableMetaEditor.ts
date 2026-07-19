/**
 * useTableMetaEditor - 表格元数据编辑器 Hook
 *
 * 基于 tableMetaService，提供打开代码编辑器的函数。
 * 集成 editor_multi.open 打开编辑器，处理保存回调。
 */

import { useCallback, useMemo } from 'react';
import type { MetaFileKey } from '@/services/tableMeta';
import { useSignal } from '@/hooks/useFs';
import { projectData } from '@/project/data/projectData';
import { useCodeEditor } from '@/Workbench/CodeEditor/CodeEditorContext';
import { notifyError, notifySuccess } from '@/utils/notify';

/**
 * useTableMetaEditor 返回值类型
 */
export interface UseTableMetaEditorResult {
  /** 打开编辑器（内部会等待数据加载完成） */
  openEditor: () => Promise<void>;
  /** 是否正在加载 */
  isLoading: boolean;
}

/**
 * 表格元数据编辑器 hook
 *
 * 基于 tableMetaService，提供打开编辑器的函数。
 * 编辑器内部会处理保存和更新缓存。
 *
 * @param key - 文件 key
 * @returns UseTableMetaEditorResult
 */
export function useTableMetaEditor(key: MetaFileKey): UseTableMetaEditorResult {
  const codeEditor = useCodeEditor();
  const resource = useMemo(() => projectData.tableMetaSource(key), [key]);
  const raw = useMemo(() => resource.raw(), [resource]);

  // 订阅内容状态
  const content = useSignal(raw.content);

  const openEditor = useCallback(async () => {
    // 等待状态稳定（避免 error/not-found 时无限挂起）
    await raw.waitForSettled();

    const currentContent = raw.getContent();
    if (currentContent.status !== 'loaded') {
      notifyError(`加载元数据文件失败: ${currentContent.status}`);
      return;
    }

    codeEditor.open({
      initialValue: currentContent.value,
      contextId: `tableMeta-${key}`,
      lint: true,
      onConfirm: async (newContent: string) => {
        raw.update(newContent);
        notifySuccess(`${key} 配置已更新`);
      },
    });
  }, [codeEditor, key, raw, resource]);

  return {
    openEditor,
    isLoading: content.status === 'loading',
  };
}
