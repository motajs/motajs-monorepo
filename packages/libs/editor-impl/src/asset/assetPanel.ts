import './asset.css';
import { message as antdMessage } from 'antd';
import { Store } from '@tanstack/store';
import { useStore } from '@tanstack/react-store';
import { get } from 'es-toolkit/compat';
import { createElement, FC, ReactElement } from 'react';
import {
  EditorFileChangeKind,
  IEditorPanel,
  IEditorPanelContext,
  IEditorPanelFactoryParam,
  IFileEntry,
  IResource,
  IResourceIdentifier,
  IUndoContext,
} from '@motajs/editor-core';
import { AssetCategoryKind, AssetListFormat, IAssetCategory, IAssetEditorCapabilities } from '../react';
import { parseTableText, serializeTableText, TableTextParseStatus } from '../shared/jsonc';
import { setByFieldPath } from '../shared/schemaForm/model/fieldPath';
import { buildTableTree } from '../shared/schemaForm/model/traversal';
import { ITableRowNode, ITableSchemaNode } from '../shared/schemaForm/types';
import { AssetPanelView } from './components';
import { ASSET_MAX_UPLOAD_BYTES } from './constants';
import {
  collectRequiredPaths,
  collectUnregisteredAssetNames,
  mergeAssetDefaults,
  readAssetList,
  renameAssetListEntry,
  resolveAssetBytePath,
  resolveAssetName,
  resolveAssetSchema,
  resolveAssetSchemaPath,
  resolveOriginPath,
  resolveTranscodedPath,
  sanitizeAssetFileName,
  validateAssetConfig,
  writeAssetList,
} from './model';
import { BrowserAssetTranscodeService } from './transcode';
import {
  ASSET_TRANSCODE_UNKNOWN_ERROR,
  ASSET_WEBM_EXTENSION,
  ASSET_WEBP_EXTENSION,
  AssetTranscodeKind,
  IAssetTranscodeItemResult,
  IAssetTranscodeOptions,
} from './transcode/types';
import {
  AssetPanelMode,
  AssetPanelStatus,
  AssetUndoType,
  IAssetEntry,
  IAssetListEntry,
  IAssetPanel,
  IAssetPanelTarget,
  IAssetPanelViewState,
  IAssetPendingConflict,
  IAssetTranscodeService,
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
  /** 该分类是否已经成功读过一次；只有读过的分类才允许写盘，否则空内存会把整份列表覆盖掉 */
  loaded: boolean;
  /** 该分类最近一次加载的请求序号，用于丢弃过期结果 */
  token: number;
  /** 清单文件上次载入 / 写盘成功的原文，用于把编辑器自己的写入回声识别成空变化 */
  baselineText: string | undefined;
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

/**
 * 把素材分类的大分类映射成转码种类
 * @param kind 素材分类的大分类
 * @returns 该分类对应的转码种类；不可转码的分类为 undefined
 */
function transcodeKindOf(kind: AssetCategoryKind): AssetTranscodeKind | undefined {
  if (kind === AssetCategoryKind.Image) return AssetTranscodeKind.ImageWebp;
  if (kind === AssetCategoryKind.Audio) return AssetTranscodeKind.AudioOpus;

  return undefined;
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
   * 上传的文件被拒绝时向用户提示原因
   * @param reason 拒绝对用户显示的原因
   */
  onReject(reason: string): void;
  /**
   * 删除当前选中素材
   * @param name 目标素材名
   */
  onDelete(name: string): void;
  /** 打开瘦身转码弹窗 */
  onTranscode(): void;
  /** 取消并关闭瘦身转码弹窗 */
  onCancelTranscode(): void;
  /**
   * 开始批量转码
   * @param names 选中的素材名
   * @param options 转码参数
   */
  onStartTranscode(names: readonly string[], options: IAssetTranscodeOptions): void;
  /** 打开当前选中素材的配置表单 */
  onOpenConfig(): void;
  /**
   * 把当前选中的未登记素材登记进列表
   * @param name 目标素材名
   */
  onRegister(name: string): void;
  /**
   * 注销当前选中的已登记素材（只改列表与配置，不删文件）
   * @param name 目标素材名
   */
  onUnregister(name: string): void;
  /**
   * 配置模式下改一个字段
   * @param path 配置字段路径
   * @param value 目标值
   */
  onChange(path: string, value: unknown): void;
  /** 关闭配置表单、退回素材列表 */
  onBack(): void;
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
    onReject: props.onReject,
    onDelete: props.onDelete,
    onTranscode: props.onTranscode,
    onCancelTranscode: props.onCancelTranscode,
    onStartTranscode: props.onStartTranscode,
    onOpenConfig: props.onOpenConfig,
    onRegister: props.onRegister,
    onUnregister: props.onUnregister,
    onChange: props.onChange,
    onBack: props.onBack,
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

  /** 是否打开瘦身转码弹窗 */
  private transcodeOpen = false;

  /** 是否正在批量转码 */
  private transcoding = false;

  /** 转码服务；缺省为浏览器实现，装配方可注入替身 */
  private readonly transcodeService: IAssetTranscodeService;

  /** 当前分类在当前环境能否转码；未探测或不可转码时为 false */
  private transcodeCapable = false;

  /** 各转码种类的探测结果缓存，切换分类时不必重新探测 */
  private readonly transcodeCapability: Map<AssetTranscodeKind, boolean> = new Map<AssetTranscodeKind, boolean>();

  /** 待用户决定的清单文件外部改动；没有冲突时为 undefined */
  private pendingConflict: IAssetPendingConflict | undefined;

  /** 每条路径最近一次处理的变化摘要，用来把同一事件重复投递压成一次 */
  private readonly handledChanges: Map<string, string> = new Map<string, string>();

  /** 面板当前是否处于活动标签；非活动面板不弹看不见的冲突框 */
  private active = true;

  constructor(
    param: IEditorPanelFactoryParam,
    capabilities: IAssetEditorCapabilities,
    transcodeService: IAssetTranscodeService = new BrowserAssetTranscodeService(),
  ) {
    this.id = param.instanceId;
    this.context = param.context;
    this.capabilities = capabilities;
    this.transcodeService = transcodeService;

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
      transcodeOpen: false,
      transcoding: false,
      transcodeCapable: false,
      pendingConflict: undefined,
    });
    const initialCategory = categories.length === 0 ? undefined : categories[0];

    if (initialCategory !== undefined) void this.refreshTranscodeCapability(initialCategory);

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
          // 按当前选中的条目替换，而不是按上传文件名——用户换一个不同名的文件就是「替换」的正常用法
          const name = this.store.state.selectedName;

          if (name !== undefined) void this.replaceAsset(name, upload.bytes);
        },
        onReject: (reason: string): void => {
          this.publish(this.store.state.status, reason);
        },
        onDelete: (name: string): void => {
          void this.deleteAsset(name);
        },
        onTranscode: (): void => this.openTranscode(),
        onCancelTranscode: (): void => this.closeTranscode(),
        onStartTranscode: (names: readonly string[], options: IAssetTranscodeOptions): void => {
          void this.transcodeAssets(names, options);
        },
        onOpenConfig: (): void => {
          const name = this.store.state.selectedName;

          if (name !== undefined) void this.openConfig(name);
        },
        onRegister: (name: string): void => {
          void this.registerAsset(name);
        },
        onUnregister: (name: string): void => {
          void this.unregisterAsset(name);
        },
        onChange: (path: string, value: unknown): void => this.applyConfigEdit(path, value),
        onBack: (): void => this.closeConfig(),
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
    if (target.assetName !== undefined) this.store.setState({ ...this.store.state, selectedName: target.assetName });
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
    this.active = true;

    const categoryId = this.currentCategoryId;

    if (categoryId === undefined) return;

    await this.loadCategory(categoryId);
    this.publish(this.store.state.status);
  }

  async onSwitchOut(): Promise<void> {
    // 面板失去当前状态时把各分类未落盘的改动统一写盘，避免「切走就丢」；没读过的分类由
    // AssetPanel.writeCategory 的守卫挡掉，写失败由它保留未保存标记并提示（§J）
    this.active = false;
    await this.save();
  }

  async onFocus(): Promise<void> {}

  async onBlur(): Promise<void> {}

  /**
   * 资源层确认某个路径发生变化后，按「清单文件 / 分类目录内字节」两类各自处理；其它路径直接忽略
   *
   * 清单文件读不到时提示并保留内存改动；字节变化只递增该条目的字节版本，不重读清单、不登记撤销。
   * @param identifier 资源统一标识符
   * @param kind 变化种类
   */
  async onResourceChange(identifier: IResourceIdentifier, kind: EditorFileChangeKind): Promise<void> {
    const listCategory = this.categoryList().find((category) => category.listPath === identifier);

    if (listCategory !== undefined) {
      await this.handleListChange(listCategory, identifier, kind);
      return;
    }

    for (const category of this.categoryList()) {
      if (!this.isCategoryBytePath(category, identifier)) continue;

      await this.handleByteChange(category, identifier, kind);
      return;
    }
  }

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

    // 分类切换时探测该分类在当前环境能否转码，供「瘦身转码」入口禁用与提示（D-22）
    await this.refreshTranscodeCapability(category);

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

      const text = paths.has(category.listPath)
        ? await this.readListText(await this.context.requestResource(category.listPath))
        : undefined;

      if (state.token !== token) return;

      if (!this.rebuildFromListText(category, state, text, paths, directoryEntries)) {
        this.setError(categoryId, '列表文件内容无法解析。');
        return;
      }

      this.publish(state.entries.length === 0 ? AssetPanelStatus.Empty : AssetPanelStatus.Ready);
    } catch {
      if (state.token !== token) return;

      this.setError(categoryId, '列表读取失败，请重试。');
    }
  }

  async save(): Promise<void> {
    const ids = [...this.states.keys()];
    let written = false;

    for (const categoryId of ids) {
      const state = this.states.get(categoryId);

      if (state === undefined || !state.unsaved) continue;

      const category = this.findCategory(categoryId);

      if (category === undefined) continue;

      // 被守卫跳过与写盘失败都返回 false，因此「什么都没写却弹已保存」不可能出现
      if (await this.writeCategory(categoryId, category, state)) written = true;
    }

    if (written) antdMessage.success('已保存');
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
   * 新增一个素材：清洗文件名、校验体积与同名，写入字节文件、往内存列表追加一条（字节改动 = 屏障），
   * 并当场把当前分类写盘
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

    entries.push({ name, path, config, exists: true, registered: true });
    state.entries = entries;
    state.unsaved = true;
    this.registerBarrier({ action: 'add', path });
    // 新增就是「想让它进游戏」：当场把当前分类写盘，第二块面板才可能立刻看到它已登记（§J）
    await this.writeCategory(category.id, category, state, '已新增素材并保存');
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

    entries[index] = {
      name: entry.name,
      path: entry.path,
      config: entry.config,
      exists: true,
      registered: entry.registered,
      byteVersion: (entry.byteVersion ?? 0) + 1,
    };
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
   * 把一个未登记素材登记进内存列表（配置按 defaults 合并），并当场把当前分类写盘
   * @param name 要登记的素材名
   */
  async registerAsset(name: string): Promise<void> {
    const category = this.currentCategory();

    if (category === undefined) return;

    const state = this.stateAt(category.id);
    const index = state.entries.findIndex((entry) => entry.name === name);

    if (index === -1) return;

    const entry = state.entries[index];

    if (entry.registered) return;

    const config = await this.buildNewEntryConfig(category, name);
    const entries = state.entries.slice();

    entries[index] = {
      name: entry.name,
      path: entry.path,
      config,
      exists: entry.exists,
      registered: true,
      byteVersion: entry.byteVersion,
    };
    state.entries = entries;
    state.unsaved = true;
    // 注册同样当场写盘：用户点「注册到游戏」就是要它进列表，不该再要求按一次保存（§J）
    await this.writeCategory(category.id, category, state, '已注册素材并保存');
  }

  /**
   * 把一个已登记素材改回未登记并清空配置；不删除、不移动任何字节文件，仍走手动保存
   * @param name 要注销的素材名
   */
  async unregisterAsset(name: string): Promise<void> {
    const category = this.currentCategory();

    if (category === undefined) return;

    const state = this.stateAt(category.id);
    const index = state.entries.findIndex((entry) => entry.name === name);

    if (index === -1) return;

    const entry = state.entries[index];

    if (!entry.registered) return;

    // 正在配置这个素材时先退回浏览态，否则配置表单会停在一条已经没有配置的条目上
    if (this.configName === name) this.closeConfig();

    const entries = state.entries.slice();

    entries[index] = {
      name: entry.name,
      path: entry.path,
      config: undefined,
      exists: entry.exists,
      registered: false,
      byteVersion: entry.byteVersion,
    };
    state.entries = entries;
    state.unsaved = true;
    this.publish(AssetPanelStatus.Ready, '已注销素材，请记得保存');
  }

  /**
   * 打开瘦身转码弹窗；当前分类不是图片 / 音频时不做任何事（入口本就禁用）
   */
  openTranscode(): void {
    const category = this.currentCategory();

    if (category === undefined) return;
    if (category.kind !== AssetCategoryKind.Image && category.kind !== AssetCategoryKind.Audio) return;

    this.transcodeOpen = true;
    this.publish(this.store.state.status);
  }

  /**
   * 关闭瘦身转码弹窗；转码结果由全局提示呈现
   */
  closeTranscode(): void {
    this.transcodeOpen = false;
    this.publish(this.store.state.status);
  }

  /**
   * 批量转码当前分类的素材：逐项读字节 → 转码 → 覆盖或改名保留 → 改列表文件名 → 登记屏障；
   * 单项失败不中断整批，结束时汇总成功数与失败明细
   * @param names 要转码的素材名
   * @param options 转码参数（质量 / 码率 / 采样率 / 是否覆盖旧文件）
   */
  async transcodeAssets(names: readonly string[], options: IAssetTranscodeOptions): Promise<void> {
    const category = this.currentCategory();

    if (category === undefined) return;
    if (names.length === 0) return;

    const state = this.stateAt(category.id);
    const paths = new Set<string>();

    // 目录列不出时按「没有同名文件」处理；后续写入失败会逐项报错
    try {
      for (const item of await this.context.listDirectory(category.dir)) paths.add(item.path);
    } catch {
      // 忽略列举失败
    }

    const failed: IAssetTranscodeItemResult[] = [];
    let succeeded = 0;

    this.transcoding = true;
    this.publish(this.store.state.status);

    for (const name of names) {
      const index = state.entries.findIndex((candidate) => candidate.name === name);

      if (index === -1) {
        failed.push({ name, ok: false, error: '素材不存在' });
        continue;
      }

      const entry = state.entries[index];
      const result = await this.transcodeEntry(category, entry, options, paths);

      if (!result.ok || result.outputPath === undefined) {
        failed.push({ name, ok: false, error: result.error });
        continue;
      }

      succeeded += 1;

      const newFileName = result.outputPath.slice(result.outputPath.lastIndexOf('/') + 1);
      const newName = resolveAssetName(category, newFileName);
      const renamed = renameAssetListEntry(category, { name: entry.name, config: entry.config, index }, newName);
      const entries = state.entries.slice();

      entries[index] = {
        name: renamed.name,
        path: result.outputPath,
        config: renamed.config,
        exists: true,
        registered: entry.registered,
        byteVersion: (entry.byteVersion ?? 0) + 1,
      };
      state.entries = entries;
      this.registerBarrier({ action: 'transcode', path: result.outputPath });
    }

    this.transcoding = false;
    this.transcodeOpen = false;

    if (succeeded > 0) state.unsaved = true;

    if (failed.length > 0) {
      antdMessage.error(`转码失败：${failed[0].error ?? ASSET_TRANSCODE_UNKNOWN_ERROR}`);
    } else {
      antdMessage.success(`转码完成，共 ${succeeded} 个`);
    }

    this.publish(AssetPanelStatus.Ready);
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
   * 处理「某个分类的清单文件」发生变化：原文与基线相同视为回声，脏则弹冲突，否则重读该分类
   * @param category 清单所属分类
   * @param path 清单文件路径
   * @param kind 变化种类
   */
  private async handleListChange(
    category: IAssetCategory,
    path: string,
    kind: EditorFileChangeKind,
  ): Promise<void> {
    const state = this.stateAt(category.id);

    if (kind === EditorFileChangeKind.Delete) {
      if (!this.shouldHandleChange(path, `${kind}:deleted`)) return;

      if (state.unsaved) {
        this.pendingConflict = { categoryId: category.id, text: '' };
        this.publish(this.store.state.status);
        return;
      }

      await this.applyExternalList(category, state, undefined);
      return;
    }

    const text = await this.readExternalListText(path);

    if (text === undefined) {
      antdMessage.warning('读取外部改动失败，已保留你的改动');
      return;
    }

    if (!this.shouldHandleChange(path, `${kind}:${text}`)) return;

    // 与上次载入 / 写盘成功的原文一致：这是编辑器自己的写入回声，不刷新也不弹框
    if (text === state.baselineText) return;

    if (state.unsaved) {
      this.pendingConflict = { categoryId: category.id, text };
      this.publish(this.store.state.status);
      return;
    }

    await this.applyExternalList(category, state, text);
  }

  /**
   * 处理「分类目录内的素材字节」发生变化：只递增该条目的字节版本，不重读清单、不登记撤销
   * @param category 字节所属分类
   * @param path 字节文件路径
   * @param kind 变化种类
   */
  private async handleByteChange(
    category: IAssetCategory,
    path: string,
    kind: EditorFileChangeKind,
  ): Promise<void> {
    const state = this.stateAt(category.id);
    const index = state.entries.findIndex((entry) => entry.path === path);

    if (index === -1) return;

    let digest = `${kind}:deleted`;

    if (kind !== EditorFileChangeKind.Delete) {
      const bytesDigest = await this.readBytesDigest(path);

      if (bytesDigest === undefined) {
        antdMessage.warning('读取外部改动失败，已保留你的改动');
        return;
      }

      digest = `${kind}:${bytesDigest}`;
    }

    if (!this.shouldHandleChange(path, digest)) return;

    const entry = state.entries[index];
    const entries = state.entries.slice();

    // 删除事件只标「文件不在了」；新增 / 修改让字节版本加一，预览与卡片据此按需重读
    entries[index] = {
      name: entry.name,
      path: entry.path,
      config: entry.config,
      exists: kind !== EditorFileChangeKind.Delete,
      registered: entry.registered,
      byteVersion: kind === EditorFileChangeKind.Delete ? entry.byteVersion : (entry.byteVersion ?? 0) + 1,
    };
    state.entries = entries;
    this.publish(this.store.state.status);
  }

  /**
   * 判断一个路径是否属于某分类的素材字节：清单 / schema / 默认值文件由各自分支处理，不按字节对待
   * @param category 素材分类
   * @param path 变化路径
   * @returns 位于分类目录下且不是保留文件时为 true
   */
  private isCategoryBytePath(category: IAssetCategory, path: string): boolean {
    if (category.listPath === path) return false;
    if (category.defaultsPath === path) return false;
    if (resolveAssetSchemaPath(category) === path) return false;

    return path.startsWith(`${category.dir}/`);
  }

  /**
   * 判断这次变化是否已在同一摘要下处理过；没有处理过就记下摘要
   * @param path 变化路径
   * @param digest 本次变化的内容摘要
   * @returns 需要处理时为 true
   */
  private shouldHandleChange(path: string, digest: string): boolean {
    if (this.handledChanges.get(path) === digest) return false;

    this.handledChanges.set(path, digest);
    return true;
  }

  /**
   * 给一段字节算一个廉价的摘要，用来识别「同一次变化」
   * @param bytes 文件字节
   * @returns 长度与滚动校验和拼成的摘要
   */
  private digestBytes(bytes: Uint8Array): string {
    let checksum = 0;

    for (let index = 0; index < bytes.length; index += 1) checksum = (checksum * 31 + bytes[index]) % 0x7fffffff;

    return `${bytes.length}:${checksum}`;
  }

  /**
   * 经资源层读取一个外部变化文件的字节摘要
   * @param path 文件的项目内相对路径
   * @returns 字节摘要；资源不存在、不是字节或读取失败时为 undefined
   */
  private async readBytesDigest(path: string): Promise<string | undefined> {
    try {
      const resource = await this.context.requestResource(path);

      if (resource === null) return undefined;

      const bytes = await resource.requestBinary();

      return bytes === undefined ? undefined : this.digestBytes(bytes);
    } catch {
      return undefined;
    }
  }

  /**
   * 经资源层读取一个外部变化文件的文本
   * @param path 文件的项目内相对路径
   * @returns 文本内容；资源不存在或读取失败时为 undefined
   */
  private async readExternalListText(path: string): Promise<string | undefined> {
    try {
      return await this.readListText(await this.context.requestResource(path));
    } catch {
      return undefined;
    }
  }

  /**
   * 用给定的清单原文重建某分类的条目，并更新该分类的基线；不发布视图状态
   * @param category 素材分类
   * @param state 该分类的内部状态
   * @param text 清单原文；undefined 或空串表示清单文件不存在
   * @param paths 该分类目录下的文件路径集合
   * @param directoryEntries 该分类目录的直接子条目
   * @returns 原文无法解析时为 false（此时状态不变）
   */
  private rebuildFromListText(
    category: IAssetCategory,
    state: IAssetPanelState,
    text: string | undefined,
    paths: ReadonlySet<string>,
    directoryEntries: readonly IFileEntry[],
  ): boolean {
    let listEntries: readonly IAssetListEntry[] = [];

    if (text === undefined || text.length === 0) {
      state.prefix = '';
      state.listDocument = undefined;
    } else {
      const parsed = parseTableText(text);

      if (parsed.status !== TableTextParseStatus.Conforming) return false;

      state.prefix = parsed.prefix;
      state.listDocument = parsed.value;
      listEntries = readAssetList(category, parsed.value);
    }

    state.baselineText = text;

    // 已登记条目在前、未登记条目在后：列表文件缺失或为空时同样要扫描，否则界面永远看不到目录里的游离文件
    const registeredEntries = this.buildEntries(category, listEntries, paths);
    const registeredNames = registeredEntries.map((entry) => entry.name);
    const unregisteredEntries = collectUnregisteredAssetNames(category, directoryEntries, registeredNames).map(
      (name) => ({
        name,
        path: resolveAssetBytePath(category, name),
        config: undefined,
        exists: true,
        registered: false,
      }),
    );

    state.entries = [...registeredEntries, ...unregisteredEntries];
    state.loaded = true;
    return true;
  }

  /**
   * 按外部原文重读某分类：目录列不出或原文无法解析时提示并保留内存改动
   * @param category 素材分类
   * @param state 该分类的内部状态
   * @param text 外部原文；undefined 表示清单文件已被删除
   * @returns 是否成功替换内存内容
   */
  private async applyExternalList(
    category: IAssetCategory,
    state: IAssetPanelState,
    text: string | undefined,
  ): Promise<boolean> {
    const token = state.token + 1;

    state.token = token;

    let directoryEntries: readonly IFileEntry[];

    try {
      directoryEntries = await this.context.listDirectory(category.dir);
    } catch {
      antdMessage.warning('读取外部改动失败，已保留你的改动');
      return false;
    }

    if (state.token !== token) return false;

    const paths = new Set<string>();

    for (const entry of directoryEntries) paths.add(entry.path);

    if (!this.rebuildFromListText(category, state, text, paths, directoryEntries)) {
      antdMessage.warning('读取外部改动失败，已保留你的改动');
      return false;
    }

    state.unsaved = false;

    if (category.id === this.currentCategoryId) {
      this.publish(state.entries.length === 0 ? AssetPanelStatus.Empty : AssetPanelStatus.Ready);
    }

    return true;
  }

  /**
   * 外部变化冲突里选择「放弃我的改动并刷新」：按外部原文重读该分类，丢弃内存改动
   */
  private async discardExternalChange(): Promise<void> {
    const conflict = this.pendingConflict;

    this.pendingConflict = undefined;

    if (conflict === undefined) {
      this.publish(this.store.state.status);
      return;
    }

    const category = this.findCategory(conflict.categoryId);

    if (category === undefined) {
      this.publish(this.store.state.status);
      return;
    }

    await this.applyExternalList(category, this.stateAt(conflict.categoryId), conflict.text);
    this.publish(this.store.state.status);
  }

  /**
   * 外部变化冲突里选择「保留我的改动，下次保存覆盖」：只把基线更新为外部原文，不动内存内容
   */
  private keepExternalChange(): void {
    const conflict = this.pendingConflict;

    this.pendingConflict = undefined;

    if (conflict !== undefined) {
      const state = this.states.get(conflict.categoryId);

      if (state !== undefined) state.baselineText = conflict.text;
    }

    this.publish(this.store.state.status);
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

    const created: IAssetPanelState = {
      listDocument: undefined,
      prefix: '',
      entries: [],
      unsaved: false,
      loaded: false,
      token: 0,
      baselineText: undefined,
    };

    this.states.set(categoryId, created);

    return created;
  }

  /**
   * 探测某分类在当前环境能否转码并刷新视图状态；探测结果按转码种类缓存，避免反复探测
   * @param category 要探测的分类
   */
  private async refreshTranscodeCapability(category: IAssetCategory): Promise<void> {
    const kind = transcodeKindOf(category.kind);

    if (kind === undefined) {
      this.transcodeCapable = false;
    } else {
      const cached = this.transcodeCapability.get(kind);

      this.transcodeCapable = cached === undefined ? await this.transcodeService.canTranscode(kind) : cached;
      this.transcodeCapability.set(kind, this.transcodeCapable);
    }

    // 只刷新能力位：沿用当前状态与错误，免得能力探测把刚发布的状态冲掉
    this.publish(this.store.state.status, undefined, this.store.state.error);
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

    entries[index] = {
      name: entry.name,
      path: entry.path,
      config,
      exists: entry.exists,
      registered: entry.registered,
      byteVersion: entry.byteVersion,
    };
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
   * 转码单个素材：读字节 → 调服务 → 按覆盖设置写回；任一步失败都返回失败结果而不抛出
   * @param category 当前分类
   * @param entry 要转码的条目
   * @param options 转码参数
   * @param paths 分类目录当前已有文件路径集合，写回后就地更新
   * @returns 该项的转码结果
   */
  private async transcodeEntry(
    category: IAssetCategory,
    entry: IAssetEntry,
    options: IAssetTranscodeOptions,
    paths: Set<string>,
  ): Promise<IAssetTranscodeItemResult> {
    let bytes: Uint8Array | undefined;

    try {
      const resource = await this.context.requestResource(entry.path);

      bytes = resource === null ? undefined : await resource.requestBinary();
    } catch {
      bytes = undefined;
    }

    if (bytes === undefined) return { name: entry.name, ok: false, error: '无法读取文件' };

    const isImage = category.kind === AssetCategoryKind.Image;
    const extension = isImage ? ASSET_WEBP_EXTENSION : ASSET_WEBM_EXTENSION;
    const targetPath = resolveTranscodedPath(entry.path, extension);
    let output: Uint8Array;

    try {
      output = isImage
        ? await this.transcodeService.imageToWebp(bytes, options.quality)
        : await this.transcodeService.audioToWebmOpus(bytes, {
            bitrate: options.bitrate,
            sampleRate: options.sampleRate,
          });
    } catch (error) {
      return { name: entry.name, ok: false, error: error instanceof Error ? error.message : '转码失败' };
    }

    if (targetPath !== entry.path && paths.has(targetPath)) {
      return { name: entry.name, ok: false, error: '目标文件已存在' };
    }

    try {
      if (targetPath === entry.path) {
        // 同一路径：覆盖 = 就地写回；不覆盖 = 先把源改名为 origin，再把新字节写回原路径；
        // 绝不先写后删同一路径——那会把刚写好的产物立即删掉，造成不可恢复的数据丢失
        if (options.coverOrigin) {
          await this.context.createResource(entry.path, output);
        } else {
          const originPath = resolveOriginPath(entry.path);

          // 保留文件已存在时不做移动：moveResource 会先删目标，贸然移动会覆盖掉先前的 origin 备份
          if (paths.has(originPath)) {
            return { name: entry.name, ok: false, error: '保留文件已存在' };
          }

          await this.context.moveResource(entry.path, originPath);
          await this.context.createResource(entry.path, output);
          paths.add(originPath);
        }
      } else if (options.coverOrigin) {
        await this.context.createResource(targetPath, output);
        await this.context.deleteResource(entry.path);
      } else {
        const originPath = resolveOriginPath(entry.path);

        // 保留文件已存在时不做移动：moveResource 会先删目标，贸然移动会覆盖掉先前的 origin 备份
        if (paths.has(originPath)) {
          return { name: entry.name, ok: false, error: '保留文件已存在' };
        }

        await this.context.moveResource(entry.path, originPath);
        await this.context.createResource(targetPath, output);
        paths.add(originPath);
      }
    } catch {
      return { name: entry.name, ok: false, error: '写入失败，请重试。' };
    }

    paths.delete(entry.path);
    paths.add(targetPath);

    return { name: entry.name, ok: true, outputPath: targetPath };
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

      return { name: entry.name, path, config: entry.config, exists: paths.has(path), registered: true };
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
   * @param notice 操作结果提示；提供时改为经 antd `message.info` 全局提示，不再写进视图状态
   * @param error 错误提示文案
   */
  private publish(status: AssetPanelStatus, notice?: string, error?: string): void {
    if (notice !== undefined) antdMessage.info(notice);

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
      unsaved: state === undefined ? false : state.unsaved,
      transcodeOpen: this.transcodeOpen,
      transcoding: this.transcoding,
      transcodeCapable: this.transcodeCapable,
      pendingConflict: this.active ? this.pendingConflict : undefined,
    });
  }

  /**
   * 把条目的内存表示还原成列表条目（写回用；只写已登记条目，按过滤后的顺序重排序号）
   * @param entries 面板条目
   * @returns 列表文件条目
   */
  private toListEntries(entries: readonly IAssetEntry[]): readonly IAssetListEntry[] {
    const registered = entries.filter((entry) => entry.registered === true);

    return registered.map((entry, index) => ({ name: entry.name, config: entry.config, index }));
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
   * 写回某分类的列表资源并把失败隔离成提示；这是全仓唯一的写盘点，`loaded` 守卫也放在这里，
   * 自动保存（新增 / 注册）、手动保存、切出写盘三条路径因此共用同一条守卫
   * @param categoryId 分类标识
   * @param category 素材分类
   * @param state 该分类的内部状态
   * @param successNotice 写成功后的提示文案；不传只刷新状态、不弹提示
   * @returns 是否真的把列表写到了磁盘；被守卫跳过与写盘失败都是 false
   */
  private async writeCategory(
    categoryId: string,
    category: IAssetCategory,
    state: IAssetPanelState,
    successNotice?: string,
  ): Promise<boolean> {
    // 没成功读过的分类，内存不能代表磁盘：此时写盘会把整份列表覆盖成一条或空表（T-03-39-02）
    if (!state.loaded) {
      const guardText = '分类尚未读取，未写入列表，请关闭并重新打开面板后重试。';

      antdMessage.error(guardText);
      if (categoryId === this.currentCategoryId) this.publish(this.store.state.status, undefined, guardText);

      return false;
    }

    const document = writeAssetList(category, this.toListEntries(state.entries), state.listDocument);
    const text = serializeTableText(document, state.prefix);

    try {
      const resource = await this.context.requestResource(category.listPath);

      if (resource === null) await this.context.createResource(category.listPath, text);
      else await resource.write(text);

      state.unsaved = false;
      state.listDocument = document;
      state.baselineText = text;

      if (categoryId === this.currentCategoryId) {
        this.publish(state.entries.length === 0 ? AssetPanelStatus.Empty : AssetPanelStatus.Ready, successNotice);
      }

      return true;
    } catch {
      // 切出时写的是别的分类，用户同样得知道没存上：全局提示不分当前分类
      const failureText = '保存失败，改动仍未落盘，请重试。';

      antdMessage.error(failureText);
      if (categoryId === this.currentCategoryId) {
        this.publish(
          state.entries.length === 0 ? AssetPanelStatus.Empty : AssetPanelStatus.Ready,
          undefined,
          failureText,
        );
      }

      return false;
    }
  }
}
