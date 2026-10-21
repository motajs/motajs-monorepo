import { Application, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { MAP_CELL_SIZE } from '../constants';
import { IMapCellPosition, IMapPassMark, IMapRect, IMapRenderCell, IMapRenderModel } from '../types';
import { useMapObjectUrl } from './useMapObjectUrl';

// 唯一 import pixi.js 的文件：把渲染模型画成占位格 / 图块 / 网格 / 通行度标记。
// Pixi 应用、场景与纹理表都挂在组件实例的 ref 上，卸载时销毁；模块顶层没有任何可变缓存。

/** 读取图片字节的回调 */
type MapBytesLoader = (path: string) => Promise<Uint8Array | undefined>;

/** 一个图块图片源组件的 props */
interface IMapImageSourceProps {
  /** 图片相对项目根的路径 */
  readonly path: string;
  /** 字节版本号；变化时重新读取 */
  readonly version: number;
  /** 读取图片字节的回调 */
  loadBytes: MapBytesLoader;
  /**
   * 图片地址就绪或失效时回报给画布
   * @param path 图片路径
   * @param url 可用的 `blob:` 地址；拿不到时为 undefined
   */
  onUrl(path: string, url: string | undefined): void;
}

export interface IMapSurfaceProps {
  /** 要画的这一帧渲染模型 */
  readonly model: IMapRenderModel;
  /** 图块图片的重试计数，递增即重新读取字节 */
  readonly imageVersion?: number;
  /** 读取图片字节的回调 */
  readonly loadBytes?: MapBytesLoader;
  /** 画布初始化失败时回调，面板据此显示错误态 */
  onError?(): void;
}

/** 空格子的浅色棋盘格底色 */
const EMPTY_LIGHT = 0xf4f5f7;

/** 空格子的浅色棋盘格深色 */
const EMPTY_DARK = 0xe4e7eb;

/** 已知编号但纹理尚未就绪时的占位色 */
const PENDING_FILL = 0xc7ccd4;

/** 编号在目录里查不到时的占位色 */
const MISSING_FILL = 0xf2a65a;

/** 缺图占位格右上角的角标色 */
const MISSING_MARK = 0x9c5a12;

/** 网格线颜色 */
const GRID_COLOR = 0x242f42;

/** 网格线不透明度 */
const GRID_ALPHA = 0.16;

/** 通行度标记颜色 */
const PASS_COLOR = 0xd9363e;

/** 通行度标记的白半透明衬底 */
const PASS_CHIP = 0xffffff;

/** 通行度箭头 / 衬底半径（像素） */
const PASS_RADIUS = 5;

/** 通行度降级为红点时的半径（像素） */
const PASS_DOT_RADIUS = 2;

/** 框选边框颜色 */
const SELECTION_COLOR = 0x2f6fed;

/** 框选填充不透明度 */
const SELECTION_FILL_ALPHA = 0.12;

/** 框选虚线的一段长度（像素） */
const SELECTION_DASH = 6;

/** 框选虚线的间隔长度（像素） */
const SELECTION_GAP = 4;

/** 绘制预览边框颜色 */
const PREVIEW_COLOR = 0x6f4bd8;

/** 绘制预览填充不透明度 */
const PREVIEW_FILL_ALPHA = 0.35;

/** 悬停轮廓颜色 */
const HOVER_COLOR = 0x2a2f3a;

/** 悬停轮廓不透明度 */
const HOVER_ALPHA = 0.4;

/**
 * 没有字节读取回调时使用的空实现
 * @returns 永远是 undefined
 */
async function loadNoBytes(): Promise<undefined> {
  return undefined;
}

/**
 * 按图片扩展名推断 MIME 类型
 * @param path 图片路径
 * @returns MIME 类型
 */
function mimeOfImagePath(path: string): string {
  if (/\.jpe?g$/i.test(path)) return 'image/jpeg';
  if (/\.gif$/i.test(path)) return 'image/gif';
  if (/\.webp$/i.test(path)) return 'image/webp';

  return 'image/png';
}

/**
 * 用 blob 地址加载一张可交给 Pixi 的图片
 * @param url 图片的 `blob:` 地址
 * @returns 加载完成的图片元素
 */
function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = (): void => resolve(image);
    image.onerror = (): void => reject(new Error('image load failed'));
    image.src = url;
  });
}

