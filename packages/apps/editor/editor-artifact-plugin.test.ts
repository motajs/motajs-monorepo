import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  calculateEditorBuildId,
  createEditorArtifactFiles,
  editorArtifactPlugin,
} from "./editor-artifact-plugin";

const roots: string[] = [];

async function artifact(files: Array<[string, string]>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "editor-build-id-"));
  roots.push(root);
  for (const [name, content] of files) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), content);
  }
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("editor artifact build id", () => {
  it("separates development assets from production artifact generation", () => {
    const plugins = editorArtifactPlugin("test");
    expect(plugins.map(({ name, apply }) => [name, apply])).toEqual([
      ["mota-editor-dev-assets", "serve"],
      ["mota-editor-artifact", "build"],
    ]);
  });

  it("is stable across creation order and ignores the manifest itself", async () => {
    const first = await artifact([["index.html", "editor"], ["assets/app.js", "code"]]);
    const second = await artifact([["assets/app.js", "code"], ["index.html", "editor"], [
      "editor-manifest.json",
      "old",
    ]]);
    expect(await calculateEditorBuildId(first)).toBe(await calculateEditorBuildId(second));
  });

  it("changes when artifact content changes", async () => {
    const first = await artifact([["index.html", "one"]]);
    const second = await artifact([["index.html", "two"]]);
    expect(await calculateEditorBuildId(first)).not.toBe(await calculateEditorBuildId(second));
  });

  it("describes every artifact file with deterministic size and content hash", async () => {
    const root = await artifact([
      ["index.html", "editor"],
      ["assets/app.js", "code"],
      ["editor-manifest.json", "old"],
    ]);
    expect(await createEditorArtifactFiles(root)).toEqual([
      {
        path: "assets/app.js",
        size: 4,
        sha256: "5694d08a2e53ffcae0c3103e5ad6f6076abd960eb1f8a56577040bc1028f702b",
      },
      {
        path: "index.html",
        size: 6,
        sha256: "1553cc62ff246044c683a61e203e65541990e7fcd4af9443d22b9557ecc9ac54",
      },
    ]);
  });
});
