import './asset.css';
import { Store } from '@tanstack/store';
import { useStore } from '@tanstack/react-store';
import { get } from 'es-toolkit/compat';
import { createElement, FC, ReactElement } from 'react';
import {
  IEditorPanel,
  IEditorPanelContext,
  IEditorPanelFactoryParam,
  IResource,
  IUndoContext,
} from '@motajs/editor-core';
import { AssetListFormat, IAssetCategory, IAssetEditorCapabilities } from '../react';
import { parseTableText, serializeTableText, TableTextParseStatus } from '../shared/jsonc';
import { setByFieldPath } from '../shared/schemaForm/model/fieldPath';
import { buildTableTree } from '../shared/schemaForm/model/traversal';
import { ITableRowNode, ITableSchemaNode } from '../shared/schemaForm/types';
import { AssetPanelView } from './components';
import { ASSET_MAX_UPLOAD_BYTES } from './constants';
import {
  collectRequiredPaths,
  mergeAssetDefaults,
  readAssetList,
  resolveAssetBytePath,
  resolveAssetName,
  resolveAssetSchema,
  resolveAssetSchemaPath,
  sanitizeAssetFileName,
  validateAssetConfig,
  writeAssetList,
} from './model';
import {
  AssetPanelMode,
  AssetPanelStatus,
  AssetUndoType,
  IAssetEntry,
  IAssetListEntry,
  IAssetPanel,
  IAssetPanelTarget,
  IAssetPanelViewState,
  IAssetUpload,
} from './types';

// 素材面板的数据层：按分类读列表与目录、把改动留在内存、点保存才写回（逐字保留 .jsonc 系统前缀），
// 字节改动登记成带屏障标记的撤销条目。界面由同目录的 AssetPanelView 渲染，本类只做数据与状态接线。

/** `ObjectList` 条目里存文件名的默认键名，与列表模型保持一致 */
const DEFAULT_SOURCE_FIELD = 'source';

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

/** 面板容器组件的 props：订阅源 + 由面板类转发过来的回调 */
interface IAssetPanelContainerProps {
  /** 面板视图状态的订阅源 */
  readonly store: Store<IAssetPanelViewState>;
  /**
   * 读取某素材字节，供预览使用
   * @param path 素材字节文件路径
   * @returns 字节；文件不存在或读取失败时为 undefined
   */
  loadBytes(path: string): Promise<Uint8Array | undefined>;
  /**
   * 切换当前分类
   * @param categoryId 目标分类标识
   */
  onSelectCategory(categoryId: string): void;
  /**
   * 选中某个素材
   * @param name 目标素材名
   */
  onSelectAsset(name: string): void;
  /** 把未落盘的列表与配置改动写回 */
  onSave(): void;
  /**
   * 上传一个本地文件为当前分类新增素材
   * @param upload 上传的原始文件名与字节
   */
  onAddAsset(upload: IAssetUpload): void;
  /**
   * 用本地文件替换当前选中素材
   * @param upload 上传的原始文件名与字节
   */
  onReplace(upload: IAssetUpload): void;
  /**
   * 删除当前选中素材
   * @param name 目标素材名
   */
  onDelete(name: string): void;
  /** 重新读取当前分类 */
  onRetry(): void;
}

/**
 * 素材面板容器组件：订阅视图状态并渲染三栏界面
 * @param props 容器组件 props
 * @returns 面板视图元素
 */
