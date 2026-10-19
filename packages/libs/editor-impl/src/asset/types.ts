import { IAssetCategory, IMultiSelectItem } from '../react';
import { ITableRowNode, ITableSchemaNode } from '../shared/schemaForm/types';
import { AssetTranscodeKind, IAssetAudioTranscodeOptions } from './transcode/types';

export const enum AssetPanelStatus {
  /** 分类清单为空，面板无法工作 */
  NoCategory,
  /** 正在读取当前分类的列表与字节 */
  Loading,
  /** 数据已就绪，含条目或为空 */
  Ready,
  /** 当前分类下没有任何条目 */
  Empty,
  /** 读取失败 */
  Error,
}

export const enum AssetPanelMode {
  /** 浏览素材 */
  Browse,
  /** 配置某个素材 */
  Configure,
}

export const enum AssetUndoType {
  /** 配置改动，可撤销 */
  Config,
  /** 字节改动，作为不可撤销的屏障 */
  Barrier,
}

export const enum AssetSchemaSource {
  /** 来自工程内的分类 schema 文件 */
  ProjectFile,
  /** 来自装配方注入的 schema */
  Injected,
  /** 来自包内置的 schema */
  BuiltIn,
}

export interface IAssetEntry {
  /** 素材名（列表里登记的名字） */
  readonly name: string;
  /** 素材字节文件的资源路径 */
  readonly path: string;
  /** 该素材的配置；字符串列表分类没有配置时为 undefined */
  readonly config?: Record<string, unknown>;
  /** 字节文件是否真的存在于分类目录 */
  readonly exists: boolean;
}

export interface IAssetListEntry {
  /** 素材名 */
  readonly name: string;
  /** 列表文件里记录的配置；字符串列表分类没有配置时为 undefined */
  readonly config?: Record<string, unknown>;
  /** 该条目在列表原文中的序号，写回时据此保序 */
  readonly index: number;
}

export interface IAssetUpload {
  /** 用户选中的原始文件名（尚未清洗） */
  readonly name: string;
  /** 用户选中的原始字节 */
  readonly bytes: Uint8Array;
}

export interface IAssetPickerItems {
  /** 选择器候选项列表（图片带缩略图、音频带试听地址、动画带预览提示） */
  readonly items: readonly IMultiSelectItem[];
  /** 本次创建的 blob: 地址集合，供调用方在弹窗结束时回收 */
  readonly objectUrls: readonly string[];
}

export interface IAssetSchemaResolution {
  /** 解析得到的 schema 节点 */
  readonly schema: ITableSchemaNode;
  /** schema 的来源 */
  readonly source: AssetSchemaSource;
}

export interface IAssetPanelTarget {
  /** 打开时要定位的分类标识；缺省时用分类清单的第一项 */
  readonly categoryId?: string;
  /** 打开时要选中的素材名；缺省时不选中 */
  readonly assetName?: string;
}

export interface IAssetPanelParam extends Record<string, unknown> {
  /** 打开面板时可带的初始目标 */
  readonly target?: IAssetPanelTarget;
}

export interface IAssetPanel {
  /**
   * 从外部设置此面板实例要定位的分类与素材
   * @param target 初始目标（分类标识 + 可选的素材名）
   */
  setTarget(target: IAssetPanelTarget): void;

  /**
   * 把内存中的未落盘改动（列表与配置）写回资源
   * @returns 写完后的异步结果
   */
  save(): Promise<void>;
}

export interface IAssetPanelViewState {
  /** 面板数据状态 */
  readonly status: AssetPanelStatus;
  /** 当前处于浏览还是配置模式 */
  readonly mode: AssetPanelMode;
  /** 可选的分类清单 */
  readonly categories: readonly IAssetCategory[];
  /** 当前选中的分类标识；分类清单为空时为 undefined */
  readonly categoryId?: string;
  /** 当前分类下的素材条目 */
  readonly entries: readonly IAssetEntry[];
  /** 当前选中的素材名；未选中时为 undefined */
  readonly selectedName?: string;
  /** 正在配置的素材名；不在配置模式时为 undefined */
  readonly configName?: string;
  /** 配置表单的行树 */
  readonly rows: readonly ITableRowNode[];
  /** 配置表单的校验错误文案；空数组表示校验通过 */
  readonly configErrors: readonly string[];
  /** 加载或保存失败时的错误文案；无错误时为 undefined */
  readonly error?: string;
  /** 是否存在尚未落盘的改动 */
  readonly unsaved: boolean;
  /** 是否打开瘦身转码弹窗 */
  readonly transcodeOpen: boolean;
  /** 是否正在批量转码 */
  readonly transcoding: boolean;
  /** 当前分类在当前环境能否转码（由转码服务探测；未探测或不可转码时为 false） */
  readonly transcodeCapable: boolean;
}

export interface IAssetTranscodeService {
  /**
   * 探测当前环境能否执行指定种类的转码
   * @param kind 要探测的转码种类
   * @returns 该种类可转码时为 true
   */
  canTranscode(kind: AssetTranscodeKind): Promise<boolean>;

  /**
   * 把图片字节转码为 WebP
   * @param bytes 原始图片字节
   * @param quality WebP 质量（0–100）
   * @returns 转码后的 WebP 字节
   */
  imageToWebp(bytes: Uint8Array, quality: number): Promise<Uint8Array>;

  /**
   * 把音频字节转码为 WebM 容器中的 Opus
   * @param bytes 原始音频字节
   * @param options 音频转码参数（码率 / 采样率）
   * @returns 转码后的 WebM 字节
   */
  audioToWebmOpus(bytes: Uint8Array, options: IAssetAudioTranscodeOptions): Promise<Uint8Array>;
}
