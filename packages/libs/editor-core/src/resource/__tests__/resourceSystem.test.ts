import { describe, expect, test } from 'vitest';
import { ResourceSystem } from '../resourceSystem';
import { IResourceIdentifier, IResourceInjection } from '../types';

class FakeResourceInjection implements IResourceInjection {
  readonly content: Map<number, Map<string, unknown>> = new Map();

  readonly list: Map<number, IResourceIdentifier[]> = new Map();

  requestResourceCount = 0;

  requestResourceListCount = 0;

  writeResourceCount = 0;

  createResourceCount = 0;

  deleteResourceCount = 0;

  // 向内存后端预置一个资源内容及其所属的资源列表
  seed(id: IResourceIdentifier, value: unknown): void {
    let byId = this.content.get(id.type);

    if (!byId) {
      byId = new Map();
      this.content.set(id.type, byId);
    }

    byId.set(id.id, value);

    const ids = this.list.get(id.type) ?? [];
    ids.push(id);
    this.list.set(id.type, ids);
  }

  async requestResource<T>(id: IResourceIdentifier): Promise<T> {
    this.requestResourceCount += 1;
    return this.content.get(id.type)?.get(id.id) as T;
  }

  async requestResourceList(type: number): Promise<readonly IResourceIdentifier[]> {
    this.requestResourceListCount += 1;
    return this.list.get(type) ?? [];
  }

  async writeResource(id: IResourceIdentifier, content: unknown): Promise<void> {
    this.writeResourceCount += 1;
    this.content.get(id.type)?.set(id.id, content);
  }

  async createResource(id: IResourceIdentifier, content: unknown): Promise<void> {
    this.createResourceCount += 1;
    this.seed(id, content);
  }

  async deleteResource(id: IResourceIdentifier): Promise<void> {
    this.deleteResourceCount += 1;
    this.content.get(id.type)?.delete(id.id);

    const ids = this.list.get(id.type);

    if (ids) {
      this.list.set(
        id.type,
        ids.filter((item) => item.id !== id.id),
      );
    }
  }
}

const TYPE = 1;
const ID: IResourceIdentifier = Object.freeze({ type: TYPE, id: 'alpha' });

describe('ResourceSystem 最小闭环', () => {
  // requestResourceList 首次请求后端一次，二次命中列表缓存不再请求后端
  test('requestResourceList 缓存列表，二次请求不再访问后端', async () => {
    const system = new ResourceSystem();
    const injection = new FakeResourceInjection();
    injection.seed(ID, 'content-alpha');
    await system.initialize(injection);

    const first = await system.requestResourceList(TYPE);
    const second = await system.requestResourceList(TYPE);

    expect(first).toEqual([ID]);
    expect(second).toBe(first);
    expect(injection.requestResourceListCount).toBe(1);
  });

  // requestResource 对列表中存在的 id 返回句柄，对不在列表中的 id 返回 null
  test('requestResource 命中列表返回句柄，未命中返回 null', async () => {
    const system = new ResourceSystem();
    const injection = new FakeResourceInjection();
    injection.seed(ID, 'content-alpha');
    await system.initialize(injection);

    const hit = await system.requestResource<string>(ID);
    const miss = await system.requestResource<string>({ type: TYPE, id: 'missing' });

    expect(hit).not.toBeNull();
    expect(hit?.identifier).toBe(ID);
    expect(miss).toBeNull();
  });

  // 句柄 request() 返回后端内容，二次调用走内容缓存，后端只被请求一次
  test('Resource.request 读取后端内容并缓存，二次调用不再访问后端', async () => {
    const system = new ResourceSystem();
    const injection = new FakeResourceInjection();
    injection.seed(ID, 'content-alpha');
    await system.initialize(injection);

    const resource = await system.requestResource<string>(ID);
    const first = await resource?.request();
    const second = await resource?.request();

    expect(first).toBe('content-alpha');
    expect(second).toBe('content-alpha');
    expect(injection.requestResourceCount).toBe(1);
  });
});

