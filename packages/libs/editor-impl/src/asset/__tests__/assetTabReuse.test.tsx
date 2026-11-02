import { act, cleanup, configure, waitFor } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam, IEditorPanelType } from '@motajs/editor-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetPanel, createAssetPanelType } from '..';
import { IAssetPanelTarget } from '../types';
import { ASSET_TEST_CATEGORIES, createAssetHarness, FakeFileSystem, listText } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 素材面板复用同一标签的守门用例：打开 A 再打开 B 只剩一个标签、A 的改动先落盘且只保存一次；
// 冲突未表态时复用被拒、不写盘；保存失败时保留 A 并返回假。实例一律经真实 `assetPanelType.create`
// 创建，确保 `AssetPanel.setTarget(openParam.target)` 真的执行。

/** 图片列表文件路径 */
const TEXTURE_LIST_PATH = 'content/texture/.list.jsonc';

/** 第一张素材的完整路径 */
const HERO_PATH = 'content/texture/hero.png';

/** 第二张素材的完整路径 */
const FOE_PATH = 'content/texture/foe.png';

/** 素材面板类型与捕获到的实例 */
interface IAssetTypeHarness {
  /** 真实工厂造出的面板类型 */
  readonly base: IEditorPanelType;
  /** 复制了真实能力、并按创建顺序收集实例的注册用类型 */
  readonly type: IEditorPanelType;
}

// 每个用例结束后卸载已挂载的组件并还原替身，避免 DOM 与调用记录在用例之间累积
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * 造一份两张素材的图片清单文本
 * @returns 带系统前缀的清单正文
 */
function seedTextures(): string {
  return listText({
    textures: [
      { source: 'hero.png', read: 0 },
      { source: 'foe.png', read: 0 },
    ],
  });
}

/**
 * 注册一个复用真实工厂、并收集实例的素材面板类型
 * @param system 已初始化的编辑器核心
 * @param created 按创建顺序收集面板实例的数组
 * @returns 真实类型与注册用类型
 */
function registerAssetType(system: EditorCore, created: AssetPanel[]): IAssetTypeHarness {
  const base = createAssetPanelType({ categories: ASSET_TEST_CATEGORIES });
  const type: IEditorPanelType = {
    ...base,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      const panel = base.create(param);

      if (panel instanceof AssetPanel) created.push(panel);

      return panel;
    },
  };

  system.shellSystem.registerPanelType(type);

  return { base, type };
}

/**
 * 在指定标签里打开素材面板
 * @param system 已初始化的编辑器核心
 * @param tabId 目标标签 id
 * @param type 注册用面板类型
 * @param target 打开参数里的素材目标
 * @param path 交给外壳去重用的文件路径
 * @returns 外壳的打开结果
 */
async function openAssetInTab(
  system: EditorCore,
  tabId: string,
  type: IEditorPanelType,
  target: IAssetPanelTarget,
  path: string,
): Promise<boolean> {
  let opened = false;

  await act(async () => {
    opened = await system.shellSystem.openPanelInTab(tabId, type.id, { target }, path);
  });

  return opened;
}

/**
 * 在暂存空白标签里打开素材面板；开空白标签与开面板必须在同一同步段内完成才能领走暂存
 * @param system 已初始化的编辑器核心
 * @param type 注册用面板类型
 * @param target 打开参数里的素材目标
 * @param path 交给外壳去重用的文件路径
 * @returns 外壳的打开结果
 */
async function openAssetInBlankTab(
  system: EditorCore,
  type: IEditorPanelType,
  target: IAssetPanelTarget,
  path: string,
): Promise<boolean> {
  let opened = false;

  await act(async () => {
    const tabId = system.shellSystem.openBlankTab();

    opened = await system.shellSystem.openPanelInTab(tabId, type.id, { target }, path);
  });

  return opened;
}

/**
 * 在第一个标签里打开素材 A，并制造一条未落盘的配置改动
 * @param system 已初始化的编辑器核心
 * @param type 注册用面板类型
 * @param created 收集面板实例的数组
 * @returns 第一张素材面板实例
 */
async function openDirtyHero(system: EditorCore, type: IEditorPanelType, created: AssetPanel[]): Promise<AssetPanel> {
  const firstTab = system.shellSystem.listTabs()[0].id;

  await openAssetInTab(system, firstTab, type, { categoryId: 'texture', assetName: 'hero.png' }, HERO_PATH);

  const panel = created[0];

  await panel.selectCategory('texture');
  await panel.openConfig('hero.png');
  panel.applyConfigEdit("['read']", 2);

  return panel;
}

