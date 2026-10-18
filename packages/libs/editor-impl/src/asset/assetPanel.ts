import { Store } from '@tanstack/store';
import { useStore } from '@tanstack/react-store';
import { createElement, FC, ReactElement } from 'react';
import {
  IEditorPanel,
  IEditorPanelContext,
  IEditorPanelFactoryParam,
  IResource,
  IUndoContext,
} from '@motajs/editor-core';
import { IAssetCategory, IAssetEditorCapabilities } from '../react';
import { parseTableText, serializeTableText, TableTextParseStatus } from '../shared/jsonc';
import { setByFieldPath } from '../shared/schemaForm/model/fieldPath';
import { readAssetList, resolveAssetBytePath, writeAssetList } from './model';
import {
  AssetPanelMode,
  AssetPanelStatus,
  AssetUndoType,
  IAssetEntry,
  IAssetListEntry,
  IAssetPanel,
  IAssetPanelTarget,
  IAssetPanelViewState,
} from './types';

// 素材面板的数据层：按分类读列表与目录、把改动留在内存、点保存才写回（逐字保留 .jsonc 系统前缀），
// 字节改动登记成带屏障标记的撤销条目。真正的三栏界面在 03-11 接上，这里先返回一个占位组件。

/** 一个分类的内部状态 */
interface IAssetPanelState {
  /** 该分类列表文件的正文值，写回时作为保留其余键的基底 */
  listDocument: unknown;
  /** 该分类列表文件记住的系统前缀原文，写回时逐字还原 */
  prefix: string;
  /** 该分类当前的条目（内存中，含未落盘改动） */
  entries: readonly IAssetEntry[];
  /** 该分类是否有未落盘的列表 / 配置改动 */
  unsaved: boolean;
  /** 该分类最近一次加载的请求序号，用于丢弃过期结果 */
  token: number;
}

/** 一次配置改动的撤销载荷（配置回放用） */
interface IAssetConfigUndoData {
  /** 变更所在分类的标识 */
  readonly categoryId: string;
  /** 变更所在的素材名 */
  readonly name: string;
  /** 变更的配置字段路径（`['a']['b']` 形式） */
  readonly path: string;
  /** 变更前的值，供撤回还原 */
  readonly previous: unknown;
  /** 变更后的值，供重做恢复 */
  readonly next: unknown;
}

/** 占位视图的 props */
interface IAssetPanelViewProps {
  /** 面板视图状态的订阅源 */
  readonly store: Store<IAssetPanelViewState>;
}

/**
 * 判断一个未知值是否为配置改动的撤销载荷
 * @param value 待判断的值
 * @returns 含字符串 `categoryId` / `name` / `path` 时为 true
 */
function isAssetConfigUndoData(value: unknown): value is IAssetConfigUndoData {
  if (typeof value !== 'object' || value === null) return false;
  if (!('categoryId' in value) || !('name' in value) || !('path' in value)) return false;

  return typeof value.categoryId === 'string' && typeof value.name === 'string' && typeof value.path === 'string';
}

/**
 * 取面板数据状态对应的稳定标记串，供占位视图与测试观察
 * @param status 面板数据状态
 * @returns 状态的稳定标记串
 */
function statusToken(status: AssetPanelStatus): string {
  if (status === AssetPanelStatus.NoCategory) return 'no-category';
  if (status === AssetPanelStatus.Loading) return 'loading';
  if (status === AssetPanelStatus.Ready) return 'ready';
  if (status === AssetPanelStatus.Empty) return 'empty';

  return 'error';
}

/**
 * 把面板视图状态概括为一段文案
 * @param view 面板视图状态
 * @returns 描述当前分类与错误的文案
 */
function describeAssetPanel(view: IAssetPanelViewState): string {
  const category = view.categories.find((item) => item.id === view.categoryId);
  const label = category === undefined ? '素材' : category.label;

  if (view.error !== undefined) return `${label}：${view.error}`;

  return label;
}

/**
 * 素材面板的占位视图：渲染状态标记与条目占位，03-11 会换成真正的三栏界面
 * @param props 占位视图 props
 * @returns 占位容器元素
 */
