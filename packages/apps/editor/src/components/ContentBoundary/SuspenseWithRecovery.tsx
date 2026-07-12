/**
 * SuspenseWithRecovery - 带恢复能力的 Suspense 边界
 *
 * 捕获两种类型的 throw：
 * - Promise → 由内部 Suspense 处理（显示 loadingUI）
 * - handler → 由 Error boundary 处理（显示 RecoveryUI）
 */

import { Component, Suspense, type ReactNode } from "react";
import type { IContentHandler, RecoverableResource } from "@/fs/interfaces";
import { DataHandler } from "@/fs/DataHandler";
import { FileHandler } from "@/fs/FileHandler";
import {
  SuspenseRecoveryView,
  type SuspenseHandler,
} from "./SuspenseRecoveryView";
import { LoadingRecovery } from "./RecoveryUI";

export interface SuspenseWithRecoveryProps {
  children: ReactNode;

  /**
   * 自定义恢复 UI（核心 API）
   *
   * 组件层通过这个 prop 定义业务相关的恢复操作
   * 返回 null 表示使用默认 UI
   */
  recoveryUI?: (handler: IContentHandler<unknown>) => ReactNode | null;

  /** 可选：简化的 loading UI */
  loadingUI?: ReactNode;
}

interface State {
  handler: SuspenseHandler | null;
}

function isRecoverableResource(value: unknown): value is RecoverableResource {
  return Boolean(
    value
      && typeof value === "object"
      && "content" in value
      && "refetch" in value
      && "waitForSettled" in value
      && "recoverable" in value,
  );
}

/**
 * SuspenseWithRecovery 组件
 *
 * 使用 class component 因为需要 getDerivedStateFromError
 */
export class SuspenseWithRecovery extends Component<
  SuspenseWithRecoveryProps,
  State
> {
  state: State = {
    handler: null,
  };

  static getDerivedStateFromError(thrown: unknown): Partial<State> | null {
    if (thrown instanceof DataHandler || thrown instanceof FileHandler || isRecoverableResource(thrown)) {
      return { handler: thrown };
    }
    throw thrown;
  }

  render() {
    const { children, loadingUI, recoveryUI } = this.props;
    const { handler } = this.state;

    if (handler) {
      return (
        <SuspenseRecoveryView
          handler={handler}
          onClear={() => this.setState({ handler: null })}
          recoveryUI={recoveryUI}
          loadingUI={loadingUI}
        />
      );
    }

    // 包 Suspense 处理 Promise（loading 状态）
    return (
      <Suspense fallback={loadingUI || <LoadingRecovery />}>
        {children}
      </Suspense>
    );
  }
}
