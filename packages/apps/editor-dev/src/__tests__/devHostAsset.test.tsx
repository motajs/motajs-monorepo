import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditorCore, IUndoable } from '@motajs/editor-core';
import { AssetCapabilityProvider } from '@motajs/editor-impl/asset';
import { useTableCapabilities } from '@motajs/editor-impl/react';
import { createElement, ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryBackend } from '../backend/memoryBackend';
import { ASSET_DEMO_CATEGORIES, ASSET_DEMO_FILES, DEMO_TEXTURE_COUNT, registerAssetDemo } from '../demo/assetDemo';
import { DevCodeEditorProvider } from '../demo/devCodeEditor';
import { createTablePanelOpener, TABLE_PRESETS } from '../demo/tableDemo';

configure({ testIdAttribute: 'data-test-id' });

// jsdom 没有实现 `URL.createObjectURL`，卡片与详情预览却要靠它把字节变成地址；只补这两个静态方法，
// 不整体替换 `URL` 构造器
Object.defineProperty(URL, 'createObjectURL', { value: vi.fn((): string => 'blob:test'), configurable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 装配开发宿主组合根：内存文件系统 seed 全部演示素材、注册素材面板类型并订阅「无法撤销」提示
async function createHost(): Promise<EditorCore> {
  const core = new EditorCore();
  const backend = new MemoryBackend();

  for (const file of ASSET_DEMO_FILES) backend.seed(file.path, file.content);
  registerAssetDemo(core);

  await core.initialize({ fs: backend, maxUndoStep: backend.maxUndoStep });
  return core;
}

// 探针组件：把能力包里的素材分类数与预设表数渲染成可断言的文本（验证两层 Provider 不互相覆盖）
function CapabilityProbe(): ReactElement {
  const capabilities = useTableCapabilities();

  return createElement(
    'div',
    null,
    createElement(
      'span',
      { 'data-test-id': 'probe-asset-count' },
      String(capabilities.asset?.categories?.length ?? -1),
    ),
    createElement('span', { 'data-test-id': 'probe-preset-count' }, String(capabilities.tablePresets?.length ?? -1)),
  );
}

// 取面板当前渲染出的素材卡片测试标记（保序；只数卡片按钮，排除预览 / 缺失标记等内部节点）
function cardTestIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('button[data-test-id^="asset-card-"]')).map(
    (element) => element.getAttribute('data-test-id') ?? '',
  );
}

// 取出全部演示图片的字节（只挑 `content/texture` 下的 `.png`）
function textureBytes(): readonly Uint8Array[] {
  return ASSET_DEMO_FILES.filter(
    (item) => item.path.startsWith('content/texture/') && item.path.endsWith('.png'),
  ).map((item) => {
    if (!(item.content instanceof Uint8Array)) throw new Error(`演示图片缺少字节：${item.path}`);

    return item.content;
  });
}

// 读出图片列表文件里登记的素材条目数（跳过系统前缀行后按 JSON 解析）
function textureListCount(): number {
  const file = ASSET_DEMO_FILES.find((item) => item.path === 'content/texture/.list.jsonc');
  const content = file?.content;

  if (typeof content !== 'string') throw new Error('演示列表缺少正文');

  const parsed: unknown = JSON.parse(content.slice(content.indexOf('\n') + 1));

  if (typeof parsed !== 'object' || parsed === null) throw new Error('演示列表不是对象');

  const textures = Reflect.get(parsed, 'textures');

  if (!Array.isArray(textures)) throw new Error('演示列表缺少 textures');

  return textures.length;
}

/**
 * 取演示文件里的原始字节
 * @param suffix 文件路径后缀，如 `.png`
 * @returns 该文件的字节
 */
function demoBytes(suffix: string): Uint8Array {
  const file = ASSET_DEMO_FILES.find((item) => item.path.endsWith(suffix));
  const content = file?.content;

  if (!(content instanceof Uint8Array)) throw new Error(`演示文件缺少字节：${suffix}`);

  return content;
}

/**
 * 按大端读取 32 位无符号整数
 * @param bytes 字节序列
 * @param offset 起始偏移
 * @returns 读到的整数
 */
function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

/**
 * 把一段字节按 ASCII 还原成文本
 * @param bytes 字节序列
 * @param start 起始偏移
 * @param end 结束偏移（不含）
 * @returns 还原出的文本
 */
