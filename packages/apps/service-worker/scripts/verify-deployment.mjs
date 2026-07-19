import { chromium } from "@playwright/test";

const deploymentUrl = new URL(process.env.DEPLOY_URL ?? process.argv[2] ?? "https://mota.press/server/");
if (!deploymentUrl.pathname.endsWith("/")) deploymentUrl.pathname += "/";

async function fetchJson(relative) {
  const url = new URL(relative, deploymentUrl);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return { url, value: await response.json() };
}

const workerUrl = new URL("service-worker.js", deploymentUrl);
const workerResponse = await fetch(workerUrl, { cache: "no-store" });
if (!workerResponse.ok) throw new Error(`${workerUrl} returned HTTP ${workerResponse.status}`);
const workerType = workerResponse.headers.get("content-type") ?? "";
if (!workerType.includes("javascript")) throw new Error(`${workerUrl} has unexpected content-type ${workerType}`);

const channel = await fetchJson("static/editor/current.json");
if (!/^[a-f0-9]{64}$/.test(channel.value.buildId ?? "")) {
  throw new Error(`${channel.url} contains an invalid buildId`);
}
const manifest = await fetchJson(`static/editor/releases/${channel.value.buildId}/editor-manifest.json`);
if (manifest.value.buildId !== channel.value.buildId) {
  throw new Error("Published Editor channel and manifest buildId do not match");
}

const channelName = process.env.PLAYWRIGHT_CHANNEL
  ?? (process.platform === "darwin" ? "chrome" : undefined);
const browser = await chromium.launch(channelName ? { channel: channelName } : {});
let context;
try {
  context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(deploymentUrl.href, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("Service Worker controller timeout")), 20_000);
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.clearTimeout(timer);
        resolve(undefined);
      }, { once: true });
    });
  });
  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  const registration = await page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready;
    return {
      controller: navigator.serviceWorker.controller?.scriptURL ?? null,
      active: ready.active?.scriptURL ?? null,
      scope: ready.scope,
    };
  });
  if (registration.controller !== workerUrl.href) {
    throw new Error(`Unexpected Service Worker controller: ${registration.controller}`);
  }
  if (registration.scope !== deploymentUrl.href) {
    throw new Error(`Unexpected Service Worker scope: ${registration.scope}`);
  }
  console.log(JSON.stringify({
    url: deploymentUrl.href,
    editorBuildId: channel.value.buildId,
    previousEditorBuildId: channel.value.previousBuildId ?? null,
    serviceWorker: registration,
  }, null, 2));
} finally {
  if (context) await context.close();
  await Promise.race([
    browser.close(),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
}
process.exit(0);