function AssetPanelPlaceholder(props: IAssetPanelViewProps): ReactElement {
  const view = useStore(props.store);
  const entries = view.entries.map((entry) =>
    createElement(
      'div',
      { key: entry.name, 'data-test-id': `asset-entry-${entry.name}`, 'data-exists': String(entry.exists) },
      entry.name,
    ),
  );

  return createElement(
    'div',
    { 'data-test-id': 'asset-panel', 'data-status': statusToken(view.status) },
    describeAssetPanel(view),
    entries,
  );
}

export class AssetPanel implements IEditorPanel, IAssetPanel {
  /** 面板实例标识符，取自 core 生成的实例 id */
  readonly id: string;

  /** 面板侧上下文，提供资源层读写与撤销能力 */
  private readonly context: IEditorPanelContext;

  /** 装配方注入的素材能力（分类清单 + 选择器） */
  private readonly capabilities: IAssetEditorCapabilities;

  /** 面板视图状态的订阅源 */
  private readonly store: Store<IAssetPanelViewState>;

  /** 缓存的渲染根组件 */
  private readonly component: FC;

  /** 各分类的内部状态，按分类标识惰性补建 */
  private readonly states: Map<string, IAssetPanelState> = new Map<string, IAssetPanelState>();

  /** 当前显示的分类标识；分类清单为空时为 undefined */
  private currentCategoryId: string | undefined;

  constructor(param: IEditorPanelFactoryParam, capabilities: IAssetEditorCapabilities) {
    this.id = param.instanceId;
    this.context = param.context;
    this.capabilities = capabilities;

    const categories = this.categoryList();

    this.currentCategoryId = categories.length === 0 ? undefined : categories[0].id;
    this.store = new Store<IAssetPanelViewState>({
      status: categories.length === 0 ? AssetPanelStatus.NoCategory : AssetPanelStatus.Loading,
      mode: AssetPanelMode.Browse,
      categories,
      categoryId: this.currentCategoryId,
      entries: [],
      rows: [],
      configErrors: [],
      unsaved: false,
    });
    this.component = (): ReactElement => createElement(AssetPanelPlaceholder, { store: this.store });
  }

  async initialize(): Promise<void> {}

  async dispose(): Promise<void> {}

  render(): FC {
    return this.component;
  }

  /**
   * 取此面板实例的显示标题，供外壳标签按实例显示
   * @returns 分类清单为空时为 undefined；否则为「素材 · <当前分类显示名>」
   */
  getTitle(): string | undefined {
    const category = this.currentCategory();

    return category === undefined ? undefined : `素材 · ${category.label}`;
  }

  setTarget(target: IAssetPanelTarget): void {
    if (target.categoryId !== undefined) this.currentCategoryId = target.categoryId;
  }

  /**
   * 切换当前分类并重取该分类的数据
   * @param categoryId 目标分类标识
   */
  async selectCategory(categoryId: string): Promise<void> {
    this.currentCategoryId = categoryId;
    await this.loadCategory(categoryId);
  }

  async onSwitchIn(): Promise<void> {
    const categoryId = this.currentCategoryId;

    if (categoryId === undefined) return;

    await this.loadCategory(categoryId);
  }

  async onSwitchOut(): Promise<void> {}

  async onFocus(): Promise<void> {}

  async onBlur(): Promise<void> {}

  async onUpdateResource(): Promise<void> {}

  async undo(context: IUndoContext<unknown>): Promise<void> {
    if (context.type !== AssetUndoType.Config) return;

    this.replayConfigUndo(context.data, true);
  }

  async redo(context: IUndoContext<unknown>): Promise<void> {
    if (context.type !== AssetUndoType.Config) return;

    this.replayConfigUndo(context.data, false);
  }

