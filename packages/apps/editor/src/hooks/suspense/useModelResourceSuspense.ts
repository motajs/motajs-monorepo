import type { ModelResource } from "@/project/model/projectModel";
import { useSignal } from "../useFs";

export function useModelResourceSuspense<T>(resource: ModelResource<T>): T {
  const content = useSignal(resource.content);

  if (content.status === "idle") {
    void resource.reload();
  }

  if (content.status === "loading" || content.status === "idle") {
    throw resource.waitForSettled();
  }

  if (content.status === "error") {
    throw content.error;
  }

  if (content.status === "not-found") {
    throw new Error(`${resource.id} not found`);
  }

  return content.value;
}
