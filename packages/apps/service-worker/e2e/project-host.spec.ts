import { expect, test, type Page } from "@playwright/test";

const withEditor = process.env.MOTA_WITH_EDITOR !== "0";

async function registerOpfsProject(page: Page): Promise<{ id: number; directoryName: string }> {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
    }
    const controller = navigator.serviceWorker.controller ?? registration.active;
    if (!controller) throw new Error("Service Worker did not activate");

    const root = await navigator.storage.getDirectory();
    const directoryName = `mota-project-${Date.now()}`;
    const project = await root.getDirectoryHandle(directoryName, { create: true });
    const write = async (name: string, value: string) => {
      const file = await project.getFileHandle(name, { create: true });
      const stream = await file.createWritable();
      await stream.write(value);
      await stream.close();
    };
    await write("index.html", `<!doctype html><h1 data-test-id="preview-title">OPFS Preview</h1><script src="./main.js"></script>`);
    await write("main.js", `document.body.dataset.previewReady = "true";`);
    await write("empty.txt", "");
    await project.getDirectoryHandle("project", { create: true });

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
    return { id: await response, directoryName };
  });
}

test("registers an OPFS project, serves preview and persists through the canonical API", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByTestId("register-project")).toBeEnabled();
  const { id, directoryName } = await registerOpfsProject(page);

  await page.goto(`/service/${id}/project/`);
  await expect(page.getByRole("heading", { name: directoryName })).toBeVisible();
  await expect(page.getByTestId("open-preview")).toBeEnabled();
  if (withEditor) await expect(page.getByTestId("open-editor")).toBeEnabled();
  else await expect(page.getByTestId("open-editor")).toHaveCount(0);
  await expect(page.getByText("index.html")).toBeVisible();

  await page.goto(`/service/${id}/preview/`);
  await expect(page.getByTestId("preview-title")).toHaveText("OPFS Preview");
  await expect.poll(() => page.locator("body").getAttribute("data-preview-ready")).toBe("true");

  const persisted = await page.evaluate(async (projectId) => {
    const value = "中文 + % & = spaces";
    const response = await fetch(`/service/${projectId}/api/fs/writeFile`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ name: "project/events.js", type: "utf-8", value }),
    });
    if (!response.ok) throw new Error(await response.text());
    const read = await fetch(`/service/${projectId}/api/fs/readFile`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ name: "project/events.js", type: "utf-8" }),
    });
    return read.text();
  }, id);
  expect(persisted).toBe("中文 + % & = spaces");

  await page.goto(`/tower/${id}/project/events.js?legacy=1`);
  await expect(page).toHaveURL(new RegExp(`/service/${id}/preview/project/events\\.js\\?legacy=1$`));
  expect(await page.textContent("body")).toContain("中文 + % & = spaces");

  await page.goto(`/service/${id}/project/`);
  await page.getByTestId("forget-project").click();
  await page.getByRole("dialog").getByRole("button", { name: "confirm" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:4178/");

  const diskFileStillExists = await page.evaluate(async (name) => {
    const root = await navigator.storage.getDirectory();
    const project = await root.getDirectoryHandle(name);
    return (await project.getFileHandle("index.html")).getFile().then((file) => file.size > 0);
  }, directoryName);
  expect(diskFileStillExists).toBe(true);
  expect(pageErrors).toEqual([]);
});
