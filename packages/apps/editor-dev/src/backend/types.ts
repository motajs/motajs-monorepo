import { IEditorFileSystem } from '@motajs/editor-core';
import { IAssetImageDimensions } from '@motajs/editor-impl/asset';

export interface IMemoryBackend extends IEditorFileSystem {
  /** 最大撤回步数；供开发宿主把它一并注入撤销系统 */
  readonly maxUndoStep: number;

  /**
   * 预置一个文件路径的初始内容，并保证其各级父目录可被列出
   * @param path 文件路径：相对项目根、以 `/` 分隔、无前导斜线
   * @param content 文件初始内容：文本或原始字节
   */
  seed(path: string, content: string | Uint8Array): void;
}

export interface ITileCatalogSource {
  /** 纹理清单文件的文本（演示工程里的 `.list.jsonc`） */
  readonly textureText: string;
  /** 图块表文件的文本 */
  readonly tileText: string;
  /** 图片路径 → 像素尺寸；解析器据此换算行列，不需要在运行时解码图片 */
  readonly dimensions: Readonly<Record<string, IAssetImageDimensions | undefined>>;
  /** 图块编号 → 单方面连接的图块编号（自动拼接用） */
  readonly connections: Readonly<Record<number, readonly number[]>>;
  /** 已废弃：旧口径是每张图从固定基号逐格枚举，无法表达多张图占用连续编号段；由 `tilesetReserve` + `tilesetUnit` 取代，计划 29 删除 */
  readonly tilesetBase?: number;
  /** Tileset 编号段的起点，对应引擎同名配置；缺省 `100000`（D-51） */
  readonly tilesetReserve?: number;
  /** 每个编号段的容量，对应引擎同名配置；缺省 `10000`（D-51） */
  readonly tilesetUnit?: number;
}

export interface IMapDemoOverrides {
  /** 覆盖演示地图的视口横向格数 */
  readonly viewportColumns?: number;
  /** 覆盖演示地图的视口纵向格数 */
  readonly viewportRows?: number;
  /** 覆盖演示地图的动画帧速（毫秒 / 帧） */
  readonly frameSpeed?: number;
}
