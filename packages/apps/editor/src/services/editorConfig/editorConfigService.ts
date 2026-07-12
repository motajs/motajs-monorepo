/**
 * EditorConfigService - 编辑器配置服务
 *
 * 管理编辑器配置数据（_server/config.json），提供命令式 API
 *
 * 核心特性：
 * - 状态用 `EditorConfig | null` 表示（`null` = loading）
 * - 加载失败时切换到 in-memory 模式（只更新内存，不写文件）
 * - 提供 Suspense 友好的 API
 */

import { signal, effect } from "alien-signals";
import { FileHandlerManager } from "@/fs/FileHandlerManager";
import { waitUntil } from "@/utils/base/signal";
import type { ReadonlySignal } from "@/fs/interfaces";

/** 配置文件路径 */
const CONFIG_PATH = "_server/config.json";

/**
 * 编辑器配置类型
 */
export type EditorConfig = Record<string, unknown>;

/**
 * EditorConfigService - 编辑器配置服务实现
 */
class EditorConfigServiceImpl {
  /** 配置内容 signal（null = loading，非 null = loaded） */
  private _content = signal<EditorConfig | null>(null);

  /** 只读 signal */
  readonly content: ReadonlySignal<EditorConfig | null> = this._content;

  /** 是否处于 in-memory 模式（文件加载失败时启用） */
  private inMemoryMode = false;
  private pendingUpdates: EditorConfig = {};

  /** 文件处理器 */
  private fileHandler = FileHandlerManager.get(CONFIG_PATH);

  /**
   * 加载配置
   *
   * 加载成功时使用文件内容，失败时切换到 in-memory 模式
   */
  async load(): Promise<void> {
    await this.fileHandler.load();
    const rawContent = this.fileHandler.getContent();

    if (rawContent.status === "loaded") {
      try {
        const parsed = JSON.parse(rawContent.value) as EditorConfig;
        const merged = { ...parsed, ...this.pendingUpdates };
        this.pendingUpdates = {};
        this._content(merged);
        if (Object.keys(merged).some((key) => parsed[key] !== merged[key])) {
          this.fileHandler.update(JSON.stringify(merged));
        }
        return;
      } catch {
        console.warn("配置文件损坏，切换到 in-memory 模式");
      }
    } else {
      console.warn("配置文件不存在，切换到 in-memory 模式");
    }

    // 进入 in-memory 模式
    this.inMemoryMode = true;
    this._content({ ...this.pendingUpdates });
    this.pendingUpdates = {};
  }

  /**
   * 获取配置值
   *
   * @param key 配置键
   * @param defaultValue 默认值
   * @returns 配置值或默认值
   */
  get<T>(key: string, defaultValue: T): T {
    const config = this._content();
    if (config === null) return defaultValue;
    return (config[key] as T) ?? defaultValue;
  }

  /**
   * 设置配置值
   *
   * 文件模式：更新内存 + 写入文件
   * in-memory 模式：只更新内存
   *
   * @param key 配置键
   * @param value 配置值
   */
  set(key: string, value: unknown): void {
    const config = this._content();
    if (config === null) {
      this.pendingUpdates = { ...this.pendingUpdates, [key]: value };
      return;
    }

    const newConfig = { ...config, [key]: value };
    this._content(newConfig);

    // 只有非 in-memory 模式才写文件
    if (!this.inMemoryMode) {
      this.fileHandler.update(JSON.stringify(newConfig));
    }
  }

  /**
   * 等待配置加载完成
   *
   * 用于 Suspense：loading 时返回的 Promise 会 pending
   */
  waitForLoaded(): Promise<void> {
    return waitUntil(() => this._content() !== null);
  }

  /**
   * 获取当前配置快照
   *
   * 用于 useSyncExternalStore
   */
  getSnapshot = (): EditorConfig | null => {
    return this._content();
  };

  /**
   * 订阅配置变化
   *
   * 用于 useSyncExternalStore
   *
   * @param listener 监听器
   * @returns 取消订阅函数
   */
  subscribe = (listener: () => void): (() => void) => {
    return effect(() => {
      this._content(); // 追踪依赖
      listener();
    });
  };

  /**
   * 检查是否处于 in-memory 模式
   */
  isInMemoryMode(): boolean {
    return this.inMemoryMode;
  }
}

/** 单例导出 */
export const editorConfigService = new EditorConfigServiceImpl();