  /**
   * 读取某分类的列表文件与目录，算出条目与「字节文件是否存在」
   * @param categoryId 目标分类标识
   */
  async loadCategory(categoryId: string): Promise<void> {
    const category = this.findCategory(categoryId);

    if (category === undefined) return;

    const state = this.stateAt(categoryId);

    // 该分类有未落盘改动时不重读覆盖内存，保住手动保存下的内存改动（D-24）
    if (state.unsaved) return;

    this.currentCategoryId = categoryId;

    const token = state.token + 1;

    state.token = token;
    this.publish(AssetPanelStatus.Loading);

    // 资源层读不到的文件会抛错、无法区分「不存在」与「读取失败」，故先列目录核对列表文件是否存在（缺失按空分类）
    // 读取失败是行为关键路径：落回固定错误态而非抛穿面板（T-03-30）
    try {
      const directoryEntries = await this.context.listDirectory(category.dir);

      if (state.token !== token) return;

      const paths = new Set<string>();

      for (const entry of directoryEntries) paths.add(entry.path);

      if (paths.has(category.listPath)) {
        const text = await this.readListText(await this.context.requestResource(category.listPath));

        if (state.token !== token) return;

        if (text === undefined) {
          state.prefix = '';
          state.listDocument = undefined;
          state.entries = [];
        } else {
          const parsed = parseTableText(text);

          if (parsed.status !== TableTextParseStatus.Conforming) {
            this.setError(categoryId, '列表文件内容无法解析。');
            return;
          }

          state.prefix = parsed.prefix;
          state.listDocument = parsed.value;
          state.entries = this.buildEntries(category, readAssetList(category, parsed.value), paths);
        }
      } else {
        state.prefix = '';
        state.listDocument = undefined;
        state.entries = [];
      }

      this.publish(state.entries.length === 0 ? AssetPanelStatus.Empty : AssetPanelStatus.Ready);
    } catch {
      if (state.token !== token) return;

      this.setError(categoryId, '列表读取失败，请重试。');
    }
  }

  async save(): Promise<void> {
    const ids = [...this.states.keys()];

    for (const categoryId of ids) {
      const state = this.states.get(categoryId);

      if (state === undefined || !state.unsaved) continue;

      const category = this.findCategory(categoryId);

      if (category === undefined) continue;

      await this.writeCategory(categoryId, category, state);
    }
  }

  /**
   * 把一次字节改动登记成带 `barrier` 标记的撤销条目
   * @param data 该次字节改动的载荷
   */
  registerBarrier(data: unknown): void {
    this.context.addUndoContext(this, { type: AssetUndoType.Barrier, data, barrier: true });
  }

  /**
   * 把一次配置改动登记成普通（可撤销）条目
   * @param data 该次配置改动的载荷
   */
  registerConfigUndo(data: unknown): void {
    this.context.addUndoContext(this, { type: AssetUndoType.Config, data });
  }

  /**
   * 取装配方注入的分类清单
   * @returns 可用的分类清单；未注入时为空数组
   */
  private categoryList(): readonly IAssetCategory[] {
    return this.capabilities.categories ?? [];
  }

  /**
   * 取当前显示的分类
   * @returns 当前分类；清单为空或标识不匹配时为 undefined
   */
  private currentCategory(): IAssetCategory | undefined {
    const categoryId = this.currentCategoryId;

    if (categoryId === undefined) return undefined;

    return this.findCategory(categoryId);
  }

  /**
   * 按标识查找分类
   * @param categoryId 分类标识
   * @returns 命中的分类；未命中时为 undefined
   */
  private findCategory(categoryId: string): IAssetCategory | undefined {
    return this.categoryList().find((category) => category.id === categoryId);
  }

  /**
   * 取某分类的内部状态，缺失时惰性补建
   * @param categoryId 分类标识
   * @returns 该分类的内部状态
   */
  private stateAt(categoryId: string): IAssetPanelState {
    const existing = this.states.get(categoryId);

    if (existing !== undefined) return existing;

    const created: IAssetPanelState = { listDocument: undefined, prefix: '', entries: [], unsaved: false, token: 0 };

    this.states.set(categoryId, created);

    return created;
  }

  /**
   * 经资源层读取列表文件的原文
   * @param resource 列表文件资源句柄；文件不存在时为 null
   * @returns 列表原文；资源不存在或为空时为 undefined
   */
  private async readListText(resource: IResource | null): Promise<string | undefined> {
    if (resource === null) return undefined;

    const content = await resource.request();

    if (content === undefined) return undefined;
    if (typeof content === 'string') return content;

    return new TextDecoder().decode(content);
  }

