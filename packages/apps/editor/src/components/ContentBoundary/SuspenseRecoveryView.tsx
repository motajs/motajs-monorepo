import { useEffect, type FC, type ReactNode } from "react";
import type { IContentHandler, RecoverableResource } from "@/fs/interfaces";
import { DataHandler } from "@/fs/DataHandler";
import { useSignal } from "@/hooks/useFs";
import {
  LoadingRecovery,
  NotFoundRecovery,
  ParseErrorRecovery,
  IOErrorRecovery,
} from "./RecoveryUI";
import { FileHandler } from "@/fs/FileHandler";

export type SuspenseHandler = DataHandler<unknown> | FileHandler | RecoverableResource<unknown>;

export interface SuspenseRecoveryViewProps {
  handler: SuspenseHandler;
  onClear: () => void;
  recoveryUI?: (handler: IContentHandler<unknown>) => ReactNode | null;
  loadingUI?: ReactNode;
}

/**
 * 恢复视图
 *
 * 负责：
 * - 监听 handler 状态变化
 * - 状态变为 loaded 时 onClear
 * - 渲染对应的恢复 UI（error/not-found/loading）
 *
 * 注意：初次 loading 由 Suspense 处理，这里的 loading 分支
 * 用于用户点击 retry 后的等待状态
 */
export const SuspenseRecoveryView: FC<SuspenseRecoveryViewProps> = ({
  handler,
  onClear,
  recoveryUI,
  loadingUI,
}) => {
  const content = useSignal(handler.content);
  const path = handler.getPath();

  // 触发加载 & 监听完成
  useEffect(() => {
    if (content.status === "idle") {
      void handler.refetch();
    }
  }, [handler, content.status]);

  // 监听 loaded 后 onClear
  useEffect(() => {
    if (content.status === "loaded") {
      onClear();
    }
  }, [onClear, content.status]);

  // 先尝试自定义 recoveryUI
  if (recoveryUI) {
    const customUI = recoveryUI(handler);
    if (customUI !== null) {
      return <>{customUI}</>;
    }
  }

  // 使用默认 UI
  switch (content.status) {
    case "loading":
    case "idle":
      return <>{loadingUI || <LoadingRecovery />}</>;

    case "not-found":
      return (
        <NotFoundRecovery path={path} onRetry={() => handler.refetch()} />
      );

    case "error": {
      // 区分 parse-error 和 io-error：有 rawContent 说明文件读取成功但解析失败
      const raw = "raw" in handler && typeof handler.raw === "function"
        ? handler.raw()
        : handler instanceof DataHandler
          ? handler.getFileHandler()
          : undefined;
      const rawContent = (() => {
        const fileContent = raw?.getContent();
        return fileContent?.status === "loaded" ? fileContent.value : undefined;
      })();
      if (rawContent !== undefined) {
        return (
          <ParseErrorRecovery
            error={content.error}
            onRetry={() => handler.refetch()}
          />
        );
      }
      return (
        <IOErrorRecovery
          error={content.error}
          onRetry={() => handler.refetch()}
        />
      );
    }

    default:
      return <>{loadingUI || <LoadingRecovery />}</>;
  }
};
