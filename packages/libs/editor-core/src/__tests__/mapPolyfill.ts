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

installMapGetOrInsert();
installMapGetOrInsertComputed();
