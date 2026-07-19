import { describe, expect, it } from "vitest";
import { signal } from "alien-signals";
import type { Content } from "@/fs/types";
import type { TowerData } from "@/services/tower";
import { createRetainedProjectTitleSignal, readProjectTitle } from "../projectTitle";

const tower = (title: string): TowerData => ({
  firstData: { title },
  main: { floorIds: [] },
} as unknown as TowerData);

describe("readProjectTitle", () => {
  it("reads the confirmed project title", () => {
    expect(readProjectTitle({ status: "loaded", value: tower("遗迹传说") })).toBe("遗迹传说");
  });

  it("does not replace a confirmed title during a transient reload", () => {
    const content = signal<Content<TowerData>>({ status: "loaded", value: tower("遗迹传说") });
    const title = createRetainedProjectTitleSignal(content);
    expect(title()).toBe("遗迹传说");
    content({ status: "loading" });
    expect(title()).toBe("遗迹传说");
    content({ status: "loaded", value: tower("遗迹传说 II") });
    expect(title()).toBe("遗迹传说 II");
  });
});