/**
 * 收集渲染模型里出现过的图片路径，按首次出现顺序去重
 * @param model 渲染模型
 * @returns 图片路径列表
 */
function collectImagePaths(model: IMapRenderModel): string[] {
  const paths: string[] = [];
  const seen: Set<string> = new Set();

  for (const cell of model.cells) {
    const path = cell.imagePath;

    if (path === undefined || seen.has(path)) continue;

    seen.add(path);
    paths.push(path);
  }

  return paths;
}

/**
 * 销毁一组按裁切矩形临时创建的纹理
 * @param frames 待销毁的纹理
 */
function destroyFrames(frames: readonly Texture[]): void {
  for (const frame of frames) {
    if (!frame.destroyed) frame.destroy(false);
  }
}

/**
 * 造一个占位格：空格画浅色棋盘格，缺图画暖橙方块，纹理未就绪画灰色方块
 * @param cell 渲染格
 * @returns 占位图形
 */
function createPlaceholder(cell: IMapRenderCell): Graphics {
  const graphics = new Graphics();
  const half = cell.width / 2;

  if (cell.imagePath === undefined && !cell.missing) {
    graphics.rect(cell.x, cell.y, half, half).fill({ color: EMPTY_LIGHT });
    graphics.rect(cell.x + half, cell.y, half, half).fill({ color: EMPTY_DARK });
    graphics.rect(cell.x, cell.y + half, half, half).fill({ color: EMPTY_DARK });
    graphics.rect(cell.x + half, cell.y + half, half, half).fill({ color: EMPTY_LIGHT });
  } else if (cell.missing) {
    graphics.rect(cell.x, cell.y, cell.width, cell.height).fill({ color: MISSING_FILL });
    graphics.rect(cell.x + cell.width - 8, cell.y, 8, 8).fill({ color: MISSING_MARK });
  } else {
    graphics.rect(cell.x, cell.y, cell.width, cell.height).fill({ color: PENDING_FILL });
  }

  graphics.alpha = cell.opacity;
  graphics.label = cell.key;
  return graphics;
}

/**
 * 用一张图块纹理造出裁切后的精灵
 * @param texture 图集纹理
 * @param cell 渲染格
 * @param frames 本次绘制的临时裁切纹理收集处
 * @returns 定位好的精灵
 */
function createCellSprite(texture: Texture, cell: IMapRenderCell, frames: Texture[]): Sprite {
  const crop = cell.crop;
  let frame = texture;

  if (crop !== undefined) {
    frame = new Texture({ source: texture.source, frame: new Rectangle(crop.x, crop.y, crop.width, crop.height) });
    frames.push(frame);
  }

  const sprite = new Sprite(frame);

  sprite.x = cell.x;
  sprite.y = cell.y;
  sprite.width = cell.width;
  sprite.height = cell.height;
  sprite.alpha = cell.opacity;
  sprite.label = cell.key;
  return sprite;
}

/**
 * 画网格线；叠加层不拦指针
 * @param scene 场景容器
 * @param model 渲染模型
 */
function drawGrid(scene: Container, model: IMapRenderModel): void {
  if (model.gridLines.length === 0) return;

  const grid = new Graphics();

  grid.eventMode = 'none';
  grid.setStrokeStyle({ color: GRID_COLOR, alpha: GRID_ALPHA, width: 1 });

  for (const line of model.gridLines) {
    if (line.vertical) {
      grid.moveTo(line.x + 0.5, line.y);
      grid.lineTo(line.x + 0.5, line.y + line.length);
    } else {
      grid.moveTo(line.x, line.y + 0.5);
      grid.lineTo(line.x + line.length, line.y + 0.5);
    }
  }

  grid.stroke();
  scene.addChild(grid);
}