function AssetPanelContainer(props: IAssetPanelContainerProps): ReactElement {
  const view = useStore(props.store);

  return createElement(AssetPanelView, {
    view,
    loadBytes: props.loadBytes,
    onSelectCategory: props.onSelectCategory,
    onSelectAsset: props.onSelectAsset,
    onSave: props.onSave,
    onAddAsset: props.onAddAsset,
    onReplace: props.onReplace,
    onDelete: props.onDelete,
    onRetry: props.onRetry,
  });
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

  /** 当前面板模式（浏览素材 / 配置某个素材） */
  private mode: AssetPanelMode = AssetPanelMode.Browse;

  /** 配置模式下正在编辑的素材名；不在配置模式时为 undefined */
  private configName: string | undefined;

  /** 配置模式使用的 schema 节点；不在配置模式时为 undefined */
  private configSchema: ITableSchemaNode | undefined;

  /** 配置模式下正在编辑的内存配置文档；不在配置模式时为 undefined */
  private configDocument: Record<string, unknown> | undefined;

  /** 由 defaults 的 `@required` 收集来的必填字段路径 */
  private configRequiredPaths: readonly string[] = [];

  /** 配置模式下的行树 */
  private configRows: readonly ITableRowNode[] = [];

  /** 配置模式下的校验错误文案；空数组表示校验通过 */
  private configErrors: readonly string[] = [];

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
    this.component = (): ReactElement =>
      createElement(AssetPanelContainer, {
        store: this.store,
        loadBytes: async (path: string): Promise<Uint8Array | undefined> => {
          const resource = await this.context.requestResource(path);

          if (resource === null) return undefined;

          try {
            return await resource.requestBinary();
          } catch {
            return undefined;
          }
        },
        onSelectCategory: (categoryId: string): void => {
          void this.selectCategory(categoryId);
        },
        onSelectAsset: (name: string): void => {
          this.store.setState({ ...this.store.state, selectedName: name });
        },
        onSave: (): void => {
          void this.save();
        },
        onAddAsset: (upload: IAssetUpload): void => {
          void this.addAsset(upload);
        },
        onReplace: (upload: IAssetUpload): void => {
          void this.replaceAsset(upload.name, upload.bytes);
        },
        onDelete: (name: string): void => {
          void this.deleteAsset(name);
        },
        onRetry: (): void => {
          const categoryId = this.currentCategoryId;

          if (categoryId !== undefined) void this.loadCategory(categoryId);
        },
      });
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
    // 切到别的分类时先退回浏览态，免得配置表单停留在上一个分类的素材上（内存改动保留）
    if (this.mode === AssetPanelMode.Configure) this.closeConfig();

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
   * 新增一个素材：清洗文件名、校验体积与同名，写入字节文件并往内存列表追加一条（字节改动 = 屏障）
   * @param upload 上传的原始文件名与字节
   */
  async addAsset(upload: IAssetUpload): Promise<void> {
    const category = this.currentCategory();

    if (category === undefined) {
      this.publish(AssetPanelStatus.NoCategory, '请先选择分类');
      return;
    }

    const fileName = sanitizeAssetFileName(upload.name);

    if (fileName === null) {
      this.publish(this.store.state.status, '文件名不合法');
      return;
    }

    if (upload.bytes.length > ASSET_MAX_UPLOAD_BYTES) {
      this.publish(this.store.state.status, '文件过大，单个素材不能超过 32 MiB');
      return;
    }

    const state = this.stateAt(category.id);
    const name = resolveAssetName(category, fileName);

    if (state.entries.some((entry) => entry.name === name)) {
      this.publish(this.store.state.status, '同名素材已存在');
      return;
    }

    const path = resolveAssetBytePath(category, name);

    try {
      await this.context.createResource(path, upload.bytes);
    } catch {
      this.publish(this.store.state.status, '写入失败，请重试。');
      return;
    }

    const config = await this.buildNewEntryConfig(category, name);
    const entries = state.entries.slice();

    entries.push({ name, path, config, exists: true });
    state.entries = entries;
    state.unsaved = true;
    this.publish(AssetPanelStatus.Ready, '已新增素材，请记得保存');
    this.registerBarrier({ action: 'add', path });
  }

  /**
   * 用新字节覆盖某素材的字节文件（字节改动 = 屏障），列表条目不写盘
   * @param name 要替换的素材名
   * @param bytes 替换后的字节
   */
  async replaceAsset(name: string, bytes: Uint8Array): Promise<void> {
    const category = this.currentCategory();

    if (category === undefined) return;

    const state = this.stateAt(category.id);
    const index = state.entries.findIndex((entry) => entry.name === name);

    if (index === -1) {
      this.publish(this.store.state.status, '素材不存在');
      return;
    }

    if (bytes.length > ASSET_MAX_UPLOAD_BYTES) {
      this.publish(this.store.state.status, '文件过大，单个素材不能超过 32 MiB');
      return;
    }

    const entry = state.entries[index];

    try {
      await this.context.createResource(entry.path, bytes);
    } catch {
      this.publish(this.store.state.status, '写入失败，请重试。');
      return;
    }

    // 覆盖后字节文件必定存在：把该条目的缺失标记一并纠正，免得界面继续显示缺失
    const entries = state.entries.slice();

    entries[index] = { name: entry.name, path: entry.path, config: entry.config, exists: true };
    state.entries = entries;
    this.registerBarrier({ action: 'replace', path: entry.path });
    this.publish(AssetPanelStatus.Ready, '已替换素材');
  }

  /**
   * 删除某素材：移除字节文件并从内存列表移除该条目（字节改动 = 屏障），列表只在 save() 时写盘
   * @param name 要删除的素材名
   */
  async deleteAsset(name: string): Promise<void> {
    const category = this.currentCategory();

    if (category === undefined) return;

    const state = this.stateAt(category.id);
    const index = state.entries.findIndex((entry) => entry.name === name);

    if (index === -1) return;

    const entry = state.entries[index];

    // 字节文件本就不存在时删除会抛错，但列表条目仍要移除，故把删除失败隔离成「继续删条目」
    try {
      await this.context.deleteResource(entry.path);
    } catch {
      // 文件不存在也继续
    }

    const entries = state.entries.slice();

    entries.splice(index, 1);
    state.entries = entries;
    state.unsaved = true;
    this.registerBarrier({ action: 'delete', path: entry.path });
    this.publish(entries.length === 0 ? AssetPanelStatus.Empty : AssetPanelStatus.Ready, '已删除素材，请记得保存');
  }

  /**
   * 打开某素材的配置表单：解析 schema、把该素材的配置建成行树并进入配置模式
   *
   * 配置来源按「工程内 `.schema.jsonc` → 注入 schema → 内置 schema」解析；工程内 schema 存在但无效时发布错误
   * 并保持浏览态，绝不半截渲染。进入配置态时按 defaults 的 `@required` 收集必填路径并算出校验结果，一并发布。
   * @param name 要配置的素材名
   */
  async openConfig(name: string): Promise<void> {
    const category = this.currentCategory();

    if (category === undefined) return;

    const state = this.stateAt(category.id);
    const entry = state.entries.find((candidate) => candidate.name === name);

    if (entry === undefined) return;

    const schemaText = await this.readSchemaText(category);
    const resolution = resolveAssetSchema(category.kind, schemaText, category.schema);

    if (resolution === null) {
      this.publish(this.store.state.status, undefined, '该素材的配置无法解析');
      return;
    }

    const defaults = await this.readDefaultsValue(category);
    const document = entry.config ?? {};

    this.configSchema = resolution.schema;
    this.configDocument = document;
    this.configRequiredPaths = collectRequiredPaths(defaults);
    this.mode = AssetPanelMode.Configure;
    this.configName = name;
    this.configRows = buildTableTree(resolution.schema, document);
    this.configErrors = validateAssetConfig(resolution.schema, document, this.configRequiredPaths);
    this.publish(AssetPanelStatus.Ready);
  }

  /**
   * 关闭配置表单、退回素材列表；内存里的配置改动与未保存标记一律保留
   */
  closeConfig(): void {
    this.mode = AssetPanelMode.Browse;
    this.configName = undefined;
    this.configSchema = undefined;
    this.configDocument = undefined;
    this.configRequiredPaths = [];
    this.configRows = [];
    this.configErrors = [];
    this.publish(this.store.state.status);
  }

  /**
   * 改一个配置字段：写进内存配置与条目、登记一条可撤销记录、标记未保存，并重算行树与校验结果
   * @param path 配置字段路径（`['a']['b']` 形式）
   * @param value 目标值
   */
  applyConfigEdit(path: string, value: unknown): void {
    const category = this.currentCategory();
    const name = this.configName;
    const document = this.configDocument;

    if (category === undefined || name === undefined || document === undefined) return;

    const previous = get(document, path);
    const next = setByFieldPath(document, path, value);

    this.configDocument = next;
    this.storeEntryConfig(category.id, name, next);
    this.registerConfigUndo({ categoryId: category.id, name, path, previous, next: value });
    this.refreshConfigView();
    this.publish(AssetPanelStatus.Ready);
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
   * 读取某分类的配置表单 schema 原文
   * @param category 素材分类
   * @returns schema 文件原文；文件不存在或读取失败时为 undefined
   */
  private async readSchemaText(category: IAssetCategory): Promise<string | undefined> {
    // 工程内 schema 只是配置来源之一，读不到就回退注入 / 内置：任何失败都归成「没有工程 schema」
    try {
      const resource = await this.context.requestResource(resolveAssetSchemaPath(category));

      if (resource === null) return undefined;

      const content = await resource.request();

      if (content === undefined) return undefined;
      if (typeof content === 'string') return content;

      return new TextDecoder().decode(content);
    } catch {
      return undefined;
    }
  }

  /**
   * 读取某分类的默认值文件正文，供新增条目的默认配置合并
   * @param category 素材分类
   * @returns defaults 文件的正文值；未配置、缺失或无法解析时为 undefined
   */
  private async readDefaultsValue(category: IAssetCategory): Promise<unknown> {
    const path = category.defaultsPath;

    if (path === undefined) return undefined;

    // defaults 只是新增条目的可选默认值，读不到不该拦住新增：任何失败都归成「没有默认值」
    try {
      const resource = await this.context.requestResource(path);

      if (resource === null) return undefined;

      const content = await resource.request();

      if (content === undefined) return undefined;

      const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
      const parsed = parseTableText(text);

      return parsed.status === TableTextParseStatus.Conforming ? parsed.value : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * 把某素材的内存条目配置换成新对象并标记该分类未保存
   * @param categoryId 分类标识
   * @param name 素材名
   * @param config 新的配置对象
   */
  private storeEntryConfig(categoryId: string, name: string, config: Record<string, unknown>): void {
    const state = this.states.get(categoryId);

    if (state === undefined) return;

    const index = state.entries.findIndex((entry) => entry.name === name);

    if (index === -1) return;

    const entry = state.entries[index];
    const entries = state.entries.slice();

    entries[index] = { name: entry.name, path: entry.path, config, exists: entry.exists };
    state.entries = entries;
    state.unsaved = true;
  }

  /**
   * 按当前 schema 与内存配置文档重算配置行树与校验结果
   */
  private refreshConfigView(): void {
    const schema = this.configSchema;
    const document = this.configDocument;

    if (schema === undefined || document === undefined) {
      this.configRows = [];
      this.configErrors = [];
      return;
    }

    this.configRows = buildTableTree(schema, document);
    this.configErrors = validateAssetConfig(schema, document, this.configRequiredPaths);
  }

  /**
   * 算出新增条目的初始配置：`ObjectList` 分类把 defaults 合并进「仅含来源字段」的基底
   * @param category 素材分类
   * @param name 新素材名
   * @returns 新条目配置；`StringList` 分类为 undefined
   */
  private async buildNewEntryConfig(
    category: IAssetCategory,
    name: string,
  ): Promise<Record<string, unknown> | undefined> {
    if (category.listFormat !== AssetListFormat.ObjectList) return undefined;

    const defaults = await this.readDefaultsValue(category);
    const sourceField = category.sourceField ?? DEFAULT_SOURCE_FIELD;

    return mergeAssetDefaults(defaults, { [sourceField]: name });
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
      mode: this.mode,
      categories: this.categoryList(),
      categoryId: this.currentCategoryId,
      entries: state === undefined ? [] : state.entries,
      selectedName: previous.selectedName,
      configName: this.configName,
      rows: this.configRows,
      configErrors: this.configErrors,
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
   * 回放一次配置改动的撤销 / 重做：把值应用到内存配置；正在配置该素材时一并刷新行树与校验结果
   * @param data 配置改动的撤销载荷
   * @param isUndo 为 true 时应用变更前的值，为 false 时应用变更后的值
   */
  private replayConfigUndo(data: unknown, isUndo: boolean): void {
    if (!isAssetConfigUndoData(data)) return;

    const state = this.states.get(data.categoryId);

    if (state === undefined) return;

    const entry = state.entries.find((candidate) => candidate.name === data.name);

    if (entry === undefined) return;

    const config = setByFieldPath(entry.config ?? {}, data.path, isUndo ? data.previous : data.next);

    this.storeEntryConfig(data.categoryId, data.name, config);

    // 回放的正是当前正在配置的素材：内存配置文档、行树、校验结果一并刷新
    if (data.categoryId === this.currentCategoryId && data.name === this.configName) {
      this.configDocument = config;
      this.refreshConfigView();
    }

    if (data.categoryId === this.currentCategoryId) this.publish(AssetPanelStatus.Ready);
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
