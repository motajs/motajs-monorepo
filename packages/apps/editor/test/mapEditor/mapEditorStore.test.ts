/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { MapEditorStore } from "@/MapEditor/MapEditorStore";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(MapEditorStore.Provider, null, children);
}

describe("MapEditorStore viewport", () => {
  it("clamps movement to the current floor bounds", () => {
    const { result } = renderHook(() => MapEditorStore.useStore(), { wrapper });

    act(() => {
      result.current.setViewportBounds([416, 416]);
      result.current.moveViewport(-1, -1);
    });
    expect(result.current.state.viewportOffset).toEqual([0, 0]);

    act(() => {
      result.current.moveViewport(20, 20);
    });
    expect(result.current.state.viewportOffset).toEqual([416, 416]);

    act(() => {
      result.current.setViewportBounds([64, 96]);
    });
    expect(result.current.state.viewportOffset).toEqual([64, 96]);
  });

  it("resets ordinary floor navigation but preserves history restoration", () => {
    const { result } = renderHook(() => MapEditorStore.useStore(), { wrapper });

    act(() => {
      result.current.setCurrentFloorId("sample0");
      result.current.setViewportBounds([416, 416]);
      result.current.moveViewport(3, 4);
      result.current.setCurrentFloorId("sample1");
    });
    expect(result.current.state.viewportOffset).toEqual([0, 0]);

    act(() => {
      result.current.moveViewport(2, 2);
      result.current.setCurrentFloorId("sample0", { preserveViewport: true });
    });
    expect(result.current.state.viewportOffset).toEqual([64, 64]);
  });
});
