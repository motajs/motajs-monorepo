import { act, cleanup, configure, fireEvent, render, waitFor } from '@testing-library/react';
import { EditorCore } from '@motajs/editor-core';
import { ASSET_PANEL_TYPE_ID } from '@motajs/editor-impl/asset';
import { SYSTEM_PREFIX_END_MARKER } from '@motajs/editor-impl/shared';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryBackend } from '../backend/memoryBackend';
import {
  ASSET_DEMO_FILES,
  DEMO_TEXTURE_COUNT,
  DEMO_UNREGISTERED_TEXTURE_NAME,
  registerAssetDemo,
  seedUnregisteredAssetDemo,
} from '../demo/assetDemo';

// 开发宿主「新增素材」的顶层集成验证：经外壳打开素材面板、用工具栏真实的文件选择框选一个文件，
// 再用注入的内存文件系统证明「界面 → 数据层 → 文件」这条链路贯通（新增现在当场自动落盘，不再点保存）。
// 本文件不改 editor-impl 的任何行为，也不把浏览器刷新当作验收条件：内存后端刷新即重新 seed，
// 「重新切入」只用外壳的关闭标签页 / 新开标签页，以及同一个内存文件系统上的第二个核心。
// jsdom 没有实现 `URL.createObjectURL`，卡片与详情预览却要靠它把字节变成地址；只补这两个静态方法，
// 不整体替换 `URL` 构造器；每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积。

/** 新增用例里选中的那张图片的文件名 */
const PICKED_TEXTURE_NAME = 'picked-hero.png';

/** 内存后端里图片列表文件的路径 */
const TEXTURE_LIST_PATH = 'content/texture/.list.jsonc';

/** 演示素材里被选中作为上传字节的那张图片的路径 */
const SOURCE_TEXTURE_PATH = 'content/texture/hero.png';

configure({ testIdAttribute: 'data-test-id' });

Object.defineProperty(URL, 'createObjectURL', { value: vi.fn((): string => 'blob:test'), configurable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });

afterEach(() => {
  cleanup();
});

/**
 * 按路径取演示素材的原始字节
 * @param path 演示素材的路径
 * @returns 该文件的字节
 */
function demoBytes(path: string): Uint8Array {
  const file = ASSET_DEMO_FILES.find((item) => item.path === path);
  const content = file === undefined ? undefined : file.content;

  if (!(content instanceof Uint8Array)) throw new Error(`演示文件缺少字节：${path}`);

  return content;
}

/**
 * 取演示图片列表文件的系统前缀（结束标记行及其后的换行）
 * @returns 逐字保留的系统前缀原文
 */
function demoListPrefix(): string {
  const file = ASSET_DEMO_FILES.find((item) => item.path === TEXTURE_LIST_PATH);
  const content = file === undefined ? undefined : file.content;

  if (typeof content !== 'string') throw new Error('演示列表缺少正文');

  return content.slice(0, content.indexOf('\n') + 1);
}

/**
 * 装配开发宿主：只 seed 36 张小图集合，不生成两张 4096² 演示大图
 * @returns 已初始化的编辑器核心与其注入的内存后端
 */
async function createHost(): Promise<{ core: EditorCore; backend: MemoryBackend }> {
  const core = new EditorCore();
  const backend = new MemoryBackend();

  for (const file of ASSET_DEMO_FILES) backend.seed(file.path, file.content);
  registerAssetDemo(core);

  await core.initialize({ fs: backend, maxUndoStep: backend.maxUndoStep });
  return { core, backend };
}

/**
 * 装配带预置未登记样本的开发宿主：与 `createHost` 同构，只多写一张不在列表里的图片
 * @returns 已初始化的编辑器核心与其注入的内存后端
 */
