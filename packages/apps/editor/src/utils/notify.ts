import type { CommandResult } from "@/project/commands";

export type NotificationLevel = "success" | "error" | "info";

export interface EditorNotification {
  level: NotificationLevel;
  message: string;
}

const listeners = new Set<(notification: EditorNotification) => void>();

export function subscribeNotifications(listener: (notification: EditorNotification) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(notification: EditorNotification): void {
  if (listeners.size > 0) listeners.forEach((listener) => listener(notification));
  else if (notification.level === "error") console.error(notification.message);
  else console.info(notification.message);
}

export function notifySuccess(message: string): void {
  emit({ level: "success", message });
}

export function notifyError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  emit({ level: "error", message });
}

export function notifyInfo(message: string): void {
  emit({ level: "info", message });
}

export function notifyCommandResult(result: CommandResult, successMessage: string): boolean {
  if (result.ok) {
    notifySuccess(successMessage);
    return true;
  }
  notifyError(`${result.stage}: ${result.error.message}`);
  return false;
}