/**
 * 画一枚指向「不能走」方向的红色箭头
 * @param graphics 目标图形
 * @param x 箭头中心的像素横坐标
 * @param y 箭头中心的像素纵坐标
 * @param dx 方向的横向分量（-1 / 0 / 1）
 * @param dy 方向的纵向分量（-1 / 0 / 1）
 */
function drawPassArrow(graphics: Graphics, x: number, y: number, dx: number, dy: number): void {
  const tipX = x + dx * PASS_RADIUS;
  const tipY = y + dy * PASS_RADIUS;
  const baseX = x - dx * 2;
  const baseY = y - dy * 2;
  const wingX = -dy * 4;
  const wingY = dx * 4;

  graphics.moveTo(tipX, tipY);
  graphics.lineTo(baseX + wingX, baseY + wingY);
  graphics.lineTo(baseX - wingX, baseY - wingY);
  graphics.fill({ color: PASS_COLOR });
}

/**
 * 画一个通行度标记：白色半透明衬底 + 每个被阻挡方向的红色箭头；大地图缩小后降级为红点
 * @param graphics 目标图形
 * @param mark 通行度标记
 * @param x 标记中心的像素横坐标
 * @param y 标记中心的像素纵坐标
 */
function drawPassMark(graphics: Graphics, mark: IMapPassMark, x: number, y: number): void {
  if (mark.dot) {
    graphics.circle(x, y, PASS_DOT_RADIUS).fill({ color: PASS_COLOR });
    return;
  }

  graphics.circle(x, y, PASS_RADIUS).fill({ color: PASS_CHIP, alpha: 0.9 });

  if (mark.blocked.up) drawPassArrow(graphics, x, y, 0, -1);
  if (mark.blocked.right) drawPassArrow(graphics, x, y, 1, 0);
  if (mark.blocked.down) drawPassArrow(graphics, x, y, 0, 1);
  if (mark.blocked.left) drawPassArrow(graphics, x, y, -1, 0);
}

/**
 * 画通行度叠加层
 * @param scene 场景容器
 * @param model 渲染模型
 */
function drawPassMarks(scene: Container, model: IMapRenderModel): void {
  if (model.passMarks.length === 0) return;

  const graphics = new Graphics();

  graphics.eventMode = 'none';

  for (const mark of model.passMarks) {
    const x = mark.x * MAP_CELL_SIZE + MAP_CELL_SIZE / 2;
    const y = mark.y * MAP_CELL_SIZE + MAP_CELL_SIZE / 2;

    drawPassMark(graphics, mark, x, y);
  }

  scene.addChild(graphics);
}

/**
 * 在一条水平边上补虚线
 * @param graphics 目标图形
 * @param from 起点横坐标
 * @param to 终点横坐标
 * @param y 该边的纵坐标
 */
function drawDashedHorizontal(graphics: Graphics, from: number, to: number, y: number): void {
  for (let x = from; x < to; x += SELECTION_DASH + SELECTION_GAP) {
    const end = Math.min(x + SELECTION_DASH, to);

    graphics.moveTo(x, y);
    graphics.lineTo(end, y);
  }
}

/**
 * 在一条竖直边上补虚线
 * @param graphics 目标图形
 * @param from 起点纵坐标
 * @param to 终点纵坐标
 * @param x 该边的横坐标
 */
function drawDashedVertical(graphics: Graphics, from: number, to: number, x: number): void {
  for (let y = from; y < to; y += SELECTION_DASH + SELECTION_GAP) {
    const end = Math.min(y + SELECTION_DASH, to);

    graphics.moveTo(x, y);
    graphics.lineTo(x, end);
  }
}

/**
 * 把格子矩形换算成像素矩形
 * @param rect 格子矩形
 * @returns 像素矩形
 */
function toPixelRect(rect: IMapRect): IMapRect {
  return {
    x: rect.x * MAP_CELL_SIZE,
    y: rect.y * MAP_CELL_SIZE,
    width: rect.width * MAP_CELL_SIZE,
    height: rect.height * MAP_CELL_SIZE,
  };
}

/**
 * 画框选：12% 填充 + 1px 虚线边框
 * @param scene 场景容器
 * @param rect 框选矩形（格子）
 */
