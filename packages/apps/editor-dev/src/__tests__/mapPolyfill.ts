/** Map 缺失键的惰性取值回调 */
type MapComputedCallback = (key: unknown) => unknown;

/**
 * 在缺失时为 Map.prototype 安装 getOrInsert 垫片（Node 尚无该提案方法，浏览器已原生提供）
 */
function installMapGetOrInsert(): void {
  if ('getOrInsert' in Map.prototype) return;

  Object.defineProperty(Map.prototype, 'getOrInsert', {
    configurable: true,
    writable: true,
    value(this: Map<unknown, unknown>, key: unknown, defaultValue: unknown): unknown {
      if (this.has(key)) return this.get(key);

      this.set(key, defaultValue);
      return defaultValue;
    },
  });
}

/**
 * 在缺失时为 Map.prototype 安装 getOrInsertComputed 垫片（ResourceSystem 读缓存内容会用到）
 */
function installMapGetOrInsertComputed(): void {
  if ('getOrInsertComputed' in Map.prototype) return;

  Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
    configurable: true,
    writable: true,
    value(this: Map<unknown, unknown>, key: unknown, callback: MapComputedCallback): unknown {
      if (this.has(key)) return this.get(key);

      const value = callback(key);
      this.set(key, value);
      return value;
    },
  });
}

/** jsdom 未实现的 ResizeObserver 空桩：仅提供接口，不做任何观察 */
class ResizeObserverStub {
  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}
}

/**
 * 在缺失时为全局安装 ResizeObserver 空桩（antd 的多个控件依赖它，jsdom 无原生实现）
 */
function installResizeObserver(): void {
  if (typeof globalThis.ResizeObserver !== 'undefined') return;

  globalThis.ResizeObserver = ResizeObserverStub;
}

/**
 * 把 jsdom 缺省的 innerWidth 归零，令表格面板在测试里按单栏呈现（多栏由 02-20 引入）
 */
function installWindowInnerWidth(): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 0 });
}

installMapGetOrInsert();
installMapGetOrInsertComputed();
installResizeObserver();
installWindowInnerWidth();