describe('ResourceSystem 写入与更新', () => {
  // write 写入后端、同步内容缓存且不触发任何钩子
  test('Resource.write 写入后端并同步缓存，不触发钩子', async () => {
    const system = new ResourceSystem();
    const injection = new FakeResourceInjection();
    injection.seed(ID, 'old');
    await system.initialize(injection);

    let updateCount = 0;
    system.addHook({
      onUpdateResource: async () => {
        updateCount += 1;
      },
    });

    const resource = await system.requestResource<string>(ID);
    await resource?.write('new');

    expect(injection.writeResourceCount).toBe(1);
    expect(injection.content.get(TYPE)?.get(ID.id)).toBe('new');
    expect(updateCount).toBe(0);

    const reread = await resource?.request();

    expect(reread).toBe('new');
    expect(injection.requestResourceCount).toBe(0);
  });

  // updateResource 作废内容缓存、仅以 id 广播 onUpdateResource，重新取值拿到后端最新内容
  test('updateResource 作废缓存并以 id 广播，重新请求拿到最新内容', async () => {
    const system = new ResourceSystem();
    const injection = new FakeResourceInjection();
    injection.seed(ID, 'v1');
    await system.initialize(injection);

    const received: IResourceIdentifier[] = [];
    system.addHook({
      onUpdateResource: async (id) => {
        received.push(id);
      },
    });

    const resource = await system.requestResource<string>(ID);
    await resource?.request();

    injection.content.get(TYPE)?.set(ID.id, 'v2');
    await system.updateResource(ID);

    expect(received).toEqual([ID]);
    expect(injection.requestResourceCount).toBe(1);

    const latest = await resource?.request();

    expect(latest).toBe('v2');
    expect(injection.requestResourceCount).toBe(2);
  });

  // updateResourceList 作废列表缓存并以 type 广播 onUpdateResourceList
  test('updateResourceList 作废列表缓存并以 type 广播', async () => {
    const system = new ResourceSystem();
    const injection = new FakeResourceInjection();
    injection.seed(ID, 'v1');
    await system.initialize(injection);

    const received: number[] = [];
    system.addHook({
      onUpdateResourceList: async (type) => {
        received.push(type);
      },
    });

    await system.requestResourceList(TYPE);
    await system.updateResourceList(TYPE);

    expect(received).toEqual([TYPE]);
    expect(injection.requestResourceListCount).toBe(1);

    await system.requestResourceList(TYPE);

    expect(injection.requestResourceListCount).toBe(2);
  });

  // createResource 调用后端创建、刷新列表广播并返回可用句柄
  test('createResource 调用后端、广播列表更新并返回句柄', async () => {
    const system = new ResourceSystem();
    const injection = new FakeResourceInjection();
    await system.initialize(injection);

    const received: number[] = [];
    system.addHook({
      onUpdateResourceList: async (type) => {
        received.push(type);
      },
    });

    const resource = await system.createResource(ID, 'created');

    expect(injection.createResourceCount).toBe(1);
    expect(received).toEqual([TYPE]);
    expect(resource).not.toBeNull();
    expect(resource?.identifier).toBe(ID);
    expect(await resource?.request()).toBe('created');
  });

  // deleteResource 调用后端删除、刷新列表广播并清空内容缓存
  test('deleteResource 调用后端并广播列表更新', async () => {
    const system = new ResourceSystem();
    const injection = new FakeResourceInjection();
    injection.seed(ID, 'v1');
    await system.initialize(injection);

    const received: number[] = [];
    system.addHook({
      onUpdateResourceList: async (type) => {
        received.push(type);
      },
    });

    await system.deleteResource(ID);

    expect(injection.deleteResourceCount).toBe(1);
    expect(received).toEqual([TYPE]);
    expect(injection.content.get(TYPE)?.has(ID.id)).toBe(false);
  });

  // dispose 清空两个缓存，之后 requestResource 重新请求后端列表
  test('dispose 清空缓存后重新请求后端', async () => {
    const system = new ResourceSystem();
    const injection = new FakeResourceInjection();
    injection.seed(ID, 'v1');
    await system.initialize(injection);

    await system.requestResource(ID);

    expect(injection.requestResourceListCount).toBe(1);

    await system.dispose();

    const resource = await system.requestResource(ID);

    expect(resource).not.toBeNull();
    expect(injection.requestResourceListCount).toBe(2);
  });
});
