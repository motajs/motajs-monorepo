/**
 * Suspense 版本的 useCommonEventData
 *
 * 在数据未就绪时 throw handler
 * 业务组件只需要处理数据已加载的情况
 */

import { useCallback } from "react";
import { commonEventService, type CommonEventData } from "@/services/commonEvent";
import { useDataSuspense } from "./useDataSuspense";

/**
 * 完整的 events.js 数据结构（内部类型）
 */
interface EventsData {
  commonEvent: CommonEventData;
  [key: string]: unknown;
}

/**
 * CommonEvent 的 update 函数类型（只支持同步）
 */
type CommonEventUpdateFn = {
  (value: CommonEventData): void;
  (transform: (current: CommonEventData) => CommonEventData): void;
};

/**
 * Suspense 版本的公共事件数据 Hook
 *
 * 在数据未就绪时 throw handler，由 ContentBoundary 捕获处理
 * 业务组件只需要写"数据已就绪"的逻辑
 *
 * @returns [CommonEventData, UpdateFn] - 数据和更新函数
 * @throws IDataHandler - 当数据未就绪时抛出
 */
export function useCommonEventDataSuspense(): [
  CommonEventData,
  CommonEventUpdateFn,
] {
  const handler = commonEventService.getHandler();
  const [eventsData, updateEvents] = useDataSuspense(handler);

  // 只返回 commonEvent 字段
  const commonEventData = eventsData.commonEvent;

  // 包装 update 函数，只操作 commonEvent 字段
  const update = useCallback(
    (
      valueOrTransform:
        | CommonEventData
        | ((current: CommonEventData) => CommonEventData),
    ): void => {
      if (typeof valueOrTransform !== "function") {
        // 直接值模式
        updateEvents((current: EventsData) => ({
          ...current,
          commonEvent: valueOrTransform,
        }));
        return;
      }

      // 同步转换模式
      updateEvents((current: EventsData) => ({
        ...current,
        commonEvent: valueOrTransform(current.commonEvent),
      }));
    },
    [updateEvents],
  ) as CommonEventUpdateFn;

  return [commonEventData, update];
}
