import { useEffect, useRef } from "react";
import type { RuntimeSurfaceLease } from "./RuntimeContext";

export function RuntimeSurface({ lease, testId }: { lease: RuntimeSurfaceLease; testId: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const attachmentRef = useRef<object | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const attachment = {};
    attachmentRef.current = attachment;
    lease.attach(container);
    return () => {
      queueMicrotask(() => {
        // React StrictMode immediately mounts the same effect again after its
        // development-only cleanup. Only close a lease that stayed detached.
        if (attachmentRef.current !== attachment) return;
        attachmentRef.current = null;
        lease.close();
      });
    };
  }, [lease]);

  return <div
    ref={containerRef}
    data-test-id={testId}
    style={{ width: lease.width, height: lease.height, maxWidth: "100%", overflow: "hidden" }}
  />;
}