async function createHostWithUnregistered(): Promise<{ core: EditorCore; backend: MemoryBackend }> {
  const core = new EditorCore();
  const backend = new MemoryBackend();

  for (const file of ASSET_DEMO_FILES) backend.seed(file.path, file.content);
  seedUnregisteredAssetDemo(backend);
  registerAssetDemo(core);

  await core.initialize({ fs: backend, maxUndoStep: backend.maxUndoStep });
  return { core, backend };
}

/**
 * 经外壳在首个标签页里打开素材面板并渲染外壳根
 * @param core 已初始化的编辑器核心
 * @returns 渲染容器
 */
async function openAssetPanel(core: EditorCore): Promise<HTMLElement> {
  const tabId = core.shellSystem.listTabs()[0].id;

  await act(async (): Promise<void> => {
    await core.shellSystem.openPanelInTab(tabId, ASSET_PANEL_TYPE_ID);
  });

  return render(createElement(core.shellSystem.render())).container;
}

/**
 * 取某张素材卡片的节点
 * @param container 渲染容器
 * @param name 素材名
 * @returns 卡片节点；未渲染时为 null
 */
function cardOf(container: HTMLElement, name: string): Element | null {
  return container.querySelector(`[data-test-id="asset-card-${name}"]`);
}

/**
 * 数当前网格里的素材卡片数量（只数卡片按钮，排除预览 / 缺失标记等内部节点）
 * @param container 渲染容器
 * @returns 卡片总数
 */
function cardCount(container: HTMLElement): number {
  return container.querySelectorAll('button[data-test-id^="asset-card-"]').length;
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
 * 经工具栏真实的文件选择框选一个本地文件
 * @param container 渲染容器
 * @param fileName 选中的文件名
 * @param type 选中文件的 MIME 类型
 */
function pickFile(container: HTMLElement, fileName: string, type = 'image/png'): void {
  const input = container.querySelector<HTMLInputElement>('[data-test-id="asset-toolbar-add-input"]');

  if (input === null) throw new Error('未找到工具栏的文件选择框');

  const source = demoBytes(SOURCE_TEXTURE_PATH);
  const bytes = new Uint8Array(source.length);

  bytes.set(source);

  const file = new File([bytes], fileName, { type });

  // jsdom 的 File 若缺少 `arrayBuffer`，就补一个同义方法，返回与选中字节完全一致的缓冲
  if (typeof file.arrayBuffer !== 'function') {
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: async (): Promise<ArrayBuffer> => bytes.buffer,
    });
  }

  installLiveFileList(input, [file]);
  fireEvent.change(input);
}

/**
 * 选一个文件、等新卡片出现，并等列表真的自动落盘
 * @param container 渲染容器
 * @param backend 注入的内存后端
 */
async function addAssetFile(container: HTMLElement, backend: MemoryBackend): Promise<void> {
  await waitFor((): void => {
    expect(cardOf(container, 'hero.png')).not.toBeNull();
  });

  pickFile(container, PICKED_TEXTURE_NAME);

  await waitFor((): void => {
    expect(cardOf(container, PICKED_TEXTURE_NAME)).not.toBeNull();
  });

  await waitFor(async (): Promise<void> => {
    const text = await backend.readFile(TEXTURE_LIST_PATH);

    expect(text).toContain(`"source": "${PICKED_TEXTURE_NAME}"`);
  });
}

