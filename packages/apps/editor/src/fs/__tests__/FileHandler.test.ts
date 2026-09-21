/**
 * FileHandler 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FileHandler } from '../FileHandler';
import { ContentUtils } from '../ContentUtils';
import { MemoryFileSystem } from '@test/utils/MemoryFileSystem';
import { wait } from '@test/utils/testHelpers';
import { persistenceMonitor } from '../PersistenceMonitor';

describe('FileHandler', () => {
  let memoryFs: MemoryFileSystem;

  beforeEach(() => {
    persistenceMonitor.resetForTests();
    memoryFs = new MemoryFileSystem();
  });

  describe('基础功能', () => {
    it('应该创建 FileHandler 实例', () => {
      const handler = new FileHandler('test.txt', memoryFs.createFsInterface());
      expect(handler).toBeInstanceOf(FileHandler);
      expect(handler.getPath()).toBe('test.txt');
    });

    it('初始状态应该是 idle', () => {
      const handler = new FileHandler('test.txt', memoryFs.createFsInterface());
      const content = handler.getContent();
      expect(ContentUtils.isIdle(content)).toBe(true);
    });

    it('应该能够加载文件', async () => {
      memoryFs.setFile('test.txt', 'hello world');
      const handler = new FileHandler('test.txt', memoryFs.createFsInterface());

      await handler.load();

      const content = handler.getContent();
      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value).toBe('hello world');
      }
    });

    it('文件不存在时应该返回 not-found', async () => {
      const handler = new FileHandler('nonexistent.txt', memoryFs.createFsInterface());

      await handler.load();

      const content = handler.getContent();
      expect(ContentUtils.isNotFound(content)).toBe(true);
    });

    it('工程访问错误不应误报为当前文件不存在', async () => {
      const projectErrorFs = memoryFs.createFsInterface();
      projectErrorFs.promises.readFile = async () => {
        throw new Error('HTTP 404: project-not-found: Project not found [project/data.js]');
      };
      const handler = new FileHandler('project/data.js', projectErrorFs);

      await handler.load();

      const content = handler.getContent();
      expect(content.status).toBe('error');
      if (content.status === 'error') {
        expect(content.error.message).toContain('project-not-found');
      }
    });
  });

  describe('update 方法', () => {
    it('应该同步更新内存', async () => {
      memoryFs.setFile('test.txt', 'old');
      const handler = new FileHandler('test.txt', memoryFs.createFsInterface());
      await handler.load();

      handler.update('new');

      // 立即检查内存（同步）
      const content = handler.getContent();
      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value).toBe('new');
      }
    });

    it('应该异步落盘', async () => {
      memoryFs.setFile('test.txt', 'old');
      const handler = new FileHandler('test.txt', memoryFs.createFsInterface());
      await handler.load();

      handler.update('new');

      // 等待落盘
      await persistenceMonitor.whenQuiescent(['test.txt']);

      // 检查文件系统
      expect(memoryFs.getFile('test.txt')).toBe('new');
    });

    it('应该支持同步转换函数', async () => {
      memoryFs.setFile('test.txt', 'hello');
      const handler = new FileHandler('test.txt', memoryFs.createFsInterface());
      await handler.load();

      handler.update((current) => current + ' world');

      const content = handler.getContent();
      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value).toBe('hello world');
      }

      await persistenceMonitor.whenQuiescent(['test.txt']);
      expect(memoryFs.getFile('test.txt')).toBe('hello world');
    });

    it('应该支持异步转换函数', async () => {
      memoryFs.setFile('test.txt', 'hello');
      const handler = new FileHandler('test.txt', memoryFs.createFsInterface());
      await handler.load();

      await handler.update(async (current) => {
        await wait(10);
        return current + ' async';
      });

      const content = handler.getContent();
      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value).toBe('hello async');
      }

      await persistenceMonitor.whenQuiescent(['test.txt']);
      expect(memoryFs.getFile('test.txt')).toBe('hello async');
    });
  });

  describe('并发写入', () => {
    it('应该串行化写入操作', async () => {
      memoryFs.setWriteDelay(50); // 模拟慢速写入
      memoryFs.setFile('test.txt', '0');
      const handler = new FileHandler('test.txt', memoryFs.createFsInterface());
      await handler.load();

      // 并发写入
      handler.update('1');
      handler.update('2');
      handler.update('3');

      await persistenceMonitor.whenQuiescent(['test.txt']);

      // 最后一次写入应该生效
      expect(memoryFs.getFile('test.txt')).toBe('3');
    });

    it('应该优化写入队列（最多保留 2 个任务）', async () => {
      memoryFs.setWriteDelay(50);
      memoryFs.setFile('test.txt', '0');
      const handler = new FileHandler('test.txt', memoryFs.createFsInterface());
      await handler.load();

      // 快速连续写入多次
      handler.update('1');
      handler.update('2');
      handler.update('3');
      handler.update('4');
      handler.update('5');

      await persistenceMonitor.whenQuiescent(['test.txt']);

      // 应该只保留最后一次写入
      expect(memoryFs.getFile('test.txt')).toBe('5');
    });
  });

  describe('signal 自动通知', () => {
    it('应该在内容变化时通知订阅者', async () => {
      memoryFs.setFile('test.txt', 'old');
      const handler = new FileHandler('test.txt', memoryFs.createFsInterface());
      await handler.load();

      const changes: string[] = [];
      const unsubscribe = handler.subscribe((content) => {
        if (ContentUtils.isLoaded(content)) {
          changes.push(content.value);
        }
      });

      handler.update('new1');
      handler.update('new2');

      await persistenceMonitor.whenQuiescent(['test.txt']);

      // 应该收到所有更新
      expect(changes).toContain('new1');
      expect(changes).toContain('new2');

      unsubscribe();
    });

    it('应该在加载时通知订阅者', async () => {
      memoryFs.setFile('test.txt', 'content');
      const handler = new FileHandler('test.txt', memoryFs.createFsInterface());

      const statuses: string[] = [];
      const unsubscribe = handler.subscribe((content) => {
        statuses.push(content.status);
      });

      await handler.load();

      // 应该收到 idle -> loading -> loaded
      expect(statuses).toContain('idle');
      expect(statuses).toContain('loading');
      expect(statuses).toContain('loaded');

      unsubscribe();
    });
  });

  describe('refetch', () => {
    it('应该重新加载文件', async () => {
      memoryFs.setFile('test.txt', 'old');
      const handler = new FileHandler('test.txt', memoryFs.createFsInterface());
      await handler.load();

      // 修改文件系统中的文件
      memoryFs.setFile('test.txt', 'new');

      // 等待 refetch 完成
      await handler.refetch();

      const content = handler.getContent();
      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value).toBe('new');
      }
    });

    it('refetch 时应该转换到 loading 状态', async () => {
      memoryFs.setFile('test.txt', 'content');
      const handler = new FileHandler('test.txt', memoryFs.createFsInterface());
      await handler.load();

      const statuses: string[] = [];
      const unsubscribe = handler.subscribe((content) => {
        statuses.push(content.status);
      });

      await handler.refetch();

      // 应该包含 loading 状态
      expect(statuses).toContain('loading');

      unsubscribe();
    });

    it('丢弃 refetch 期间已经被内存编辑取代的磁盘结果', async () => {
      memoryFs.setFile('test.txt', 'old disk value');
      const fs = memoryFs.createFsInterface();
      const handler = new FileHandler('test.txt', fs);
      await handler.load();

      let finishRead!: (value: string) => void;
      fs.promises.readFile = () =>
        new Promise<string>((resolve) => {
          finishRead = resolve;
        });

      const refetch = handler.refetch();
      handler.update('new memory value');
      finishRead('stale disk value');
      await refetch;

      expect(handler.getContent()).toEqual({ status: 'loaded', value: 'new memory value' });
      await persistenceMonitor.flush(['test.txt']);
      expect(memoryFs.getFile('test.txt')).toBe('new memory value');
    });

    it('丢弃 refetch 期间已经被内存删除取代的磁盘结果', async () => {
      memoryFs.setFile('test.txt', 'old disk value');
      const fs = memoryFs.createFsInterface();
      const handler = new FileHandler('test.txt', fs);
      await handler.load();

      let finishRead!: (value: string) => void;
      fs.promises.readFile = () =>
        new Promise<string>((resolve) => {
          finishRead = resolve;
        });

      const refetch = handler.refetch();
      await handler.delete();
      finishRead('stale disk value');
      await refetch;

      expect(ContentUtils.isNotFound(handler.getContent())).toBe(true);
      await persistenceMonitor.flush(['test.txt']);
      expect(memoryFs.hasFile('test.txt')).toBe(false);
    });
  });

  describe('ensureLoaded', () => {
    it('只执行首次读取，已加载后不重新读取', async () => {
      memoryFs.setFile('test.txt', 'content');
      const fs = memoryFs.createFsInterface();
      const readFile = fs.promises.readFile.bind(fs.promises);
      let reads = 0;
      fs.promises.readFile = async (...args) => {
        reads += 1;
        return readFile(...args);
      };
      const handler = new FileHandler('test.txt', fs);

      await handler.ensureLoaded();
      await handler.ensureLoaded();

      expect(reads).toBe(1);
    });

    it('加载进行中时只等待同一次读取', async () => {
      const fs = memoryFs.createFsInterface();
      let finishRead!: (value: string) => void;
      let reads = 0;
      fs.promises.readFile = () => {
        reads += 1;
        return new Promise<string>((resolve) => {
          finishRead = resolve;
        });
      };
      const handler = new FileHandler('test.txt', fs);

      const first = handler.ensureLoaded();
      const second = handler.ensureLoaded();
      finishRead('content');
      await Promise.all([first, second]);

      expect(reads).toBe(1);
      expect(handler.getContent()).toEqual({ status: 'loaded', value: 'content' });
    });
  });

  describe('删除管理', () => {
    it('删除立即更新内存并在后台排到旧写入之后', async () => {
      memoryFs.setFile('test.txt', 'content');
      memoryFs.setWriteDelay(50); // 模拟慢速写入
      const handler = new FileHandler('test.txt', memoryFs.createFsInterface());
      await handler.load();

      // 触发一个写入
      handler.update('new content');

      // 删除立即返回，内存先进入 not-found。
      await handler.delete();
      expect(ContentUtils.isNotFound(handler.getContent())).toBe(true);
      expect(memoryFs.hasFile('test.txt')).toBe(true);

      await persistenceMonitor.flush(['test.txt']);
      expect(memoryFs.hasFile('test.txt')).toBe(false);
    });

    it('删除后更新会把最新写入排到删除之后', async () => {
      memoryFs.setFile('test.txt', 'content');
      memoryFs.setWriteDelay(100); // 模拟慢速写入
      const handler = new FileHandler('test.txt', memoryFs.createFsInterface());
      await handler.load();

      handler.update('new content');
      await handler.delete();
      handler.update('restored');

      expect(handler.getContent()).toEqual({ status: 'loaded', value: 'restored' });
      await persistenceMonitor.flush(['test.txt']);
      expect(memoryFs.getFile('test.txt')).toBe('restored');
    });
  });

  describe('错误处理', () => {
    it('未加载时直接设置值应该创建文件', async () => {
      const handler = new FileHandler('test.txt', memoryFs.createFsInterface());

      handler.update('new');

      const content = handler.getContent();
      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value).toBe('new');
      }

      await persistenceMonitor.whenQuiescent(['test.txt']);
      expect(memoryFs.getFile('test.txt')).toBe('new');
    });

    it('写入失败时不应该影响内存状态', async () => {
      memoryFs.setFile('test.txt', 'content');
      const handler = new FileHandler('test.txt', memoryFs.createFsInterface());
      await handler.load();

      // 创建一个会失败的 fs 接口
      const failingFs = memoryFs.createFsInterface();
      failingFs.promises.writeFile = async () => {
        throw new Error('Write failed');
      };

      // 替换 handler 的 fs（通过私有属性访问）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (handler as any).fs = failingFs;

      handler.update('new');

      // 等待写入尝试
      await persistenceMonitor.whenQuiescent(['test.txt']);

      const content = handler.getContent();
      // 注意：持久化失败不应该影响内存状态
      // 内存中的数据仍然有效
      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value).toBe('new');
      }
    });
  });
});
