import { cleanup, configure, fireEvent, render, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetCategoryKind, AssetListFormat, IAssetCategory } from '../../react';
import { AssetPanelView } from '../components';
import { AssetPanelMode, AssetPanelStatus, IAssetEntry, IAssetPanelViewState, IAssetUpload } from '../types';

// jsdom 没有实现 `URL.createObjectURL`，预览组件却要在挂载后靠它把字节变成地址；这里只补这两个静态方法，
// 不整体替换 `URL` 构造器，避免影响其它依赖 `URL` 的代码
Object.defineProperty(URL, 'createObjectURL', { value: vi.fn((): string => 'blob:test'), configurable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

/** 视图测试沿用的一份分类清单：图片（对象数组）、音频 / 动画 / 字体，够覆盖转码开关该用哪一档与四类预览 */
const VIEW_CATEGORIES: readonly IAssetCategory[] = [
  {
    id: 'texture',
    label: '图片',
    kind: AssetCategoryKind.Image,
    dir: 'content/texture',
    listPath: 'content/texture/.list.jsonc',
    listFormat: AssetListFormat.ObjectList,
    listKey: 'textures',
  },
  {
    id: 'audio',
    label: '音频',
    kind: AssetCategoryKind.Audio,
    dir: 'content/audio',
    listPath: 'content/audio/.list.jsonc',
    listFormat: AssetListFormat.StringList,
    extension: '.wav',
  },
  {
    id: 'animation',
    label: '动画',
    kind: AssetCategoryKind.Animation,
    dir: 'content/animation',
    listPath: 'content/animation/.list.jsonc',
    listFormat: AssetListFormat.StringList,
    extension: '.anim',
  },
  {
    id: 'font',
    label: '字体',
    kind: AssetCategoryKind.Font,
    dir: 'content/font',
    listPath: 'content/font/.list.jsonc',
    listFormat: AssetListFormat.StringList,
  },
];

/**
 * 造一条素材条目
 * @param name 素材名
 * @param exists 字节文件是否存在
 * @returns 素材条目
 */
function entry(name: string, exists: boolean): IAssetEntry {
  return { name, path: `content/texture/${name}`, exists, registered: true };
}

/**
 * 造一条指定目录下的素材条目
 * @param dir 素材字节所在目录
 * @param name 素材名
 * @param exists 字节文件是否存在
 * @returns 素材条目
 */
function entryIn(dir: string, name: string, exists: boolean): IAssetEntry {
  return { name, path: `${dir}/${name}`, exists, registered: true };
}

/**
 * 以缺省值补全一份面板视图状态
 * @param overrides 需要覆盖的字段
 * @returns 完整的面板视图状态
 */
function makeView(overrides: Partial<IAssetPanelViewState>): IAssetPanelViewState {
  const base: IAssetPanelViewState = {
    status: AssetPanelStatus.Ready,
    mode: AssetPanelMode.Browse,
    categories: VIEW_CATEGORIES,
    categoryId: 'texture',
    entries: [],
    rows: [],
    configErrors: [],
    unsaved: false,
    transcodeOpen: false,
    transcoding: false,
    transcodeCapable: true,
  };

  return { ...base, ...overrides };
}

/**
 * 视图测试的缺省字节读取：一律视为没有字节，避免在 jsdom 里触碰 `blob:` 地址
 * @returns 永为 undefined 的字节
 */
function noBytes(): Promise<Uint8Array | undefined> {
  return Promise.resolve(undefined);
}

/** 视图测试的缺省分类选择回调：不做任何事 */
function noopSelect(): void {}

/**
 * 直接渲染纯视图组件（不经 core），并提供缺省回调
 * @param view 要渲染的面板视图状态
 * @param onRetry 可选的错误态重试回调
 * @returns 渲染结果
 */
function renderView(view: IAssetPanelViewState, onRetry?: () => void): ReturnType<typeof render> {
  return render(createElement(AssetPanelView, { view, loadBytes: noBytes, onSelectCategory: noopSelect, onRetry }));
}

/**
 * 渲染视图并注入自定义的字节读取回调
 * @param view 要渲染的面板视图状态
 * @param loadBytes 按路径读取字节的回调
 * @returns 渲染结果
 */
function renderViewWithBytes(
  view: IAssetPanelViewState,
  loadBytes: (path: string) => Promise<Uint8Array | undefined>,
): ReturnType<typeof render> {
  return render(createElement(AssetPanelView, { view, loadBytes, onSelectCategory: noopSelect }));
}

/** 上传相关的一组回调 */
interface IUploadHandlers {
  /** 通过白名单校验后的新增回调 */
  readonly onAddAsset: (upload: IAssetUpload) => void;
  /** 被白名单拒绝时的提示回调 */
  readonly onReject: (reason: string) => void;
}

/**
 * 把隐藏的文件选择框换成真实浏览器语义：`files` 返回同一个数组，`value` 被置空时把该数组就地清空
 * @param input 文件选择框
 * @param files 本次选择得到的文件列表（与 `files` 返回的是同一个数组）
 */
function installLiveFileList(input: HTMLInputElement, files: File[]): void {
  let value = '';

  Object.defineProperty(input, 'files', {
    configurable: true,
    get: (): File[] => files,
  });
  Object.defineProperty(input, 'value', {
    configurable: true,
    get: (): string => value,
    set: (next: string): void => {
      value = next;
      if (next === '') files.length = 0;
    },
  });
}

/**
 * 造一个带字节的文件；jsdom 的 File 若缺少 `arrayBuffer` 就补一个同义方法
 * @param name 文件名
 * @param bytes 文件字节
 * @param type MIME 类型
 * @returns 文件对象
 */
function createFile(name: string, bytes: Uint8Array, type: string): File {
  const copy = new Uint8Array(bytes.length);

  copy.set(bytes);

  const file = new File([copy], name, { type });

  if (typeof file.arrayBuffer !== 'function') {
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: async (): Promise<ArrayBuffer> => copy.buffer,
    });
  }

  return file;
}