function drawSelection(scene: Container, rect: IMapRect): void {
  const pixel = toPixelRect(rect);
  const fill = new Graphics();
  const border = new Graphics();

  fill.eventMode = 'none';
  fill.rect(pixel.x, pixel.y, pixel.width, pixel.height).fill({ color: SELECTION_COLOR, alpha: SELECTION_FILL_ALPHA });

  border.eventMode = 'none';
  border.setStrokeStyle({ color: SELECTION_COLOR, alpha: 1, width: 1 });
  drawDashedHorizontal(border, pixel.x + 0.5, pixel.x + pixel.width - 0.5, pixel.y + 0.5);
  drawDashedHorizontal(border, pixel.x + 0.5, pixel.x + pixel.width - 0.5, pixel.y + pixel.height - 0.5);
  drawDashedVertical(border, pixel.y + 0.5, pixel.y + pixel.height - 0.5, pixel.x + 0.5);
  drawDashedVertical(border, pixel.y + 0.5, pixel.y + pixel.height - 0.5, pixel.x + pixel.width - 0.5);
  border.stroke();

  scene.addChild(fill);
  scene.addChild(border);
}

/**
 * 画绘制预览：35% 填充 + 1px 描边，尺寸等于笔刷图案
 * @param scene 场景容器
 * @param rect 预览矩形（格子）
 */
function drawPreview(scene: Container, rect: IMapRect): void {
  const pixel = toPixelRect(rect);
  const preview = new Graphics();

  preview.eventMode = 'none';
  preview.rect(pixel.x, pixel.y, pixel.width, pixel.height).fill({ color: PREVIEW_COLOR, alpha: PREVIEW_FILL_ALPHA });
  preview.setStrokeStyle({ color: PREVIEW_COLOR, alpha: 1, width: 1 });
  preview.rect(pixel.x + 0.5, pixel.y + 0.5, pixel.width - 1, pixel.height - 1);
  preview.stroke();
  scene.addChild(preview);
}

/**
 * 画悬停格轮廓：1px、40% accent
 * @param scene 场景容器
 * @param position 悬停格
 */
function drawHover(scene: Container, position: IMapCellPosition): void {
  const hover = new Graphics();

  hover.eventMode = 'none';
  hover.setStrokeStyle({ color: HOVER_COLOR, alpha: HOVER_ALPHA, width: 1 });
  hover.rect(position.x * MAP_CELL_SIZE + 0.5, position.y * MAP_CELL_SIZE + 0.5, MAP_CELL_SIZE - 1, MAP_CELL_SIZE - 1);
  hover.stroke();
  scene.addChild(hover);
}

/**
 * 把一帧渲染模型画进场景：先画格子，再叠加网格、通行度标记、框选、预览与悬停轮廓
 * @param scene 场景容器
 * @param model 渲染模型
 * @param textures 按图片路径缓存的图集纹理
 * @param frames 本次绘制的临时裁切纹理收集处
 */
function drawModel(scene: Container, model: IMapRenderModel, textures: Map<string, Texture>, frames: Texture[]): void {
  for (const cell of model.cells) {
    const texture = cell.imagePath === undefined ? undefined : textures.get(cell.imagePath);

    scene.addChild(texture === undefined ? createPlaceholder(cell) : createCellSprite(texture, cell, frames));
  }

  drawGrid(scene, model);
  drawPassMarks(scene, model);

  if (model.selection !== undefined) drawSelection(scene, model.selection);
  if (model.preview !== undefined) drawPreview(scene, model.preview.rect);
  if (model.hover !== undefined) drawHover(scene, model.hover);
}

/**
 * 一个图块图片源：借用 hook 把字节变成 blob 地址，再把地址回报给画布
 * @param props 组件 props
 * @returns 不渲染任何 DOM
 */
function MapImageSource(props: IMapImageSourceProps): null {
  const url = useMapObjectUrl({
    path: props.path,
    mime: mimeOfImagePath(props.path),
    version: props.version,
    loadBytes: props.loadBytes,
  });
  const latest = useRef(props.onUrl);

  latest.current = props.onUrl;

  useEffect(() => {
    latest.current(props.path, url);
  }, [props.path, url]);

  return null;
}

