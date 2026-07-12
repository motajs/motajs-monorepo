/**
 * Tower 业务 Hooks
 *
 * 提供全塔属性相关的所有 React Hooks
 *
 * 设计理念：
 * - 无业务逻辑，只是对 towerService 的包装
 * - 内部调用 towerService.getHandler()
 * - 使用 useSignal 订阅 DataHandler 的 signal
 */

import { towerService, type TowerData } from "@/services/tower";
import type { Content } from "@/fs";
import { useData } from "./useData";
import type { UpdateFn } from "./useFs";

/**
 * 订阅全塔数据（可写）
 *
 * 返回 [Content<TowerData>, update] 元组
 * - Content<TowerData>: 全塔数据的所有可能状态
 * - update: 更新函数，支持三种模式：
 *   1. 直接设置：update(newData)
 *   2. 同步转换：update(current => ({ ...current, main: { ...current.main, title: 'New' } }))
 *   3. 异步转换：await update(async current => await process(current))
 *
 * @example
 * // 基础用法
 * function TowerEditor() {
 *   const [content, update] = useTowerData();
 *
 *   const handleTitleChange = (newTitle: string) => {
 *     update(data => ({
 *       ...data,
 *       main: { ...data.main, title: newTitle }
 *     }));
 *   };
 *
 *   return match(content)
 *     .with({ status: 'loaded' }, (c) => (
 *       <Input value={c.value.main.title} onChange={handleTitleChange} />
 *     ))
 *     .otherwise(() => <Loading />);
 * }
 *
 * @example
 * // 异步更新
 * function TowerDataProcessor() {
 *   const [content, update] = useTowerData();
 *
 *   const handleProcess = async () => {
 *     await update(async data => ({
 *       ...data,
 *       values: await processValues(data.values)
 *     }));
 *   };
 *
 *   return match(content)
 *     .with({ status: 'loaded' }, (c) => (
 *       <Button onClick={handleProcess}>Process Data</Button>
 *     ))
 *     .otherwise(() => <Loading />);
 * }
 *
 * @example
 * // 使用类型守卫
 * function FloorIdsList() {
 *   const [content] = useTowerData();
 *
 *   if (ContentUtils.isLoading(content)) {
 *     return <Loading />;
 *   }
 *
 *   if (ContentUtils.isLoaded(content)) {
 *     return (
 *       <ul>
 *         {content.value.main.floorIds.map(id => <li key={id}>{id}</li>)}
 *       </ul>
 *     );
 *   }
 *
 *   return <Error />;
 * }
 */
export function useTowerData(): [
  Content<TowerData>,
  UpdateFn<TowerData>
] {
  const handler = towerService.getHandler();
  return useData(handler);
}
