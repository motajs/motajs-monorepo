import { cleanup, configure, fireEvent, render, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetFileInput } from '../components/AssetFileInput';
import { ASSET_MAX_UPLOAD_BYTES } from '../constants';
import { IAssetUpload } from '../types';

// 文件选择顺序的回归：真实浏览器里把 `<input type="file">` 的 `value` 置空，会把同一个 FileList
// 一起清空。所以实现必须「先取 File、后清空」。这里用「活文件列表」替身复制该语义——置空 value 时
// 就地清空同一个数组——并直接 `fireEvent.change(input)`，不再用 `target: { files }` 绕过清空。

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

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
 * 渲染一个只带最简回调的文件选择入口
 * @param onPick 选中文件后的回调
 * @param onReject 被拒绝时的回调
 * @returns 渲染结果
 */
function renderInput(
  onPick: (upload: IAssetUpload) => void,
  onReject?: (reason: string) => void,
): ReturnType<typeof render> {
  return render(createElement(AssetFileInput, { label: '新增素材', testId: 'asset-test-add', onPick, onReject }));
}

/**
 * 取渲染出的隐藏文件选择框
 * @param container 渲染容器
 * @returns 文件选择框
 */
function inputOf(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('[data-test-id="asset-test-add-input"]');

  if (input === null) throw new Error('未找到文件选择框');

  return input;
}

describe('文件选择入口的取值顺序', () => {
  // 清空 value 会把同一个文件列表变空时，选中一张 .png 仍能把名字与字节交给上层
  it('先取文件再清空，选中后回调名字与字节', async () => {
    const onPick = vi.fn();
    const { container } = renderInput(onPick);
    const input = inputOf(container);
    const bytes = new Uint8Array([1, 2, 3]);

    installLiveFileList(input, [createFile('hero.png', bytes, 'image/png')]);
    fireEvent.change(input);

    await waitFor((): void => {
      expect(onPick).toHaveBeenCalledTimes(1);
    });

    const upload = onPick.mock.calls[0][0] as IAssetUpload;

    expect(upload.name).toBe('hero.png');
    expect(Array.from(upload.bytes)).toEqual([1, 2, 3]);
  });

  // 选完后选择框已清空；同一个文件再选一次仍会触发回调（清空没有破坏重复选择）
  it('选完后 value 已清空，同一文件可再次选中', async () => {
    const onPick = vi.fn();
    const { container } = renderInput(onPick);
    const input = inputOf(container);
    const file = createFile('hero.png', new Uint8Array([4]), 'image/png');

    installLiveFileList(input, [file]);
    fireEvent.change(input);

    await waitFor((): void => {
      expect(onPick).toHaveBeenCalledTimes(1);
    });

    expect(input.value).toBe('');

    installLiveFileList(input, [file]);
    fireEvent.change(input);

    await waitFor((): void => {
      expect(onPick).toHaveBeenCalledTimes(2);
    });
  });

  // 超过 32 MiB 仍被拒，且在读取字节前就拦下
  it('超限文件被拒且不读字节', async () => {
    const onPick = vi.fn();
    const onReject = vi.fn();
    const { container } = renderInput(onPick, onReject);
    const input = inputOf(container);
    const readBytes = vi.fn((): Promise<ArrayBuffer> => Promise.resolve(new ArrayBuffer(0)));
    const file = createFile('huge.png', new Uint8Array([1]), 'image/png');

    Object.defineProperty(file, 'size', { configurable: true, value: ASSET_MAX_UPLOAD_BYTES + 1 });
    Object.defineProperty(file, 'arrayBuffer', { configurable: true, value: readBytes });

    installLiveFileList(input, [file]);
    fireEvent.change(input);

    await waitFor((): void => {
      expect(onReject).toHaveBeenCalledWith('文件过大，单个素材不能超过 32 MiB');
    });

    expect(onPick).not.toHaveBeenCalled();
    expect(readBytes).not.toHaveBeenCalled();
  });
});