/**
 * 渲染视图并注入新增 / 拒绝回调
 * @param view 要渲染的面板视图状态
 * @param handlers 上传相关的一组回调
 * @returns 渲染结果
 */
function renderViewWithUpload(view: IAssetPanelViewState, handlers: IUploadHandlers): ReturnType<typeof render> {
  return render(
    createElement(AssetPanelView, {
      view,
      loadBytes: noBytes,
      onSelectCategory: noopSelect,
      onAddAsset: handlers.onAddAsset,
      onReject: handlers.onReject,
    }),
  );
}

/** 预览用例的假字节：内容无关紧要，只表示「读到了字节」 */
const SAMPLE_BYTES = new Uint8Array([1, 2, 3, 4]);

/**
 * 读数即返回固定字节的读取器
 * @returns 固定字节
 */
function sampleBytes(): Promise<Uint8Array | undefined> {
  return Promise.resolve(SAMPLE_BYTES);
}

describe('素材面板视图', () => {
  // 正常态：卡片数与条目数一致，每张卡片的 title 是完整的素材名
  it('正常态按条目渲染卡片与 title', () => {
    const view = makeView({ entries: [entry('hero', true), entry('foe', true)] });
    const { container } = renderView(view);
    const cards = container.querySelectorAll('button[data-test-id^="asset-card-"]');

    expect(cards.length).toBe(2);
    expect(cards[0].getAttribute('title')).toBe('hero');
    expect(cards[1].getAttribute('title')).toBe('foe');
  });

  // 选中的那一条卡片带 is-selected，未选中的不带
  it('选中卡片带 is-selected', () => {
    const view = makeView({ entries: [entry('hero', true), entry('foe', true)], selectedName: 'hero' });
    const { container } = renderView(view);

    expect(container.querySelector('[data-test-id="asset-card-hero"]')?.classList.contains('is-selected')).toBe(true);
    expect(container.querySelector('[data-test-id="asset-card-foe"]')?.classList.contains('is-selected')).toBe(false);
  });

  // 字节缺失的卡片带 is-missing，并显示缺失标记
  it('缺失卡片带 is-missing 与缺失标记', () => {
    const view = makeView({ entries: [entry('ghost', false)] });
    const { container } = renderView(view);

    expect(container.querySelector('[data-test-id="asset-card-ghost"]')?.classList.contains('is-missing')).toBe(true);
    expect(container.querySelector('[data-test-id="asset-card-missing-ghost"]')).not.toBeNull();
  });

  // 加载态：显示「正在加载素材…」，保存与新增按钮禁用
  it('加载态显示文案并禁用保存与新增', () => {
    const view = makeView({ status: AssetPanelStatus.Loading });
    const { container } = renderView(view);

    expect(container.textContent).toContain('正在加载素材…');
    expect(container.querySelector('[data-test-id="asset-toolbar-save"]')?.hasAttribute('disabled')).toBe(true);
    expect(container.querySelector('[data-test-id="asset-toolbar-add"]')?.hasAttribute('disabled')).toBe(true);
  });

  // 空态：显示标题与上传引导两句文案
  it('空态显示标题与正文', () => {
    const view = makeView({ status: AssetPanelStatus.Empty });
    const { container } = renderView(view);

    expect(container.textContent).toContain('暂无素材');
    expect(container.textContent).toContain('该分类下还没有素材，点击「新增素材」上传一个本地文件。');
  });

  // 错误态：显示标题与正文，点重试触发传入的回调
  it('错误态显示文案并触发重试', () => {
    const onRetry = vi.fn();
    const view = makeView({ status: AssetPanelStatus.Error });
    const { container } = renderView(view, onRetry);
    const retry = container.querySelector('[data-test-id="asset-state-retry"]');

    expect(container.textContent).toContain('素材加载失败');
    expect(container.textContent).toContain('请检查该分类的资源是否存在，或稍后重试。');
    expect(retry).not.toBeNull();

    fireEvent.click(retry!);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // 面板级错误条：就绪态下把 state.error 渲染成可见错误条，不切换成整屏错误态
  it('就绪态显示面板级错误条', () => {
    const view = makeView({ error: '该素材的配置无法解析' });
    const { container } = renderView(view);
    const bar = container.querySelector('[data-test-id="asset-panel-error"]');

    expect(bar?.textContent).toBe('该素材的配置无法解析');
    expect(container.querySelector('[data-test-id="asset-panel"]')?.getAttribute('data-status')).toBe('ready');
    expect(container.querySelector('[data-test-id="asset-state-error"]')).toBeNull();
  });

  // 没有 error 时不渲染错误条
  it('无错误时不渲染错误条', () => {
    const { container } = renderView(makeView({}));

    expect(container.querySelector('[data-test-id="asset-panel-error"]')).toBeNull();
  });

  // 整屏错误态已经表达了错误，不再重复渲染错误条
  it('整屏错误态不重复渲染错误条', () => {
    const { container } = renderView(makeView({ status: AssetPanelStatus.Error, error: 'x' }));

    expect(container.querySelector('[data-test-id="asset-state-error"]')).not.toBeNull();
    expect(container.querySelector('[data-test-id="asset-panel-error"]')).toBeNull();
  });

  // 未选中：详情栏显示「选择一个素材查看详情」
  it('未选中详情显示引导文案', () => {
    const view = makeView({ entries: [entry('hero', true)] });
    const { container } = renderView(view);

    expect(container.querySelector('[data-test-id="asset-detail-empty"]')?.textContent).toContain(
      '选择一个素材查看详情',
    );
  });

  // 选中：详情显示名称、路径与替换 / 删除 / 配置三个按钮
  it('选中详情显示名称路径与操作按钮', () => {
    const view = makeView({ entries: [entry('hero', true)], selectedName: 'hero' });
    const { container } = renderView(view);

    expect(container.querySelector('.asset-detail-title')?.textContent).toBe('hero');
    expect(container.querySelector('.asset-detail-path')?.textContent).toBe('content/texture/hero');
    expect(container.querySelector('[data-test-id="asset-detail-replace"]')).not.toBeNull();
    expect(container.querySelector('[data-test-id="asset-detail-delete"]')).not.toBeNull();
    expect(container.querySelector('[data-test-id="asset-detail-config"]')).not.toBeNull();
  });

  // 分类导航：当前项带 aria-current="true"，非当前项不带
  it('分类导航当前项带 aria-current', () => {
    const { container } = renderView(makeView({}));

    expect(container.querySelector('[data-test-id="asset-category-texture"]')?.getAttribute('aria-current')).toBe(
      'true',
    );
    expect(
      container.querySelector('[data-test-id="asset-category-animation"]')?.getAttribute('aria-current'),
    ).toBeNull();
  });

  // 转码开关：当前分类是动画（不可转码）时「瘦身转码」禁用
  it('动画或字体分类禁用转码', () => {
    const { container } = renderView(makeView({ categoryId: 'animation' }));

    expect(container.querySelector('[data-test-id="asset-toolbar-transcode"]')?.hasAttribute('disabled')).toBe(true);
  });

  // 转码能力探测：图片分类可转码时入口可用
  it('图片分类可转码时入口可用', () => {
    const { container } = renderView(makeView({ categoryId: 'texture', transcodeCapable: true }));

    expect(container.querySelector('[data-test-id="asset-toolbar-transcode"]')?.hasAttribute('disabled')).toBe(false);
  });

  // 转码能力探测：图片分类在当前环境不可转码时禁用入口并给出提示，绝不静默失败（D-22）
  it('环境不支持转码时禁用入口并提示', () => {
    const { container } = renderView(makeView({ categoryId: 'texture', transcodeCapable: false }));

    expect(container.querySelector('[data-test-id="asset-toolbar-transcode"]')?.hasAttribute('disabled')).toBe(true);
    expect(container.querySelector('[data-test-id="asset-transcode-notice"]')?.textContent).toBe(
      '当前环境不支持图片转码',
    );
  });

  // 分类未注入：分类导航显示「尚无可用分类」
  it('无分类时显示尚无可用分类', () => {
    const view = makeView({ status: AssetPanelStatus.NoCategory, categories: [], categoryId: undefined });
    const { container } = renderView(view);

    expect(container.textContent).toContain('尚无可用分类');
  });

  // 图片卡片：读到的字节被转成 blob 地址后直接作为缩略图显示
  it('图片卡片在字节可用时渲染预览图', async () => {
    const view = makeView({ entries: [entry('hero.png', true)] });
    const { container } = renderViewWithBytes(view, sampleBytes);

    await waitFor(() => {
      expect(container.querySelector('[data-test-id="asset-card-preview-image"]')?.getAttribute('src')).toBe(
        'blob:test',
      );
    });
  });

  // 音频卡片：只画固定波形图标，绝不为卡片预览读取字节
  it('音频卡片渲染波形图标且不读字节', () => {
    const loadBytes = vi.fn(sampleBytes);
    const view = makeView({ categoryId: 'audio', entries: [entryIn('content/audio', 'bgm.wav', true)] });
    const { container } = renderViewWithBytes(view, loadBytes);

    expect(container.querySelector('[data-test-id="asset-card-preview-audio"]')).not.toBeNull();
    expect(loadBytes).not.toHaveBeenCalled();
  });

  // 动画卡片：暂时只显示占位文字
  it('动画卡片渲染占位', () => {
    const view = makeView({ categoryId: 'animation', entries: [entryIn('content/animation', 'sample.anim', true)] });
    const { container } = renderViewWithBytes(view, sampleBytes);

    expect(container.querySelector('[data-test-id="asset-card-preview-animation"]')?.textContent).toBe('动画');
  });

  // 字体卡片：用素材字体写「ABC」，并通过 @font-face 指向 blob 地址
  it('字体卡片用素材字体写 ABC', async () => {
    const view = makeView({ categoryId: 'font', entries: [entryIn('content/font', 'sample.ttf', true)] });
    const { container } = renderViewWithBytes(view, sampleBytes);

    expect(container.querySelector('[data-test-id="asset-card-preview-font"]')?.textContent).toBe('ABC');

    await waitFor(() => {
      const face = container.querySelector('[data-test-id="asset-font-face"]');

      expect(face?.textContent).toContain('@font-face');
      expect(face?.textContent).toContain('blob:test');
    });
  });

  // 缺失卡片：缩略图里只留空占位，不重复写「缺失」（文案由右上角徽标呈现）
  it('缺失卡片缩略图是空占位且不含缺失文字', () => {
    const view = makeView({ entries: [entry('ghost.png', false)] });
    const { container } = renderView(view);
    const thumb = container.querySelector('[data-test-id="asset-card-ghost.png"] .asset-card-thumb');

    expect(thumb?.querySelector('.asset-card-preview-missing')).not.toBeNull();
    expect(thumb?.textContent).toBe('');
  });

  // 详情预览：选中音频后出现可播放的 <audio controls>，地址来自读到的字节
  it('选中音频后详情出现可播放的播放器', async () => {
    const view = makeView({
      categoryId: 'audio',
      entries: [entryIn('content/audio', 'bgm.wav', true)],
      selectedName: 'bgm.wav',
    });
    const { container } = renderViewWithBytes(view, sampleBytes);

    await waitFor(() => {
      expect(container.querySelector('audio[controls]')?.getAttribute('src')).toBe('blob:test');
    });
  });

  // 详情预览：未选中素材时详情只有引导文案，不挂载播放器
  it('未选中素材时详情不含播放器', () => {
    const view = makeView({ categoryId: 'audio', entries: [entryIn('content/audio', 'bgm.wav', true)] });
    const { container } = renderViewWithBytes(view, sampleBytes);

    expect(container.querySelector('audio')).toBeNull();
  });

  // 卡片尺寸：默认按 116 渲染网格列宽，卡片高度与缩略图尺寸也按该比例给出
  it('默认渲染的卡片尺寸是 116', () => {
    const view = makeView({ entries: [entry('hero.png', true)] });
    const { container } = renderView(view);
    const grid = container.querySelector('[data-test-id="asset-grid"]');
    const card = container.querySelector('[data-test-id="asset-card-hero.png"]');
    const thumb = card?.querySelector('.asset-card-thumb');

    expect(grid?.getAttribute('data-card-size')).toBe('116');
    expect(grid?.getAttribute('style')).toContain('116px');
    expect(card?.getAttribute('style')).toContain('112px');
    expect(thumb?.getAttribute('style')).toContain('64px');
  });

  // 卡片尺寸：在「图标大小」滑块上按右方向键，网格列宽、卡片高度与缩略图一起变大
  // （rc-slider 先把 116 对齐到 96 + 8n 的 120，再前进一格，因此一次右移得到 128）
  it('拖动图标大小滑块后卡片与缩略图一起变大', () => {
    const view = makeView({ entries: [entry('hero.png', true)] });
    const { container } = renderView(view);
    const handle = container.querySelector('[data-test-id="asset-toolbar-card-size"] [role="slider"]');

    expect(handle).not.toBeNull();

    fireEvent.keyDown(handle!, { key: 'ArrowRight', keyCode: 39, which: 39 });

    const grid = container.querySelector('[data-test-id="asset-grid"]');
    const card = container.querySelector('[data-test-id="asset-card-hero.png"]');
    const thumb = card?.querySelector('.asset-card-thumb');

    expect(grid?.getAttribute('data-card-size')).toBe('128');
    expect(grid?.getAttribute('style')).toContain('128px');
    expect(card?.getAttribute('style')).toContain('124px');
    expect(thumb?.getAttribute('style')).toContain('71px');
  });

  // 图片缩略图：按百分比填满缩略图区，并在卡片变大后继续填满（G-03-7）
  it('图片预览按百分比填满缩略图并随滑块放大', async () => {
    const view = makeView({ entries: [entry('hero.png', true)] });
    const { container } = renderViewWithBytes(view, sampleBytes);

    await waitFor(() => {
      expect(container.querySelector('[data-test-id="asset-card-preview-image"]')?.getAttribute('src')).toBe(
        'blob:test',
      );
    });

    const image = container.querySelector<HTMLImageElement>('[data-test-id="asset-card-preview-image"]');

    expect(image?.style.width).toBe('100%');
    expect(image?.style.height).toBe('100%');
    expect(image?.style.objectFit).toBe('contain');

    const handle = container.querySelector('[data-test-id="asset-toolbar-card-size"] [role="slider"]');

    fireEvent.keyDown(handle!, { key: 'ArrowRight', keyCode: 39, which: 39 });

    const thumb = container.querySelector<HTMLElement>('[data-test-id="asset-card-hero.png"] .asset-card-thumb');
    const resized = container.querySelector<HTMLImageElement>('[data-test-id="asset-card-preview-image"]');

    expect(thumb?.getAttribute('style')).toContain('71px');
    expect(resized?.style.width).toBe('100%');
    expect(resized?.style.height).toBe('100%');
  });

  // 详情预览：选中字体后样例文字用素材字体渲染，@font-face 指向同一个 blob 地址
  it('选中字体后详情用素材字体渲染样例', async () => {
    const view = makeView({
      categoryId: 'font',
      entries: [entryIn('content/font', 'sample.ttf', true)],
      selectedName: 'sample.ttf',
    });
    const { container } = renderViewWithBytes(view, sampleBytes);

    expect(container.querySelector('.asset-detail [data-test-id="asset-font-sample"]')?.textContent).toBe(
      '魔塔 Mota 0123456789',
    );

    await waitFor(() => {
      const faces = Array.from(container.querySelectorAll('[data-test-id="asset-font-face"]'));

      expect(
        faces.some((face) => face.textContent?.includes('@font-face') && face.textContent.includes('blob:test')),
      ).toBe(true);
    });
  });

  // 新增入口的选择框提示按当前分类的白名单后缀给出，不再是什么文件都能选
  it('新增入口 accept 是当前分类的白名单后缀', () => {
    const { container } = renderView(makeView({}));
    const accept = container.querySelector('[data-test-id="asset-toolbar-add-input"]')?.getAttribute('accept') ?? '';

    expect(accept).toContain('.png');
    expect(accept).not.toContain('.txt');
  });

  // 白名单外的文件被拒绝：onReject 拿到明确文案，新增回调一次都不调用
  it('白名单外的文件走拒绝提示且不新增', async () => {
    const onAddAsset = vi.fn();
    const onReject = vi.fn();
    const { container } = renderViewWithUpload(makeView({}), { onAddAsset, onReject });
    const input = container.querySelector<HTMLInputElement>('[data-test-id="asset-toolbar-add-input"]');

    if (input === null) throw new Error('未找到新增入口的文件选择框');

    installLiveFileList(input, [createFile('readme.txt', new Uint8Array([1]), 'text/plain')]);
    fireEvent.change(input);

    await waitFor((): void => {
      expect(onReject).toHaveBeenCalledTimes(1);
    });

    expect(String(onReject.mock.calls[0][0])).toContain('不支持的素材格式');
    expect(onAddAsset).not.toHaveBeenCalled();
  });

  // 替换入口的提示由 AssetDetail 按 kind 自己算，与工具栏的大类清单一致
  it('替换入口 accept 是该大分类的内置清单', () => {
    const view = makeView({ entries: [entry('hero.png', true)], selectedName: 'hero.png' });
    const { container } = renderView(view);
    const accept = container.querySelector('[data-test-id="asset-detail-replace-input"]')?.getAttribute('accept');

    expect(accept).toBe('.png,.jpg,.jpeg,.webp,.gif,.bmp');
  });
});