describe('开发宿主新增素材', () => {
  // 从工具栏真实的文件选择框选一个文件后，网格里立刻多出一张新卡片
  it('从工具栏选文件后网格里多出新卡片', async () => {
    const { core } = await createHost();
    const container = await openAssetPanel(core);

    await waitFor((): void => {
      expect(cardOf(container, 'hero.png')).not.toBeNull();
    });

    const before = cardCount(container);

    expect(before).toBe(DEMO_TEXTURE_COUNT);

    pickFile(container, PICKED_TEXTURE_NAME);

    await waitFor((): void => {
      expect(cardOf(container, PICKED_TEXTURE_NAME)).not.toBeNull();
    });

    expect(cardCount(container)).toBe(before + 1);
  });

  // 新增后自动落盘：列表含新名字、系统前缀逐字不变，字节文件与选中的文件完全一致
  it('新增后自动落盘且系统前缀不变', async () => {
    const { core, backend } = await createHost();
    const container = await openAssetPanel(core);

    await addAssetFile(container, backend);

    const text = await backend.readFile(TEXTURE_LIST_PATH);
    const written = Array.from(await backend.readBinary(`content/texture/${PICKED_TEXTURE_NAME}`));
    const picked = Array.from(demoBytes(SOURCE_TEXTURE_PATH));

    expect(text.startsWith(SYSTEM_PREFIX_END_MARKER)).toBe(true);
    expect(text.startsWith(demoListPrefix())).toBe(true);
    expect(text).toContain(`"source": "${PICKED_TEXTURE_NAME}"`);
    expect(written).toEqual(picked);
  });

  // 关闭标签页再开一个新标签页切入素材面板，同一会话内新卡片仍在，总数为 37
  it('关闭标签页后重新切入素材面板新卡片仍在', async () => {
    const { core, backend } = await createHost();
    const container = await openAssetPanel(core);
    const tabId = core.shellSystem.listTabs()[0].id;

    await addAssetFile(container, backend);

    await act(async (): Promise<void> => {
      await core.shellSystem.closeTab(tabId);
    });

    await act(async (): Promise<void> => {
      const nextTab = core.shellSystem.openBlankTab();

      await core.shellSystem.openPanelInTab(nextTab, ASSET_PANEL_TYPE_ID);
    });

    await waitFor((): void => {
      expect(cardOf(container, PICKED_TEXTURE_NAME)).not.toBeNull();
    });

    expect(cardCount(container)).toBe(DEMO_TEXTURE_COUNT + 1);
  });

  // 同一个内存文件系统上换一个新核心 / 新面板实例后仍能读回已保存的卡片；这不是浏览器刷新
  it('同文件系统上重新初始化核心后新面板实例仍读到新卡片', async () => {
    const { core, backend } = await createHost();
    const container = await openAssetPanel(core);

    await addAssetFile(container, backend);

    const second = new EditorCore();

    registerAssetDemo(second);
    await second.initialize({ fs: backend, maxUndoStep: backend.maxUndoStep });

    const secondContainer = await openAssetPanel(second);

    await waitFor((): void => {
      expect(cardOf(secondContainer, PICKED_TEXTURE_NAME)).not.toBeNull();
    });

    expect(cardCount(secondContainer)).toBe(DEMO_TEXTURE_COUNT + 1);
  });

  // 开发宿主预置的未登记样本以黄卡出现：不在列表里、data-registered 为 false，总数为 37
  it('预置的未登记样本以黄卡出现', async () => {
    const { core } = await createHostWithUnregistered();
    const container = await openAssetPanel(core);

    await waitFor((): void => {
      expect(cardOf(container, DEMO_UNREGISTERED_TEXTURE_NAME)).not.toBeNull();
    });

    const card = cardOf(container, DEMO_UNREGISTERED_TEXTURE_NAME)!;

    expect(card.getAttribute('data-registered')).toBe('false');
    expect(card.classList.contains('is-unregistered')).toBe(true);
    expect(cardCount(container)).toBe(DEMO_TEXTURE_COUNT + 1);
  });

  // 白名单外的类型不产生卡片，并在界面上给出「不支持的素材格式」提示
  it('选中 .txt 不产生卡片并提示不支持', async () => {
    const { core } = await createHost();
    const container = await openAssetPanel(core);

    await waitFor((): void => {
      expect(cardOf(container, 'hero.png')).not.toBeNull();
    });

    const before = cardCount(container);

    pickFile(container, 'notes.txt', 'text/plain');

    await waitFor((): void => {
      expect(document.body.textContent).toContain('不支持的素材格式');
    });

    expect(cardCount(container)).toBe(before);
    expect(cardOf(container, 'notes.txt')).toBeNull();
  });
});
