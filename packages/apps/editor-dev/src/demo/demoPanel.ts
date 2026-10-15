import { createElement, FC, ReactElement, useEffect, useState } from 'react';
import {
  IEditorPanel,
  IEditorPanelContext,
  IEditorPanelFactoryParam,
  IEditorPanelType,
  IResource,
} from '@motajs/editor-core';

/** 演示面板读取的示例文件路径（替代原按资源类型分桶的资源标识） */
export const DEMO_SAMPLE_PATH: string = 'demo/sample.txt';

/** 预置到内存文件系统的示例内容（演示假数据，非真实项目数据） */
export const DEMO_SAMPLE_CONTENT: string = '来自内存后端的示例内容';

/** 演示面板类型的字符串标识符 */
const DEMO_PANEL_TYPE_ID: string = 'demo';

/** 演示面板类型的显示名称 */
const DEMO_PANEL_NAME: string = '演示面板';

/** 演示面板视图组件的 props */
interface IDemoPanelViewProps {
  /** 面板侧上下文，用于读取与写入示例资源 */
  readonly context: IEditorPanelContext;
}

/**
 * 渲染演示面板：异步读取示例资源并展示，另提供一个写回按钮以体现可操作
 * @param props 演示面板视图 props
 * @returns 演示面板元素
 */
function DemoPanelView(props: IDemoPanelViewProps): ReactElement {
  const context = props.context;
  const [resource, setResource] = useState<IResource | null>(null);
  const [content, setContent] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    void (async (): Promise<void> => {
      const found = await context.requestResource(DEMO_SAMPLE_PATH);

      if (found === null) return;

      const data = await found.request();

      if (cancelled) return;

      setResource(found);
      setContent(typeof data === 'string' ? data : '');
    })();

    return (): void => {
      cancelled = true;
    };
  }, [context]);

  return createElement(
    'div',
    { className: 'demo-panel' },
    createElement('p', null, content === '' ? '加载中…' : content),
    createElement(
      'button',
      {
        type: 'button',
        disabled: resource === null,
        onClick: (): void => {
          if (resource === null) return;

          const next = `${DEMO_SAMPLE_CONTENT}（已更新）`;
          void resource.write(next).then(() => setContent(next));
        },
      },
      '更新示例内容',
    ),
  );
}

export class DemoPanel implements IEditorPanel {
  readonly id: string;

  /** 面板侧上下文，用于读取与写入示例资源 */
  private readonly context: IEditorPanelContext;

  /** 缓存的渲染组件，供外壳反复挂载时复用同一组件 */
  private readonly ViewComponent: FC;

  constructor(id: string, context: IEditorPanelContext) {
    this.id = id;
    this.context = context;
    this.ViewComponent = () => createElement(DemoPanelView, { context: this.context });
  }

  async initialize(): Promise<void> {
    return;
  }

  async dispose(): Promise<void> {
    return;
  }

  render(): FC {
    return this.ViewComponent;
  }

  async onFocus(): Promise<void> {
    return;
  }

  async onBlur(): Promise<void> {
    return;
  }

  async onSwitchIn(): Promise<void> {
    return;
  }

  async onSwitchOut(): Promise<void> {
    return;
  }

  async onUpdateResource(): Promise<void> {
    return;
  }

  async undo(): Promise<void> {
    return;
  }

  async redo(): Promise<void> {
    return;
  }
}

/** 演示面板的类型元信息，由顶层宿主注册（D-05） */
export const DEMO_PANEL_TYPE: IEditorPanelType = Object.freeze({
  id: DEMO_PANEL_TYPE_ID,
  name: DEMO_PANEL_NAME,
  icon: null,
  create: ({ context, instanceId }: IEditorPanelFactoryParam) => new DemoPanel(instanceId, context),
});
