import { computed } from "alien-signals";
import type { Content } from "@/fs/types";
import type { ReadonlySignal } from "@/fs/interfaces";
import type { TowerData } from "@/services/tower";

export function readProjectTitle(content: Content<TowerData>): string | undefined {
  if (content.status !== "loaded") return undefined;
  const firstData = content.value.firstData as Record<string, unknown>;
  if (typeof firstData.title === "string") return firstData.title;
  if (typeof content.value.main.title === "string") return content.value.main.title;
  return "未命名工程";
}

export function createRetainedProjectTitleSignal(
  content: ReadonlySignal<Content<TowerData>>,
): ReadonlySignal<string | undefined> {
  let confirmedTitle: string | undefined;
  return computed(() => {
    const currentTitle = readProjectTitle(content());
    if (currentTitle !== undefined) confirmedTitle = currentTitle;
    return confirmedTitle;
  });
}
