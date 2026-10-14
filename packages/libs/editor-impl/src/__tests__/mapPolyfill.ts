/** Map 缺失键的惰性取值回调 */
type MapComputedCallback = (key: unknown) => unknown;

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

function installResizeObserver(): void {
  if (typeof globalThis.ResizeObserver !== 'undefined') return;

  globalThis.ResizeObserver = ResizeObserverStub;
}

function installWindowInnerWidth(): void {
  // jsdom 缺省 innerWidth 为 1024，会让表格面板缺省铺出多栏、打破以单栏为前提的既有用例；
  // 归零后 resolveColumnCount 保底 1 栏，等价于改造前未桩 clientWidth 时的单栏缺省。
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 0 });
}

installMapGetOrInsert();
installMapGetOrInsertComputed();
installResizeObserver();
installWindowInnerWidth();