export function MapSurface(props: IMapSurfaceProps): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<Container | null>(null);
  const texturesRef = useRef<Map<string, Texture>>(new Map());
  const framesRef = useRef<Texture[]>([]);
  const pendingRef = useRef<Set<string>>(new Set());
  const failedRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const readyState = useState(0);
  const readyVersion = readyState[0];
  const setReadyVersion = readyState[1];
  const textureState = useState(0);
  const textureVersion = textureState[0];
  const setTextureVersion = textureState[1];
  const onErrorRef = useRef(props.onError);
  const imageVersion = props.imageVersion ?? 0;

  onErrorRef.current = props.onError;

  useEffect(() => {
    mountedRef.current = true;

    return (): void => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;

    if (host === null) return undefined;

    let cancelled = false;
    let initialized = false;
    const app = new Application();

    void app
      .init({
        width: props.model.width,
        height: props.model.height,
        backgroundAlpha: 0,
        antialias: false,
        autoDensity: false,
        preference: 'webgl',
        autoStart: false,
      })
      .then(() => {
        initialized = true;

        if (cancelled) {
          app.destroy(true, { children: true });
          return;
        }

        app.canvas.style.imageRendering = 'pixelated';
        host.appendChild(app.canvas);

        const scene = new Container();

        scene.eventMode = 'none';
        app.stage.addChild(scene);
        appRef.current = app;
        sceneRef.current = scene;
        setReadyVersion((value) => value + 1);
      })
      .catch(() => {
        if (cancelled) return;

        const handler = onErrorRef.current;

        if (handler !== undefined) handler();
      });

    return (): void => {
      cancelled = true;
      sceneRef.current = null;
      appRef.current = null;

      if (initialized) app.destroy(true, { children: true });
    };
  }, [props.model.width, props.model.height, setReadyVersion]);

  useEffect(() => {
    for (const texture of texturesRef.current.values()) texture.destroy(true);

    texturesRef.current.clear();
    pendingRef.current.clear();
    failedRef.current.clear();
    setTextureVersion((value) => value + 1);
  }, [imageVersion, setTextureVersion]);

  useEffect(() => {
    const scene = sceneRef.current;

    if (scene === null) return;

    const previous = scene.removeChildren();

    for (const child of previous) child.destroy({ children: true });

    destroyFrames(framesRef.current);

    framesRef.current = [];
    drawModel(scene, props.model, texturesRef.current, framesRef.current);
    appRef.current?.render();
  }, [props.model, readyVersion, textureVersion]);

  useEffect(() => {
    const textures = texturesRef.current;

    return (): void => {
      for (const texture of textures.values()) texture.destroy(true);

      textures.clear();
      destroyFrames(framesRef.current);

      framesRef.current = [];
    };
  }, []);

  const handleUrl = (path: string, url: string | undefined): void => {
    if (url === undefined) return;
    if (texturesRef.current.has(path) || pendingRef.current.has(path) || failedRef.current.has(path)) return;

    pendingRef.current.add(path);

    void loadImageElement(url)
      .then((image) => {
        pendingRef.current.delete(path);

        if (!mountedRef.current) return;

        texturesRef.current.set(path, Texture.from(image));
        setTextureVersion((value) => value + 1);
      })
      .catch(() => {
        pendingRef.current.delete(path);
        failedRef.current.add(path);
      });
  };
  const imagePaths = collectImagePaths(props.model);

  return (
    <div
      ref={hostRef}
      className="emap-surface"
      data-test-id="map-surface"
      style={{ position: 'relative', width: props.model.width, height: props.model.height, lineHeight: 0 }}
    >
      {imagePaths.map((path) => (
        <MapImageSource
          key={path}
          path={path}
          version={imageVersion}
          loadBytes={props.loadBytes ?? loadNoBytes}
          onUrl={handleUrl}
        />
      ))}
    </div>
  );
}
