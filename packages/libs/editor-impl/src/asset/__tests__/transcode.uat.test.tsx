import { cleanup, configure, render } from '@testing-library/react';
import { EditorCore } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ASSET_PANEL_TYPE_ID, AssetPanel, IAssetTranscodeOptions, IAssetTranscodeService } from '..';
import { ASSET_TEST_CATEGORIES, createAssetHarness, FakeFileSystem, listText } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 转码编排集成用例：用一个假转码服务驱动 AssetPanel.transcodeAssets，
// 只断言编排本身（覆盖 / 保留 / 失败隔离 / 列表改名 / 汇总 / 屏障），不碰真实 WebCodecs。

/** 假转码服务：返回带固定标记的字节；首字节等于 failFirstByte 时抛错以模拟单项失败 */
class FakeTranscodeService implements IAssetTranscodeService {
  /** 首字节等于此值时报错；未设置时任何项都成功 */
  failFirstByte: number | undefined;

  /**
   * 探测当前环境能否执行指定种类的转码
   * @returns 恒为 true，测试不关心真实能力探测
   */
  async canTranscode(): Promise<boolean> {
    return true;
  }

  /**
   * 把图片字节转码为 WebP：追加固定标记字节
   * @param bytes 原始图片字节
   * @returns 转码后的字节
   */
  async imageToWebp(bytes: Uint8Array): Promise<Uint8Array> {
    if (bytes[0] === this.failFirstByte) throw new Error('假转码失败');

    return new Uint8Array([...bytes, 0x77]);
  }

  /**
   * 把音频字节转码为 WebM/Opus：追加固定标记字节
   * @param bytes 原始音频字节
   * @returns 转码后的字节
   */
  async audioToWebmOpus(bytes: Uint8Array): Promise<Uint8Array> {
    if (bytes[0] === this.failFirstByte) throw new Error('假转码失败');

    return new Uint8Array([...bytes, 0x6d]);
  }
}

/**
 * 经外壳注册一个捕获具体实例的面板类型并打开，返回数据层面的素材面板
 * @param system 已初始化的编辑器核心
 * @param service 注入的转码服务替身
 * @returns 数据层面的素材面板实例
 */
async function openPanel(system: EditorCore, service: IAssetTranscodeService): Promise<AssetPanel> {
  const created: AssetPanel[] = [];

  system.shellSystem.registerPanelType({
    id: ASSET_PANEL_TYPE_ID,
    name: '素材管理器',
    icon: createElement('div'),
    create: (param): AssetPanel => {
      const panel = new AssetPanel(param, { categories: ASSET_TEST_CATEGORIES }, service);

      created.push(panel);

      return panel;
    },
  });

  const tabId = system.shellSystem.listTabs()[0].id;

  await system.shellSystem.openPanelInTab(tabId, ASSET_PANEL_TYPE_ID);

  return created[0];
}

/**
 * 往图片分类种入一份列表文件（条目即传入的名字）
 * @param fs 内存文件系统替身
 * @param names 要登记的素材名
 */
function seedTexture(fs: FakeFileSystem, names: readonly string[]): void {
  fs.seed('content/texture/.list.jsonc', listText({ textures: names.map((name) => ({ source: name })) }));
}

/**
 * 造一份图片转码参数
 * @param coverOrigin 是否覆盖旧文件
 * @returns 转码参数
 */
function imageOptions(coverOrigin: boolean): IAssetTranscodeOptions {
  return { quality: 80, bitrate: 96000, sampleRate: 48000, coverOrigin };
}

/**
 * 渲染面板视图并返回其容器
 * @param panel 素材面板实例
 * @returns 渲染容器
 */
function renderPanel(panel: AssetPanel): HTMLElement {
  return render(createElement(panel.render())).container;
}

/**
 * 取面板视图当前列出的卡片测试标记（保序）
 * @param container 渲染容器
 * @returns 卡片测试标记列表
 */
function entryNames(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('button[data-test-id^="asset-card-"]')).map(
    (element) => element.getAttribute('data-test-id') ?? '',
  );
}

/**
 * 取工具栏的保存按钮
 * @param container 渲染容器
 * @returns 保存按钮元素；未挂载时为 null
 */
function saveButton(container: HTMLElement): Element | null {
  return container.querySelector('[data-test-id="asset-toolbar-save"]');
}