/**
 * 只统计素材类型的标签
 * @param system 已初始化的编辑器核心
 * @returns 素材标签列表
 */
function assetTabs(system: EditorCore): readonly { readonly id: string }[] {
  return system.shellSystem.listTabs().filter((tab) => tab.typeId === 'asset');
}

describe('素材面板复用标签', () => {
  // 打开 A → 改配置 → 打开 B：一个标签、内容为 B、A 的改动已写盘、切出只发生一次
  it('打开 A 再打开 B 时复用同一标签，并先保存 A 的改动', async () => {
    const fs = new FakeFileSystem();

    fs.seed(TEXTURE_LIST_PATH, seedTextures());
    fs.seed(HERO_PATH, new Uint8Array([1]));
    fs.seed(FOE_PATH, new Uint8Array([2]));

    const system = await createAssetHarness(fs);
    const created: AssetPanel[] = [];
    const { base, type } = registerAssetType(system, created);

    expect(base.reuseTab).toBe(true);

    const panelA = await openDirtyHero(system, type, created);
    const switchOut = vi.spyOn(panelA, 'onSwitchOut');

    const opened = await openAssetInBlankTab(
      system,
      type,
      { categoryId: 'texture', assetName: 'foe.png' },
      FOE_PATH,
    );

    expect(opened).toBe(true);
    expect(assetTabs(system)).toHaveLength(1);
    expect(created).toHaveLength(2);
    expect(created[1]['store'].state.selectedName).toBe('foe.png');
    expect(switchOut).toHaveBeenCalledTimes(1);

    await waitFor(async (): Promise<void> => {
      const body = await fs.readFile(TEXTURE_LIST_PATH);

      expect(body).toContain('"read": 2');
    });
  });

  // 冲突未表态且 owner 仍是活动标签：不写盘、不复用、不切出，只把标签留在前台
  it('存在未表态冲突时拒绝复用且不写盘', async () => {
    const fs = new FakeFileSystem();

    fs.seed(TEXTURE_LIST_PATH, seedTextures());
    fs.seed(HERO_PATH, new Uint8Array([1]));
    fs.seed(FOE_PATH, new Uint8Array([2]));

    const system = await createAssetHarness(fs);
    const created: AssetPanel[] = [];
    const { type } = registerAssetType(system, created);

    const panelA = await openDirtyHero(system, type, created);

    panelA['pendingConflict'] = { categoryId: 'texture', text: '' };

    const switchOut = vi.spyOn(panelA, 'onSwitchOut');

    const opened = await openAssetInBlankTab(
      system,
      type,
      { categoryId: 'texture', assetName: 'foe.png' },
      FOE_PATH,
    );

    expect(opened).toBe(true);
    expect(assetTabs(system)).toHaveLength(1);
    expect(created).toHaveLength(1);
    expect(panelA.hasPendingConflict()).toBe(true);
    expect(switchOut).not.toHaveBeenCalled();

    const body = await fs.readFile(TEXTURE_LIST_PATH);

    expect(body).not.toContain('"read": 2');
  });

  // 保存没有结算：保留 A、不重建、返回假，面板仍报「仍有未落盘改动」
  it('保存失败时保留 A 并返回假', async () => {
    const fs = new FakeFileSystem();

    fs.seed(TEXTURE_LIST_PATH, seedTextures());
    fs.seed(HERO_PATH, new Uint8Array([1]));
    fs.seed(FOE_PATH, new Uint8Array([2]));

    const system = await createAssetHarness(fs);
    const created: AssetPanel[] = [];
    const { type } = registerAssetType(system, created);

    const panelA = await openDirtyHero(system, type, created);
    const dispose = vi.spyOn(panelA, 'dispose');

    // 让列表写盘在资源写入层直接失败：面板的写分类因此保留 unsaved，外壳的保存门禁随后拒绝释放
    fs.failing.add(TEXTURE_LIST_PATH);
    vi.spyOn(system.resourceSystem, 'writeContent').mockRejectedValue(new Error('write failed'));

    const opened = await openAssetInBlankTab(
      system,
      type,
      { categoryId: 'texture', assetName: 'foe.png' },
      FOE_PATH,
    );

    expect(opened).toBe(false);
    expect(assetTabs(system)).toHaveLength(1);
    expect(created).toHaveLength(1);
    expect(panelA['store'].state.selectedName).toBe('hero.png');
    expect(panelA.hasUnsavedChanges()).toBe(true);
    expect(dispose).not.toHaveBeenCalled();
  });
});
