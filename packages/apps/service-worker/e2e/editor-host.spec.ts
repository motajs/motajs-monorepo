import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const projectFixtureRoot = process.env.MOTA_JS_ROOT
  ?? path.resolve(import.meta.dirname, "../../../external/mota-js");

interface FixtureFile {
  path: string;
  base64: string;
}

const editorStaticRoot = path.resolve(import.meta.dirname, "../dist/static/editor");

async function writeTestEditorRelease(label: string): Promise<string> {
  const files = new Map<string, Buffer>([
    ["index.html", Buffer.from(`<!doctype html><html><head></head><body><div data-test-id="editor-release-marker">${label}</div><script id="mota-editor-environment" type="application/json">{"protocolVersion":1,"endpoints":{}}</script></body></html>`)],
    ["runtime.html", Buffer.from("<!doctype html><html><body>runtime</body></html>")],
    ["assets/version.js", Buffer.from(`globalThis.editorRelease=${JSON.stringify(label)}`)],
  ]);
  const buildHash = createHash("sha256");
  for (const [name, content] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    buildHash.update(name).update("\0").update(content).update("\0");
  }
  const buildId = buildHash.digest("hex");
  const root = path.join(editorStaticRoot, "releases", buildId);
  await fs.mkdir(root, { recursive: true });
  for (const [name, content] of files) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), content);
  }
  await fs.writeFile(path.join(root, "editor-manifest.json"), JSON.stringify({
    schemaVersion: 2,
    environmentProtocolVersion: 1,
    runtimeProtocolVersion: 99,
    editorVersion: label,
    buildId,
    entrypoints: { editor: "index.html", runtime: "runtime.html" },
    files: [...files].map(([filePath, content]) => ({
      path: filePath,
      size: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
    })),
  }));
  return buildId;
}

async function pointEditorChannel(buildId: string): Promise<void> {
  const temporary = path.join(editorStaticRoot, `.current.e2e-${process.pid}`);
  await fs.writeFile(temporary, JSON.stringify({ schemaVersion: 1, buildId }));
  await fs.rename(temporary, path.join(editorStaticRoot, "current.json"));
}

async function collectFiles(root: string, relative = ""): Promise<FixtureFile[]> {
  const entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry): Promise<FixtureFile[]> => {
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory() && [".git", ".metaphysics"].includes(entry.name)) return [];
    if (entry.isDirectory()) return collectFiles(root, name);
    return [{ path: name, base64: (await fs.readFile(path.join(root, name))).toString("base64") }];
  }));
  return files.flat();
}

async function registerEditorProject(page: Page, files: FixtureFile[]): Promise<number> {
  return page.evaluate(async (fixture) => {
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
    }
    const controller = navigator.serviceWorker.controller ?? registration.active;
    if (!controller) throw new Error("Service Worker did not activate");
    const root = await navigator.storage.getDirectory();
    const project = await root.getDirectoryHandle(`mota-editor-${Date.now()}`, { create: true });
    for (const input of fixture) {
      const parts = input.path.split("/");
      const fileName = parts.pop()!;
      let directory = project;
      for (const part of parts) directory = await directory.getDirectoryHandle(part, { create: true });
      const handle = await directory.getFileHandle(fileName, { create: true });
      const binary = atob(input.base64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const stream = await handle.createWritable();
      await stream.write(bytes);
      await stream.close();
    }
    const requestId = Date.now();
    const response = new Promise<number>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("register timeout")), 10_000);
      navigator.serviceWorker.addEventListener("message", function listener(event) {
        const [id, type, payload] = event.data ?? [];
        if (id !== requestId || type !== "project.register") return;
        navigator.serviceWorker.removeEventListener("message", listener);
        window.clearTimeout(timer);
        if (payload instanceof Error) reject(payload);
        else resolve(payload.id);
      });
    });
    controller.postMessage([requestId, "project.register", { handle: project }]);
    return response;
  }, files);
}

