/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BgmListFieldEditor } from "../BgmListFieldEditor";
import { RegistryReferenceRoot } from "../reference";
import type { FieldSchema, ValueSource } from "../types";

const selectMaterial = vi.hoisted(() => vi.fn());

vi.mock("@/Workbench/modals/SelectMaterial", () => ({
  useSelectMaterialModalAction: () => selectMaterial,
}));

afterEach(() => {
  cleanup();
  selectMaterial.mockReset();
});

const schema: FieldSchema = {
  $id: "floor.bgm",
  type: ["null", "string", "array"],
  title: "背景音乐",
  editor: {
    kind: "bgmList",
    reference: { ref: "project:materials.bgms" },
    directory: "project/bgms",
  },
};

const registry: ValueSource<unknown> = {
  id: "project:materials.bgms",
  snapshot: () => ({ status: "ready", value: { present: true, value: ["a.mp3", "b.mp3", "c.mp3"] } }),
  subscribe: () => () => undefined,
};

describe("BgmListFieldEditor", () => {
  it("ensures a loading registry without forcing a reload", async () => {
    const ensureLoaded = vi.fn(async () => undefined);
    const reload = vi.fn(async () => undefined);
    const loadingRegistry: ValueSource<unknown> = {
      id: "project:materials.bgms",
      snapshot: () => ({ status: "loading" }),
      subscribe: () => () => undefined,
      ensureLoaded,
      reload,
    };
    render(
      <BgmListFieldEditor
        schema={schema}
        value={[]}
        disabled={false}
        scope={{ roots: { project: new RegistryReferenceRoot(new Map([["materials.bgms", loadingRegistry]])) } }}
        onCommit={vi.fn(async () => undefined)}
      />,
    );

    await waitFor(() => expect(ensureLoaded).toHaveBeenCalledTimes(1));
    expect(reload).not.toHaveBeenCalled();
  });

  it("replaces by clicking the item and adds multiple selected files", async () => {
    const commit = vi.fn(async () => undefined);
    selectMaterial.mockResolvedValueOnce(["b.mp3"]).mockResolvedValueOnce(["b.mp3", "c.mp3"]);
    render(
      <BgmListFieldEditor
        schema={schema}
        value={["a.mp3"]}
        disabled={false}
        scope={{ roots: { project: new RegistryReferenceRoot(new Map([["materials.bgms", registry]])) } }}
        onCommit={commit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "替换背景音乐 a.mp3" }));
    await waitFor(() => expect(commit).toHaveBeenCalledWith(["b.mp3"]));
    expect(selectMaterial.mock.calls[0][0]).toMatchObject({ multiple: false, value: "a.mp3" });

    fireEvent.click(screen.getByRole("button", { name: "添加音乐" }));
    await waitFor(() => expect(commit).toHaveBeenCalledWith(["a.mp3", "b.mp3", "c.mp3"]));
    expect(selectMaterial.mock.calls[1][0]).toMatchObject({ multiple: true });
  });
});
