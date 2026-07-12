import { QueryClient } from '@tanstack/react-query';

/**
 * 共享的 QueryClient 实例
 * 用于 React Query 数据管理
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 禁用自动重新获取，由用户手动触发刷新
      refetchOnWindowFocus: false,
      // 数据不会自动过期
      staleTime: Infinity,
      experimental_prefetchInRender: true,
    },
  },
});