test("hosts the blind editor artifact against a real OPFS mota-js project", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  const projectPreviewReads: string[] = [];
  const enginePreviewReads: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/\/preview\/project\//.test(pathname)) projectPreviewReads.push(request.url());
    if (/\/preview\/(?:main\.js|libs\/)/.test(pathname)) enginePreviewReads.push(request.url());
  });

  const files = await collectFiles(projectFixtureRoot);
  await page.goto("/");
  const id = await registerEditorProject(page, files);
  await page.goto(`/service/${id}/project/`);
  await expect(page.getByTestId("open-editor")).toBeEnabled();
  await page.getByTestId("open-editor").click();
  await expect(page).toHaveURL(new RegExp(`/service/${id}/editor/$`));
  await expect(page.getByTestId("workspace-map")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("map-canvas-input")).toBeVisible();
  await expect(page.getByTestId("editor-startup-error")).toHaveCount(0);

  await page.getByTestId("workspace-tower").click();
  const tower = page.getByTestId("panel-tower");
  await expect(tower).toBeVisible();
  const title = tower.getByTestId("schema-input-firstData-title").locator("input");
  await title.fill("Hosted Editor Title");
  await title.blur();
  await expect.poll(() => page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const directories = [];
    for await (const handle of root.values()) if (handle.kind === "directory" && handle.name.startsWith("mota-editor-")) directories.push(handle);
    const project = directories.at(-1) as FileSystemDirectoryHandle;
    const directory = await project.getDirectoryHandle("project");
    return (await (await directory.getFileHandle("data.js")).getFile()).text();
  })).toContain("Hosted Editor Title");

  await tower.getByTestId("schema-input-firstData-startCanvas").getByRole("button", { name: "编辑" }).click();
  await expect(page.getByTestId("event-editor")).toBeVisible();
  await expect(page.getByTestId("event-editor-source")).toHaveValue(/previewUI/);
  await page.getByTestId("event-editor-cancel").click();

  await page.getByTestId("workspace-scripts").click();
  const scripts = page.getByTestId("scripts-workspace");
  await expect(scripts).toBeVisible();
  await scripts.locator(".scriptRootTabs").getByRole("button", { name: "插件", exact: true }).click();
  await scripts.locator(".scriptTreeLeaf").filter({ hasText: "init" }).click();
  const scriptEditor = scripts.locator(".CodeMirror");
  await expect(scriptEditor).toBeVisible();
  await expect.poll(() => scriptEditor.evaluate((element) => {
    const host = element as HTMLElement & { CodeMirror: { getValue(): string } };
    return host.CodeMirror.getValue();
  })).toContain("function init");

  await expect.poll(() => enginePreviewReads.some((url) => url.endsWith("/preview/main.js"))).toBe(true);
  expect(projectPreviewReads).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("switches Editor releases without rebuilding or replacing the active Service Worker", async ({ page }) => {
  const originalPointer = await fs.readFile(path.join(editorStaticRoot, "current.json"), "utf8");
  let releaseA: string | undefined;
  let releaseB: string | undefined;
  try {
    releaseA = await writeTestEditorRelease("release-a");
    releaseB = await writeTestEditorRelease("release-b");
    await pointEditorChannel(releaseA);

    await page.goto("/");
    const id = await registerEditorProject(page, [{
      path: "index.html",
      base64: Buffer.from("<!doctype html><html><body>preview</body></html>").toString("base64"),
    }]);
    const workerBefore = await page.evaluate(async () => ({
      scriptURL: (await navigator.serviceWorker.ready).active?.scriptURL,
      source: await (await fetch("/service-worker.js", { cache: "no-store" })).text(),
    }));

    await page.goto(`/service/${id}/editor/`);
    await expect(page.getByTestId("editor-release-marker")).toHaveText("release-a");
    await expect(page.locator("base")).toHaveAttribute("href", new RegExp(`/releases/${releaseA}/$`));

    await pointEditorChannel(releaseB);
    await page.reload();
    await expect(page.getByTestId("editor-release-marker")).toHaveText("release-b");
    await expect(page.locator("base")).toHaveAttribute("href", new RegExp(`/releases/${releaseB}/$`));
    const workerAfter = await page.evaluate(async () => ({
      scriptURL: (await navigator.serviceWorker.ready).active?.scriptURL,
      source: await (await fetch("/service-worker.js", { cache: "no-store" })).text(),
    }));
    expect(workerAfter).toEqual(workerBefore);
  } finally {
    await fs.writeFile(path.join(editorStaticRoot, "current.json"), originalPointer);
    await Promise.all([releaseA, releaseB].filter(Boolean).map((buildId) => (
      fs.rm(path.join(editorStaticRoot, "releases", buildId!), { recursive: true, force: true })
    )));
  }
});
