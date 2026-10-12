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

installMapGetOrInsert();
installMapGetOrInsertComputed();