  /**
   * 由列表条目与分类目录的文件集合算出面板条目：逐条补上字节路径与「文件是否存在」
   * @param category 素材分类
   * @param listEntries 列表文件里的条目
   * @param paths 该分类目录下的文件路径集合
   * @returns 面板条目
   */
  private buildEntries(
    category: IAssetCategory,
    listEntries: readonly IAssetListEntry[],
    paths: ReadonlySet<string>,
  ): readonly IAssetEntry[] {
    return listEntries.map((entry) => {
      const path = resolveAssetBytePath(category, entry.name);

      return { name: entry.name, path, config: entry.config, exists: paths.has(path) };
    });
  }

  /**
   * 把某分类落回固定错误态：清空列表内容并发布错误提示
   * @param categoryId 分类标识
   * @param message 错误提示文案
   */
  private setError(categoryId: string, message: string): void {
    const state = this.stateAt(categoryId);

    state.prefix = '';
    state.listDocument = undefined;
    state.entries = [];
    this.publish(AssetPanelStatus.Error, undefined, message);
  }

  /**
   * 把当前分类状态合并进视图订阅源
   * @param status 面板数据状态
   * @param message 操作结果提示
   * @param error 错误提示文案
   */
  private publish(status: AssetPanelStatus, message?: string, error?: string): void {
    const state = this.currentCategoryId === undefined ? undefined : this.states.get(this.currentCategoryId);
    const previous = this.store.state;

    this.store.setState({
      status,
      mode: previous.mode,
      categories: this.categoryList(),
      categoryId: this.currentCategoryId,
      entries: state === undefined ? [] : state.entries,
      selectedName: previous.selectedName,
      configName: previous.configName,
      rows: previous.rows,
      configErrors: previous.configErrors,
      error,
      message,
      unsaved: state === undefined ? false : state.unsaved,
    });
  }

  /**
   * 把条目的内存表示还原成列表条目（写回用；顺序即数组顺序）
   * @param entries 面板条目
   * @returns 列表文件条目
   */
  private toListEntries(entries: readonly IAssetEntry[]): readonly IAssetListEntry[] {
    return entries.map((entry, index) => ({ name: entry.name, config: entry.config, index }));
  }

  /**
   * 回放一次配置改动的撤销 / 重做：把值应用到内存配置并标记该分类未保存
   * @param data 配置改动的撤销载荷
   * @param isUndo 为 true 时应用变更前的值，为 false 时应用变更后的值
   */
  private replayConfigUndo(data: unknown, isUndo: boolean): void {
    if (!isAssetConfigUndoData(data)) return;

    this.setConfigValue(data.categoryId, data.name, data.path, isUndo ? data.previous : data.next);
  }

  /**
   * 把某素材某个配置字段改成给定值并标记该分类未保存
   * @param categoryId 分类标识
   * @param name 素材名
   * @param path 配置字段路径（`['a']['b']` 形式）
   * @param value 目标值
   */
  private setConfigValue(categoryId: string, name: string, path: string, value: unknown): void {
    const state = this.states.get(categoryId);

    if (state === undefined) return;

    const index = state.entries.findIndex((entry) => entry.name === name);

    if (index === -1) return;

    const entry = state.entries[index];
    const config = setByFieldPath(entry.config ?? {}, path, value);
    const entries = state.entries.slice();

    entries[index] = { name: entry.name, path: entry.path, config, exists: entry.exists };
    state.entries = entries;
    state.unsaved = true;

    if (categoryId === this.currentCategoryId) this.publish(AssetPanelStatus.Ready);
  }

  /**
   * 写回某分类的列表资源并把失败隔离成提示
   * @param categoryId 分类标识
   * @param category 素材分类
   * @param state 该分类的内部状态
   */
  private async writeCategory(categoryId: string, category: IAssetCategory, state: IAssetPanelState): Promise<void> {
    const document = writeAssetList(category, this.toListEntries(state.entries), state.listDocument);
    const text = serializeTableText(document, state.prefix);

    try {
      const resource = await this.context.requestResource(category.listPath);

      if (resource === null) await this.context.createResource(category.listPath, text);
      else await resource.write(text);

      state.unsaved = false;
      state.listDocument = document;

      if (categoryId === this.currentCategoryId) {
        this.publish(state.entries.length === 0 ? AssetPanelStatus.Empty : AssetPanelStatus.Ready, '已保存');
      }
    } catch {
      if (categoryId === this.currentCategoryId) this.publish(AssetPanelStatus.Ready, '写入失败，请重试。');
    }
  }
}
