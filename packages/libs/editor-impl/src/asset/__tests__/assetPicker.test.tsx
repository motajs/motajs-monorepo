import { cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { IResourceAccess } from '@motajs/editor-core';
import { createElement, ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IAssetPickerOpener, IAssetPickerOpenRequest, IAssetPickerResult, useTableCapabilities } from '../../react';
import { AssetCapabilityProvider } from '..';
import { ASSET_TEST_CATEGORIES, createAssetHarness, FakeFileSystem, listText } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

/** 一次选择器打开的捕获结果：返回的 Promise 与当次取到的打开器 */
interface IPickerCapture {
  /** 打开器 open 返回的 Promise；尚未打开时为 undefined */
  promise?: Promise<IAssetPickerResult | null>;
  /** 本次从能力包取到的选择器；尚未打开时为 undefined */
  picker?: IAssetPickerOpener;
}

/** 选择器测试用的小宿主：读取能力包并把打开结果交给调用方 */
interface IPickerHostProps {
  /** 捕获对象 */
  readonly capture: IPickerCapture;
  /** 打开选择器时用的请求 */
  readonly request: IAssetPickerOpenRequest;
}

/** 递增的 blob 地址序号 */
let objectUrlSerial = 0;
/** 本次测试进程内已创建的 blob 地址 */
const createdObjectUrls: string[] = [];
/** 本次测试进程内已回收的 blob 地址 */
const revokedObjectUrls: string[] = [];

/**
 * 选择器测试宿主：把上下文里的素材选择器经一个按钮触发，并把 Promise 交给捕获对象
 * @param props 宿主 props（捕获对象 + 打开请求）
 * @returns 触发按钮元素
 */
function PickerHost(props: IPickerHostProps): ReactElement {
  const capabilities = useTableCapabilities();
  const asset = capabilities.asset;
  const picker = asset === undefined ? undefined : asset.picker;

  const handleOpen = (): void => {
    if (picker === undefined) return;

    props.capture.picker = picker;
    props.capture.promise = picker.open(props.request);
  };

  return createElement('button', { 'data-test-id': 'open-picker', onClick: handleOpen }, '打开');
}

/**
 * 装配「编辑器核心 + 素材能力 Provider + 宿主」并返回捕获对象
 * @param access 资源访问口
 * @param request 打开请求
 * @param injected 可选的显式注入选择器
 * @returns 捕获对象
 */
function renderPicker(
  access: IResourceAccess,
  request: IAssetPickerOpenRequest,
  injected?: IAssetPickerOpener,
): IPickerCapture {
  const capture: IPickerCapture = {};

  render(
    createElement(AssetCapabilityProvider, {
      access,
      categories: ASSET_TEST_CATEGORIES,
      picker: injected,
      children: createElement(PickerHost, { capture, request }),
    }),
  );

  return capture;
}

// 在 jsdom 未实现的对象地址接口上安装桩：createObjectURL 返回可预测的 blob 地址并计数
beforeEach(() => {
  URL.createObjectURL = (): string => {
    objectUrlSerial += 1;
    const url = `blob:mock-${objectUrlSerial}`;

    createdObjectUrls.push(url);
    return url;
  };
  URL.revokeObjectURL = (url: string): void => {
    revokedObjectUrls.push(url);
  };
});

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

/**
 * 打开选择器并等待候选项列表出现
 * @param capture 捕获对象
 * @returns 无
 */
async function openAndWaitForList(capture: IPickerCapture): Promise<void> {
  fireEvent.click(screen.getByTestId('open-picker'));
  await screen.findByTestId('multiselect-list');
  expect(capture.picker).toBeDefined();
}

/**
 * 取捕获的打开 Promise，缺失时抛错
 * @param capture 捕获对象
 * @returns 打开 Promise
 */
function requirePromise(capture: IPickerCapture): Promise<IAssetPickerResult | null> {
  const promise = capture.promise;

  if (promise === undefined) throw new Error('未捕获到选择器 Promise');

  return promise;
}

describe('素材选择器', () => {
  // 图片分类：列表有两条且字节存在时，候选项渲染 blob 缩略图
  it('图片分类渲染 blob 缩略图', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero' }, { source: 'foe' }] }));
    fs.seed('content/texture/hero', new Uint8Array([1, 2, 3]));
    fs.seed('content/texture/foe', new Uint8Array([4, 5, 6]));

    const system = await createAssetHarness(fs);
    const capture = renderPicker(system.resourceSystem, { title: '选择图片', categoryId: 'texture' });

    await openAndWaitForList(capture);

    expect(screen.getByTestId('multiselect-item-hero')).not.toBeNull();
    expect(screen.getByTestId('multiselect-item-foe')).not.toBeNull();
    expect(screen.getByTestId('multiselect-thumb-hero').getAttribute('src')).toMatch(/^blob:/);
    expect(screen.getByTestId('multiselect-thumb-foe').getAttribute('src')).toMatch(/^blob:/);
  });

  // 音频分类：候选项渲染 blob 内联试听
  it('音频分类渲染 blob 内联试听', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/audio/.list.jsonc', listText({ audios: [{ source: 'bgm' }, { source: 'se' }] }));
    fs.seed('content/audio/bgm', new Uint8Array([1]));
    fs.seed('content/audio/se', new Uint8Array([2]));

    const system = await createAssetHarness(fs);
    const capture = renderPicker(system.resourceSystem, { title: '选择音频', categoryId: 'audio' });

    await openAndWaitForList(capture);

    expect(screen.getByTestId('multiselect-audio-bgm').getAttribute('src')).toMatch(/^blob:/);
    expect(screen.getByTestId('multiselect-audio-se').getAttribute('src')).toMatch(/^blob:/);
  });

  // 动画分类：候选项渲染动画预览提示，无需读字节
  it('动画分类渲染动画预览提示', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/animation/.list.jsonc', listText(['run', 'idle']));

    const system = await createAssetHarness(fs);
    const capture = renderPicker(system.resourceSystem, { title: '选择动画', categoryId: 'animation' });

    await openAndWaitForList(capture);

    expect(screen.getByTestId('multiselect-item-run')).not.toBeNull();
    expect(screen.getByTestId('multiselect-anim-run')).not.toBeNull();
    expect(screen.getByTestId('multiselect-anim-idle')).not.toBeNull();
  });

  // 空列表：显示「暂无可选项」而不是错误或加载
  it('空列表显示暂无可选项', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [] }));

    const system = await createAssetHarness(fs);
    const capture = renderPicker(system.resourceSystem, { title: '选择图片', categoryId: 'texture' });

    fireEvent.click(screen.getByTestId('open-picker'));

    expect(await screen.findByTestId('multiselect-empty')).not.toBeNull();
    expect(capture.picker).toBeDefined();
  });

  // 列表正文非法：进错误态而不是空态
  it('列表正文非法显示错误态', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', '{oops');

    const system = await createAssetHarness(fs);
    const capture = renderPicker(system.resourceSystem, { title: '选择图片', categoryId: 'texture' });

    fireEvent.click(screen.getByTestId('open-picker'));

    expect(await screen.findByTestId('multiselect-error')).not.toBeNull();
    expect(capture.picker).toBeDefined();
  });

  // 勾选两条后点确定：open 的 Promise 解析出选中的两个素材名
  it('确认返回选中的素材名', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero' }, { source: 'foe' }] }));
    fs.seed('content/texture/hero', new Uint8Array([1]));
    fs.seed('content/texture/foe', new Uint8Array([2]));

    const system = await createAssetHarness(fs);
    const capture = renderPicker(system.resourceSystem, { title: '选择图片', categoryId: 'texture' });

    await openAndWaitForList(capture);

    const checkboxes = screen.getAllByRole('checkbox');

    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByTestId('multiselect-confirm'));

    await expect(requirePromise(capture)).resolves.toEqual({ ids: ['hero', 'foe'] });
  });

  // 取消：Promise 解析出 null，且本次创建的 blob 地址全部被回收
  it('取消解析 null 并回收 blob 地址', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero' }, { source: 'foe' }] }));
    fs.seed('content/texture/hero', new Uint8Array([1]));
    fs.seed('content/texture/foe', new Uint8Array([2]));

    const system = await createAssetHarness(fs);
    const capture = renderPicker(system.resourceSystem, { title: '选择图片', categoryId: 'texture' });
    const createdBefore = createdObjectUrls.length;

    await openAndWaitForList(capture);

    const created = createdObjectUrls.slice(createdBefore);

    expect(created.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId('multiselect-cancel'));

    await expect(requirePromise(capture)).resolves.toBeNull();

    for (const url of created) expect(revokedObjectUrls).toContain(url);
  });

  // 显式注入假选择器时，能力包里的选择器就是注入的那个（不被默认实现覆盖）
  it('显式注入的选择器优先', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [] }));

    const system = await createAssetHarness(fs);
    const injected: IAssetPickerOpener = {
      open: (): Promise<IAssetPickerResult | null> => Promise.resolve({ ids: ['injected'] }),
    };
    const capture = renderPicker(system.resourceSystem, { title: '选择图片', categoryId: 'texture' }, injected);

    fireEvent.click(screen.getByTestId('open-picker'));

    await expect(requirePromise(capture)).resolves.toEqual({ ids: ['injected'] });
    expect(capture.picker).toBe(injected);
  });
});
