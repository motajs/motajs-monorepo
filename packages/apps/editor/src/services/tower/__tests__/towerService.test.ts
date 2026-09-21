/**
 * towerService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { towerService, type TowerData } from '../towerService';
import { FileHandlerManager } from '@/fs/FileHandlerManager';
import { FileHandler } from '@/fs/FileHandler';
import { MemoryFileSystem } from '@test/utils/MemoryFileSystem';
import { serializeToJsDataFile } from '@/utils/serialize';
import { ContentUtils } from '@/fs/ContentUtils';
import type { Action } from '@/utils/action';

describe('towerService', () => {
  let memoryFs: MemoryFileSystem;

  beforeEach(() => {
    // 创建内存文件系统
    memoryFs = new MemoryFileSystem();

    // 清空 FileHandlerManager
    FileHandlerManager.clear();

    // 清空 towerService 的 dataHandler 缓存
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 需重置 towerService 私有的 dataHandler 单例缓存；towerService 未暴露测试清理接口，新增生产方法仅为测试不划算
    (towerService as any).dataHandler = null;
  });

  afterEach(() => {
    FileHandlerManager.clear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 需重置 towerService 私有的 dataHandler 单例缓存；towerService 未暴露测试清理接口，新增生产方法仅为测试不划算
    (towerService as any).dataHandler = null;
  });

  /**
   * 辅助函数：创建并加载全塔数据文件
   */
  async function setupTowerData(data: Partial<TowerData> = {}): Promise<void> {
    const towerData: TowerData = {
      main: {
        floorIds: data.main?.floorIds ?? ['MT1', 'MT2', 'MT3'],
        title: data.main?.title ?? '测试塔',
        ...data.main,
      },
      firstData: {
        floorId: data.firstData?.floorId ?? 'MT1',
        ...data.firstData,
      },
      values: data.values ?? {},
      flags: data.flags ?? {},
      ...data,
    };

    const content = serializeToJsDataFile('data_a1e2fb4a_e986_4524_b0da_9b7ba7c0874d', towerData);
    const path = 'project/data.js';

    // 设置文件内容（直接存储原始内容，不需要 base64 编码）
    memoryFs.setFile(path, content);

    // 创建 FileHandler 并加载
    const handler = new FileHandler(path, memoryFs.createFsInterface());
    await handler.load();

    // 注入到 FileHandlerManager（通过反射）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 需把绑定内存文件系统的 handler 注入私有 handlers 映射；FileHandlerManager 只有 clear() 没有注入接口，新增生产方法仅为测试不划算
    (FileHandlerManager as any).handlers.set(path, handler);
  }

  describe('getTowerData', () => {
    it('应该加载并解析全塔数据', async () => {
      await setupTowerData({
        main: {
          floorIds: ['MT1', 'MT2'],
          title: '主塔',
        },
      });

      const result = towerService.getTowerData();

      expect(result.main.floorIds).toEqual(['MT1', 'MT2']);
      expect(result.main.title).toBe('主塔');
    });

    it('未加载时应该抛出错误', () => {
      expect(() => towerService.getTowerData()).toThrow();
    });

    it('应该正确解析所有全塔属性', async () => {
      await setupTowerData({
        main: {
          floorIds: ['MT1', 'MT2', 'MT3'],
          title: '测试塔',
        },
        firstData: {
          floorId: 'MT2',
        },
        values: { hp: 1000, atk: 100 },
        flags: { flag1: true },
      });

      const result = towerService.getTowerData();

      expect(result.main.floorIds).toEqual(['MT1', 'MT2', 'MT3']);
      expect(result.main.title).toBe('测试塔');
      expect(result.firstData.floorId).toBe('MT2');
      expect(result.values).toEqual({ hp: 1000, atk: 100 });
      expect(result.flags).toEqual({ flag1: true });
    });
  });

  describe('getTowerDataContent', () => {
    it('未加载时应该返回 idle 状态', () => {
      const content = towerService.getTowerDataContent();
      expect(content.status).toBe('idle');
    });

    it('已加载时应该返回 loaded 状态', async () => {
      await setupTowerData();

      const content = towerService.getTowerDataContent();

      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value.main.floorIds).toEqual(['MT1', 'MT2', 'MT3']);
      }
    });
  });

  describe('getHandler', () => {
    it('应该返回 DataHandler', async () => {
      await setupTowerData();

      const handler = towerService.getHandler();

      expect(handler).toBeDefined();
      expect(handler.getContent).toBeDefined();
      expect(handler.content).toBeDefined();
    });

    it('应该能够通过 handler 访问 signal', async () => {
      await setupTowerData({
        main: { floorIds: ['MT1'], title: '测试标题' },
      });

      const handler = towerService.getHandler();
      const content = handler.content();

      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value.main.title).toBe('测试标题');
      }
    });
  });

  describe('saveTowerData', () => {
    it('应该应用 change action 并更新内存', async () => {
      await setupTowerData({
        main: { floorIds: ['MT1'], title: '旧标题' },
      });

      const actions: Action[] = [['change', "['main']['title']", '新标题']];

      towerService.saveTowerData(actions);

      const result = towerService.getTowerData();
      expect(result.main.title).toBe('新标题');
    });

    it('应该应用多个 actions', async () => {
      await setupTowerData({
        main: { floorIds: ['MT1'], title: '旧标题' },
        values: { hp: 1000 },
      });

      const actions: Action[] = [
        ['change', "['main']['title']", '新标题'],
        ['change', "['values']['hp']", 2000],
        ['change', "['values']['atk']", 100],
      ];

      towerService.saveTowerData(actions);

      const result = towerService.getTowerData();
      expect(result.main.title).toBe('新标题');
      expect(result.values?.hp).toBe(2000);
      expect(result.values?.atk).toBe(100);
    });

    it('应该验证 firstData.floorId 是否在 main.floorIds 中', async () => {
      await setupTowerData({
        main: { floorIds: ['MT1', 'MT2', 'MT3'] },
        firstData: { floorId: 'MT2' },
      });

      // 修改 floorIds，移除 MT2
      const actions: Action[] = [['change', "['main']['floorIds']", ['MT1', 'MT3']]];

      towerService.saveTowerData(actions);

      const result = towerService.getTowerData();
      // firstData.floorId 应该被自动更新为第一个楼层
      expect(result.firstData.floorId).toBe('MT1');
    });

    it('firstData.floorId 在列表中时不应该被修改', async () => {
      await setupTowerData({
        main: { floorIds: ['MT1', 'MT2', 'MT3'] },
        firstData: { floorId: 'MT2' },
      });

      // 修改其他属性
      const actions: Action[] = [['change', "['main']['title']", '新标题']];

      towerService.saveTowerData(actions);

      const result = towerService.getTowerData();
      // firstData.floorId 应该保持不变
      expect(result.firstData.floorId).toBe('MT2');
    });

    it('空 actions 数组不应该触发更新', async () => {
      await setupTowerData({
        main: { floorIds: ['MT1'], title: '原标题' },
      });

      towerService.saveTowerData([]);

      const result = towerService.getTowerData();
      expect(result.main.title).toBe('原标题');
    });

    it('未加载时应该抛出错误', () => {
      const actions: Action[] = [['change', "['main']['title']", '新标题']];

      expect(() => towerService.saveTowerData(actions)).toThrow();
    });
  });

  describe('previewChanges', () => {
    it('应该预览变更而不实际保存', async () => {
      await setupTowerData({
        main: { floorIds: ['MT1'], title: '旧标题' },
      });

      const actions: Action[] = [['change', "['main']['title']", '新标题']];

      const preview = towerService.previewChanges(actions);

      expect(preview.main.title).toBe('新标题');

      // 验证原数据未改变
      const original = towerService.getTowerData();
      expect(original.main.title).toBe('旧标题');
    });

    it('应该预览多个变更', async () => {
      await setupTowerData({
        main: { floorIds: ['MT1'], title: '旧标题' },
        values: { hp: 1000 },
      });

      const actions: Action[] = [
        ['change', "['main']['title']", '新标题'],
        ['change', "['values']['hp']", 2000],
      ];

      const preview = towerService.previewChanges(actions);

      expect(preview.main.title).toBe('新标题');
      expect(preview.values?.hp).toBe(2000);

      // 验证原数据未改变
      const original = towerService.getTowerData();
      expect(original.main.title).toBe('旧标题');
      expect(original.values?.hp).toBe(1000);
    });
  });

  describe('refetch', () => {
    it('应该重新加载全塔数据', async () => {
      await setupTowerData({
        main: { floorIds: ['MT1'], title: '旧标题' },
      });

      // 修改文件内容
      const newData: TowerData = {
        ...towerService.getTowerData(),
        main: {
          ...towerService.getTowerData().main,
          title: '新标题',
        },
      };
      const content = serializeToJsDataFile('data_a1e2fb4a_e986_4524_b0da_9b7ba7c0874d', newData);
      memoryFs.setFile('project/data.js', content);

      await towerService.refetch();

      const result = towerService.getTowerData();
      expect(result.main.title).toBe('新标题');
    });
  });

  describe('addFloorId', () => {
    it('应该添加楼层 ID 到列表', async () => {
      await setupTowerData({
        main: { floorIds: ['MT1', 'MT2'] },
      });

      towerService.addFloorId('MT3');

      const result = towerService.getTowerData();
      expect(result.main.floorIds).toEqual(['MT1', 'MT2', 'MT3']);
    });

    it('已存在的楼层 ID 不应该重复添加', async () => {
      await setupTowerData({
        main: { floorIds: ['MT1', 'MT2'] },
      });

      towerService.addFloorId('MT1');

      const result = towerService.getTowerData();
      expect(result.main.floorIds).toEqual(['MT1', 'MT2']);
    });
  });

  describe('removeFloorId', () => {
    it('应该从列表中移除楼层 ID', async () => {
      await setupTowerData({
        main: { floorIds: ['MT1', 'MT2', 'MT3'] },
        firstData: { floorId: 'MT1' },
      });

      towerService.removeFloorId('MT2');

      const result = towerService.getTowerData();
      expect(result.main.floorIds).toEqual(['MT1', 'MT3']);
    });

    it('移除 firstData.floorId 时应该更新为第一个楼层', async () => {
      await setupTowerData({
        main: { floorIds: ['MT1', 'MT2', 'MT3'] },
        firstData: { floorId: 'MT1' },
      });

      towerService.removeFloorId('MT1');

      const result = towerService.getTowerData();
      expect(result.main.floorIds).toEqual(['MT2', 'MT3']);
      expect(result.firstData.floorId).toBe('MT2');
    });

    it('移除不存在的楼层 ID 不应该抛出错误', async () => {
      await setupTowerData({
        main: { floorIds: ['MT1', 'MT2'] },
      });

      towerService.removeFloorId('MT999');

      const result = towerService.getTowerData();
      expect(result.main.floorIds).toEqual(['MT1', 'MT2']);
    });
  });

  describe('getFloorIds', () => {
    it('应该返回所有楼层 ID', async () => {
      await setupTowerData({
        main: { floorIds: ['MT1', 'MT2', 'MT3'] },
      });

      const floorIds = towerService.getFloorIds();
      expect(floorIds).toEqual(['MT1', 'MT2', 'MT3']);
    });
  });

  describe('hasFloorId', () => {
    it('存在的楼层 ID 应该返回 true', async () => {
      await setupTowerData({
        main: { floorIds: ['MT1', 'MT2', 'MT3'] },
      });

      expect(towerService.hasFloorId('MT1')).toBe(true);
      expect(towerService.hasFloorId('MT2')).toBe(true);
    });

    it('不存在的楼层 ID 应该返回 false', async () => {
      await setupTowerData({
        main: { floorIds: ['MT1', 'MT2'] },
      });

      expect(towerService.hasFloorId('MT999')).toBe(false);
    });
  });
});