function asciiOf(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

describe('开发宿主素材接入', () => {
  // createPanelInstance('asset') 成功后渲染出素材面板根节点（data-test-id="asset-panel"）
  it('注册后能创建素材面板实例并渲染出面板根', async () => {
    const core = await createHost();
    const panel = await core.shellSystem.createPanelInstance('asset');

    if (panel === null) throw new Error('素材面板实例创建失败');

    const { container } = render(createElement(panel.render()));

    expect(container.querySelector('[data-test-id="asset-panel"]')).not.toBeNull();
  });

  // 切入素材面板后，默认的图片分类读出全部 36 条演示素材，前两张仍是 hero.png / tile.png
  it('切入后图片分类读出 36 条演示素材', async () => {
    const core = await createHost();
    const tabId = core.shellSystem.listTabs()[0].id;

    await act(async () => {
      await core.shellSystem.openPanelInTab(tabId, 'asset');
    });

    const { container } = render(createElement(core.shellSystem.render()));

    await waitFor(() => {
      const ids = cardTestIds(container);

      expect(ids.length).toBe(DEMO_TEXTURE_COUNT);
      expect(ids.slice(0, 2)).toEqual(['asset-card-hero.png', 'asset-card-tile.png']);
    });
  });

  // 素材能力 Provider 注入后：素材分类为 4，且表格预设表仍可见（两层 Provider 不互相覆盖）
  it('素材能力 Provider 注入后分类为 4 且表格预设仍可见', async () => {
    const core = await createHost();

    render(
      createElement(AssetCapabilityProvider, {
        access: core.resourceSystem,
        categories: ASSET_DEMO_CATEGORIES,
        capabilities: { tablePanel: createTablePanelOpener(core), tablePresets: TABLE_PRESETS },
        children: createElement(DevCodeEditorProvider, {
          capabilities: {},
          children: createElement(CapabilityProbe),
        }),
      }),
    );

    expect(screen.getByTestId('probe-asset-count').textContent).toBe('4');
    expect(screen.getByTestId('probe-preset-count').textContent).toBe(String(TABLE_PRESETS.length));
  });

  // 撤销命中屏障时订户回调被调用一次，且 undo 返回 false（屏障不弹栈）
  it('撤销命中屏障时订户回调被调用且返回 false', async () => {
    const core = await createHost();
    let blocked = 0;

    core.undoSystem.addHook({
      onUndoBlocked: (): void => {
        blocked += 1;
      },
    });

    const undoable: IUndoable = {
      undo: async (): Promise<void> => {},
      redo: async (): Promise<void> => {},
    };

    core.undoSystem.addUndoContext(undoable, { type: 0, data: null, barrier: true });

    let result = true;

    await act(async () => {
      result = await core.undoSystem.undo();
    });

    expect(result).toBe(false);
    expect(blocked).toBe(1);
  });

  // 打开配置：配置视图出现、校验提醒不出现、分类导航仍在；点其它分类退回浏览态
  it('打开配置无校验提醒且分类导航可退回浏览态', async () => {
    const core = await createHost();
    const tabId = core.shellSystem.listTabs()[0].id;

    await act(async () => {
      await core.shellSystem.openPanelInTab(tabId, 'asset');
    });

    const { container } = render(createElement(core.shellSystem.render()));

    await waitFor(() => {
      expect(container.querySelector('[data-test-id="asset-card-hero.png"]')).not.toBeNull();
    });

    fireEvent.click(container.querySelector('[data-test-id="asset-card-hero.png"]')!);

    await waitFor(() => {
      expect(container.querySelector('[data-test-id="asset-detail-config"]')).not.toBeNull();
    });

    fireEvent.click(container.querySelector('[data-test-id="asset-detail-config"]')!);

    await waitFor(() => {
      expect(container.querySelector('[data-test-id="asset-config-view"]')).not.toBeNull();
    });

    expect(container.querySelector('[data-test-id="asset-config-errors"]')).toBeNull();
    expect(container.querySelector('[data-test-id="asset-category-texture"]')).not.toBeNull();

    fireEvent.click(container.querySelector('[data-test-id="asset-category-animation"]')!);

    await waitFor(() => {
      expect(container.querySelector('[data-test-id="asset-config-view"]')).toBeNull();
    });
  });

  // 演示字节本身：36 张可解码 PNG（含多种宽高比与长方形）、WAV 不是静音、字体是真实字体而不是占位
  it('演示字节是看得见、听得到、能加载的样本', () => {
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const images = textureBytes();
    const ratios = new Set<string>();
    let hasRectangle = false;

    expect(images.length).toBeGreaterThanOrEqual(30);

    for (const png of images) {
      expect(Array.from(png.slice(0, 8))).toEqual(pngSignature);

      const width = readUint32BE(png, 16);
      const height = readUint32BE(png, 20);

      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      ratios.add(`${width}:${height}`);

      if (width !== height) hasRectangle = true;
    }

    expect(ratios.size).toBeGreaterThanOrEqual(3);
    expect(hasRectangle).toBe(true);
    expect(textureListCount()).toBe(images.length);

    const wav = demoBytes('.wav');

    expect(asciiOf(wav, 0, 4)).toBe('RIFF');
    expect(asciiOf(wav, 8, 12)).toBe('WAVE');
    expect(wav.slice(44).some((byte) => byte !== 0)).toBe(true);

    const font = demoBytes('.ttf');

    expect(font.length).toBeGreaterThan(10000);
    expect(Array.from(font.slice(0, 4))).toEqual([0, 1, 0, 0]);
  });

  // 宿主里真的显示预览：图片有缩略图、音频有波形图标、字体卡片用素材字体写 ABC
  it('宿主里图片、音频、字体三类卡片都显示预览', async () => {
    const core = await createHost();
    const tabId = core.shellSystem.listTabs()[0].id;

    await act(async () => {
      await core.shellSystem.openPanelInTab(tabId, 'asset');
    });

    const { container } = render(createElement(core.shellSystem.render()));

    await waitFor(() => {
      expect(container.querySelector('[data-test-id="asset-card-preview-image"]')?.getAttribute('src')).toBe(
        'blob:test',
      );
    });

    fireEvent.click(container.querySelector('[data-test-id="asset-category-audio"]')!);

    await waitFor(() => {
      expect(container.querySelector('[data-test-id="asset-card-bgm.wav"]')).not.toBeNull();
    });

    expect(container.querySelector('[data-test-id="asset-card-preview-audio"]')).not.toBeNull();

    fireEvent.click(container.querySelector('[data-test-id="asset-category-font"]')!);

    await waitFor(() => {
      expect(container.querySelector('[data-test-id="asset-card-preview-font"]')?.textContent).toBe('ABC');
    });
  });
});