/**
 * 判断某元素是否处于禁用态
 * @param element 待判断的元素
 * @returns 元素存在且带 disabled 属性时为 true
 */
function isDisabled(element: Element | null): boolean {
  return element !== null && element.hasAttribute('disabled');
}

describe('素材瘦身转码编排', () => {
  // ① 不覆盖：新文件写入、旧文件改名为 origin 保留、列表条目名同步改扩展名、标记未保存
  it('不覆盖时保留 origin 文件并改名列表条目', async () => {
    const fs = new FakeFileSystem();
    const service = new FakeTranscodeService();

    seedTexture(fs, ['a.png', 'b.png']);
    fs.seed('content/texture/a.png', new Uint8Array([1]));
    fs.seed('content/texture/b.png', new Uint8Array([2]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system, service);

    await panel.selectCategory('texture');
    await panel.transcodeAssets(['a.png', 'b.png'], imageOptions(false));

    expect(Array.from(await fs.readBinary('content/texture/a.webp'))).toEqual([1, 0x77]);
    expect(Array.from(await fs.readBinary('content/texture/b.webp'))).toEqual([2, 0x77]);
    expect(Array.from(await fs.readBinary('content/texture/a-origin.png'))).toEqual([1]);
    expect(Array.from(await fs.readBinary('content/texture/b-origin.png'))).toEqual([2]);
    await expect(fs.readBinary('content/texture/a.png')).rejects.toThrow();

    const container = renderPanel(panel);

    expect(entryNames(container)).toEqual(['asset-card-a.webp', 'asset-card-b.webp']);
    expect(isDisabled(saveButton(container))).toBe(false);
  });

  // ② 覆盖：原文件被替换、不保留 origin 文件
  it('覆盖时替换原文件且不保留 origin', async () => {
    const fs = new FakeFileSystem();
    const service = new FakeTranscodeService();

    seedTexture(fs, ['a.png']);
    fs.seed('content/texture/a.png', new Uint8Array([1]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system, service);

    await panel.selectCategory('texture');
    await panel.transcodeAssets(['a.png'], imageOptions(true));

    expect(Array.from(await fs.readBinary('content/texture/a.webp'))).toEqual([1, 0x77]);
    await expect(fs.readBinary('content/texture/a.png')).rejects.toThrow();
    await expect(fs.readBinary('content/texture/a-origin.png')).rejects.toThrow();
  });

  // ③ 目标已存在：该项失败、文件未被改写、汇总里有失败项
  it('目标文件已存在时该项失败且不改写', async () => {
    const fs = new FakeFileSystem();
    const service = new FakeTranscodeService();

    seedTexture(fs, ['a.png']);
    fs.seed('content/texture/a.png', new Uint8Array([1]));
    fs.seed('content/texture/a.webp', new Uint8Array([9]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system, service);

    await panel.selectCategory('texture');
    await panel.transcodeAssets(['a.png'], imageOptions(true));

    expect(Array.from(await fs.readBinary('content/texture/a.png'))).toEqual([1]);
    expect(Array.from(await fs.readBinary('content/texture/a.webp'))).toEqual([9]);

    const container = renderPanel(panel);

    expect(container.querySelector('[data-test-id="asset-transcode-summary"]')).not.toBeNull();
    expect(container.textContent).toContain('目标文件已存在');
  });

  // ④ 单项失败不中断：让第二条抛错，第一条仍成功，汇总里只有一条失败
  it('单项失败不中断整批', async () => {
    const fs = new FakeFileSystem();
    const service = new FakeTranscodeService();

    seedTexture(fs, ['a.png', 'b.png']);
    fs.seed('content/texture/a.png', new Uint8Array([1]));
    fs.seed('content/texture/b.png', new Uint8Array([2]));

    service.failFirstByte = 2;

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system, service);

    await panel.selectCategory('texture');
    await panel.transcodeAssets(['a.png', 'b.png'], imageOptions(true));

    expect(Array.from(await fs.readBinary('content/texture/a.webp'))).toEqual([1, 0x77]);
    await expect(fs.readBinary('content/texture/b.webp')).rejects.toThrow();

    const container = renderPanel(panel);

    expect(container.textContent).toContain('b.png');
    expect(container.textContent).toContain('假转码失败');
  });

  // ⑤ 转码改字节 = 不可撤销：撤销被屏障挡住，返回 false
  it('转码后撤销被屏障挡住', async () => {
    const fs = new FakeFileSystem();
    const service = new FakeTranscodeService();

    seedTexture(fs, ['a.png']);
    fs.seed('content/texture/a.png', new Uint8Array([1]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system, service);

    await panel.selectCategory('texture');
    await panel.transcodeAssets(['a.png'], imageOptions(true));

    expect(await system.undoSystem.undo()).toBe(false);
  });

  // ⑥ 全部成功：提示文案为「转码完成，共 N 个」
  it('全部成功时提示转码完成数量', async () => {
    const fs = new FakeFileSystem();
    const service = new FakeTranscodeService();

    seedTexture(fs, ['a.png', 'b.png']);
    fs.seed('content/texture/a.png', new Uint8Array([1]));
    fs.seed('content/texture/b.png', new Uint8Array([2]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system, service);

    await panel.selectCategory('texture');
    await panel.transcodeAssets(['a.png', 'b.png'], imageOptions(true));

    const container = renderPanel(panel);

    expect(container.querySelector('[data-test-id="asset-notice"]')?.textContent).toBe('转码完成，共 2 个');
  });

  // ⑦ 空选择：不写任何文件、不登记屏障
  it('空选择不写文件也不登记屏障', async () => {
    const fs = new FakeFileSystem();
    const service = new FakeTranscodeService();

    seedTexture(fs, ['a.png']);
    fs.seed('content/texture/a.png', new Uint8Array([1]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system, service);

    await panel.selectCategory('texture');
    await panel.transcodeAssets([], imageOptions(true));

    await expect(fs.readBinary('content/texture/a.webp')).rejects.toThrow();
    expect(Array.from(await fs.readBinary('content/texture/a.png'))).toEqual([1]);
    expect(await system.undoSystem.undo()).toBe(false);
  });

  // ⑧ 源文件已带目标扩展名（覆盖旧文件）：就地覆盖写回，绝不写后删同一路径（回归 CR-01 数据丢失）
  it('源文件已是目标扩展名时原地覆盖而不删除源文件', async () => {
    const fs = new FakeFileSystem();
    const service = new FakeTranscodeService();

    seedTexture(fs, ['a.webp']);
    fs.seed('content/texture/a.webp', new Uint8Array([1]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system, service);

    await panel.selectCategory('texture');
    await panel.transcodeAssets(['a.webp'], imageOptions(true));

    expect(Array.from(await fs.readBinary('content/texture/a.webp'))).toEqual([1, 0x77]);
    await expect(fs.readBinary('content/texture/a.png')).rejects.toThrow();
    await expect(fs.readBinary('content/texture/a-origin.webp')).rejects.toThrow();
  });

  // ⑨ 源文件已带目标扩展名（不覆盖旧文件）：同样就地覆盖，不产生 origin 备份，也不删除源文件（回归 CR-01）
  it('不覆盖且源已是目标扩展名时原地覆盖并保留源文件', async () => {
    const fs = new FakeFileSystem();
    const service = new FakeTranscodeService();

    seedTexture(fs, ['b.webp']);
    fs.seed('content/texture/b.webp', new Uint8Array([2]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system, service);

    await panel.selectCategory('texture');
    await panel.transcodeAssets(['b.webp'], imageOptions(false));

    expect(Array.from(await fs.readBinary('content/texture/b.webp'))).toEqual([2, 0x77]);
    await expect(fs.readBinary('content/texture/b-origin.webp')).rejects.toThrow();
  });

  // ⑩ 不覆盖且 origin 文件已存在：该项失败、既有备份与源文件都不被改写（回归 WR-08）
  it('保留文件已存在时不覆盖既有备份', async () => {
    const fs = new FakeFileSystem();
    const service = new FakeTranscodeService();

    seedTexture(fs, ['a.png']);
    fs.seed('content/texture/a.png', new Uint8Array([1]));
    fs.seed('content/texture/a-origin.png', new Uint8Array([9]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system, service);

    await panel.selectCategory('texture');
    await panel.transcodeAssets(['a.png'], imageOptions(false));

    expect(Array.from(await fs.readBinary('content/texture/a.png'))).toEqual([1]);
    expect(Array.from(await fs.readBinary('content/texture/a-origin.png'))).toEqual([9]);
    await expect(fs.readBinary('content/texture/a.webp')).rejects.toThrow();

    const container = renderPanel(panel);

    expect(container.textContent).toContain('保留文件已存在');
  });
});
