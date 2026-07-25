// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useServiceWorker } from "./serviceWorker";

const originalServiceWorker = Object.getOwnPropertyDescriptor(
  navigator,
  "serviceWorker",
);

afterEach(() => {
  if (originalServiceWorker) {
    Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
  } else {
    Reflect.deleteProperty(navigator, "serviceWorker");
  }
});

describe("useServiceWorker", () => {
  test("registers after the render phase", () => {
    const registration = {} as ServiceWorkerRegistration;
    const container = new EventTarget() as EventTarget & {
      controller: ServiceWorker | null;
      ready: Promise<ServiceWorkerRegistration>;
      register: ReturnType<typeof vi.fn>;
    };
    container.controller = null;
    container.ready = new Promise(() => {});
    container.register = vi.fn().mockResolvedValue(registration);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: container,
    });

    let registeredDuringRender = false;
    renderHook(() => {
      const state = useServiceWorker("/service-worker.js", {
        scope: "/server/",
        type: "module",
      });
      registeredDuringRender ||= container.register.mock.calls.length > 0;
      return state;
    });

    expect(registeredDuringRender).toBe(false);
    expect(container.register).toHaveBeenCalledOnce();
    expect(container.register).toHaveBeenCalledWith("/service-worker.js", {
      scope: "/server/",
      type: "module",
    });
  });
});
