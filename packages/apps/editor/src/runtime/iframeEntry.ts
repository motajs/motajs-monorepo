import {
  type HostMessage,
  type HostResourceResponse,
  RUNTIME_PROTOCOL_VERSION,
  type RuntimeConnectMessage,
  type RuntimeMessage,
  type RuntimePreviewContext,
} from "./protocol";

const runtime: any = window;
let port: MessagePort | null = null;
let resourceSequence = 0;
const resourcePending = new Map<
  number,
  { resolve: (value: HostResourceResponse & { ok: true }) => void; reject: (error: Error) => void }
>();
const changedResources = new Map<string, import("./protocol").ProjectResourceChange>();
const blobUrls = new Map<string, string>();
let functionsSource = "";
let pluginsSource = "";
let rejectInitialization: ((reason: unknown) => void) | null = null;

function fatal(error: unknown): void {
  port?.postMessage(
    { type: "fatal", message: error instanceof Error ? error.message : String(error) } satisfies RuntimeMessage,
  );
}

window.addEventListener("error", (event) => {
  event.preventDefault();
  fatal(event.error ?? event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  fatal(event.reason);
});

function requestResource(path: string, binary: boolean): Promise<HostResourceResponse & { ok: true }> {
  if (!port) return Promise.reject(new Error("Runtime channel unavailable"));
  const id = ++resourceSequence;
  return new Promise((resolve, reject) => {
    resourcePending.set(id, { resolve, reject });
    port!.postMessage({ id, type: "resource", path, binary } satisfies RuntimeMessage);
  });
}

async function loadScript(src: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Cannot load runtime engine ${src}`));
    document.body.appendChild(script);
  });
}

function evaluateProject(source: string): void {
  (0, eval)(`${source}\n//# sourceURL=mota-runtime-project.js`);
}

async function binaryUrl(path: string, mime: string): Promise<string> {
  const response = await requestResource(path, true);
  if (!response.bytes) throw new Error(`Missing bytes for ${path}`);
  const previous = blobUrls.get(path);
  if (previous) URL.revokeObjectURL(previous);
  const url = URL.createObjectURL(new Blob([response.bytes], { type: mime }));
  blobUrls.set(path, url);
  return url;
}

async function loadProjectImage(path: string): Promise<HTMLImageElement> {
  const url = await binaryUrl(path, /\.gif$/i.test(path) ? "image/gif" : "image/png");
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      image.setAttribute("_width", String(image.width));
      image.setAttribute("_height", String(image.height));
      resolve(image);
    };
    image.onerror = () => reject(new Error(`Cannot decode ${path}`));
    image.src = url;
  });
}

function refreshSplitImages(sourceFile: string): void {
  for (const one of runtime.main.splitImages ?? []) {
    const mapped = runtime.core.getMappedName(one.name);
    if (mapped !== sourceFile) continue;
    const prefix = one.prefix || "";
    for (const key of Object.keys(runtime.core.material.images.images)) {
      if (new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d+\\.png$`).test(key)) {
        delete runtime.core.material.images.images[key];
      }
    }
    const source = runtime.core.material.images.images[mapped];
    if (!source) continue;
    const images = runtime.core.splitImage(source, one.width, one.height);
    images.forEach((image: HTMLCanvasElement, index: number) => {
      runtime.core.material.images.images[`${prefix}${index}.png`] = image;
    });
  }
}

async function syncProjectCode(): Promise<void> {
  const [functions, plugins] = await Promise.all([
    requestResource("project/functions.js", false),
    requestResource("project/plugins.js", false),
  ]);
  if ((functions.text ?? "") !== functionsSource) {
    functionsSource = functions.text ?? "";
    evaluateProject(functionsSource);
    const source = runtime.functions_d6ad677b_427a_4623_b50f_a445a3b0ef8a;
    if (source) {
      runtime.core.events.eventdata = source.events;
      runtime.core.enemys.enemydata = source.enemys;
      runtime.core.actions.actionsdata = source.actions;
      runtime.core.control.controldata = source.control;
      runtime.core.ui.uidata = source.ui;
    }
  }
  if ((plugins.text ?? "") !== pluginsSource) {
    pluginsSource = plugins.text ?? "";
    evaluateProject(pluginsSource);
    runtime.core._init_plugins();
  }
}

async function hotReload(change: import("./protocol").ProjectResourceChange): Promise<void> {
  const path = change.path;
  const file = path.split("/").pop()!;
  const id = file.replace(/\.[^.]+$/, "");
  if (change.state === "deleted") {
    const oldUrl = blobUrls.get(path);
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    blobUrls.delete(path);
    if (change.kind === "animation") delete runtime.core.material.animates[id];
    else if (path.includes("/materials/")) delete runtime.core.material.images[id];
    else if (path.includes("/autotiles/")) delete runtime.core.material.images.autotile[id];
    else if (path.includes("/tilesets/")) delete runtime.core.material.images.tilesets[file];
    else if (path.includes("/images/")) delete runtime.core.material.images.images[file];
    return;
  }
  if (change.state !== "loaded") return;
  if (change.kind === "animation") {
    const response = await requestResource(path, false);
    runtime.core.material.animates[id] = runtime.core.loader._loadAnimate(response.text ?? "");
    return;
  }
  if (change.kind === "audio") {
    if (path.includes("/bgms/")) runtime.core.loader.loadOneMusic(file);
    else runtime.core.loader.loadOneSound(file);
    return;
  }
  if (change.kind !== "image") return;
  const image = await loadProjectImage(path);
  if (path.includes("/materials/")) {
    runtime.core.material.images[id] = image;
    if (id === "icons") runtime.core.loader._loadMaterials_afterLoad();
  } else if (path.includes("/autotiles/")) runtime.core.material.images.autotile[id] = image;
  else if (path.includes("/tilesets/")) runtime.core.material.images.tilesets[file] = image;
  else if (path.includes("/images/")) {
    runtime.core.material.images.images[file] = image;
    refreshSplitImages(file);
  }
}

async function syncChangedResources(): Promise<void> {
  await syncProjectCode();
  const changes = [...changedResources.values()];
  changedResources.clear();
  await Promise.all(changes.map(hotReload));
}

async function syncContextAssets(context: RuntimePreviewContext): Promise<void> {
  const pending = new Map<string, import("./protocol").ProjectResourceChange>();
  for (const asset of context.blockRegistry.assets) {
    const file = asset.path.split("/").pop()!;
    const id = file.replace(/\.[^.]+$/, "");
    const exists = asset.path.includes("/autotiles/")
      ? runtime.core.material.images.autotile[id]
      : asset.path.includes("/tilesets/")
      ? runtime.core.material.images.tilesets[file]
      : asset.path.includes("/materials/")
      ? runtime.core.material.images[id]
      : true;
    if (!exists) {
      pending.set(asset.path, {
        revision: 0,
        path: asset.path,
        state: "loaded",
        kind: "image",
      });
    }
  }
  await Promise.all([...pending.values()].map(hotReload));
}

function installMainResourceHooks(engineRoot: URL): void {
  runtime.main.loadMod = (dir: string, name: string, callback: (name: string) => void) => {
    const task = dir === "project"
      ? requestResource(`project/${name}.js`, false).then((response) => evaluateProject(response.text ?? ""))
      : loadScript(new URL(`${dir}/${name}.js`, engineRoot).href);
    void task.then(() => callback(name)).catch(fatal);
  };
  runtime.main.loadFloors = (callback: () => void) => {
    void Promise.allSettled((runtime.main.floorIds ?? []).map(async (id: string) => {
      const response = await requestResource(`project/floors/${id}.js`, false);
      evaluateProject(response.text ?? "");
    })).then((results) => {
      results.forEach((result) => {
        if (result.status === "rejected") {
          port?.postMessage({ type: "diagnostic", message: String(result.reason) } satisfies RuntimeMessage);
        }
      });
      try {
        callback();
      } catch (error) {
        if (rejectInitialization) rejectInitialization(error);
        else fatal(error);
      }
    });
  };
  runtime.main.importFonts = function(fonts: string[]) {
    for (const font of fonts ?? []) {
      void binaryUrl(`project/fonts/${font}.ttf`, "font/ttf").then((url) => {
        const face = new FontFace(font, `url(${url})`);
        return face.load().then((loaded) => document.fonts.add(loaded));
      });
    }
  };
}

function installLoaderResourceHooks(): void {
  const prototype = runtime.loader.prototype;
  prototype.loadImage = function(
    dir: string,
    imageName: string,
    callback: (id: string, image: HTMLImageElement | null) => void,
  ) {
    const file = imageName.includes(".") ? imageName : `${imageName}.png`;
    void binaryUrl(`project/${dir}/${file}`, /\.gif$/i.test(file) ? "image/gif" : "image/png").then((url) => {
      const image = new Image();
      image.onload = () => {
        image.setAttribute("_width", String(image.width));
        image.setAttribute("_height", String(image.height));
        callback(imageName, image);
      };
      image.onerror = () => callback(imageName, null);
      image.src = url;
    }).catch(() => callback(imageName, null));
  };
  prototype._loadAnimates_sync = function() {
    for (const name of runtime.core.animates ?? []) {
      void requestResource(`project/animates/${name}.animate`, false).then((response) => {
        runtime.core.material.animates[name] = runtime.core.loader._loadAnimate(response.text ?? "");
      }).catch((error) => {
        port?.postMessage({ type: "diagnostic", message: String(error) } satisfies RuntimeMessage);
      });
    }
  };
  prototype.loadOneMusic = function(name: string) {
    const music = new Audio();
    music.preload = "none";
    music.loop = true;
    runtime.core.material.bgms[name] = music;
    void binaryUrl(`project/bgms/${name}`, "audio/mpeg").then((url) => {
      music.src = url;
    });
  };
  prototype.loadOneSound = function(name: string) {
    void requestResource(`project/sounds/${name}`, true).then((response) => {
      if (response.bytes) runtime.core.loader._loadOneSound_decodeData(name, response.bytes);
    });
  };
  const originalMusic = prototype._loadMusic_sync;
  prototype._loadMusic_sync = function() {
    const startBgm = runtime.main.startBgm;
    runtime.main.startBgm = null;
    originalMusic.call(this);
    runtime.main.startBgm = startBgm;
  };
}

let restorePreview: (() => void) | null = null;

function closePreview(): void {
  runtime.core?.deleteCanvas?.((name: string) => name.startsWith("_uievent_selector_"));
  for (
    const canvas of document.querySelectorAll<HTMLElement>(
      "canvas#uievent, canvas#runtimeStatusPreview, canvas[id^=\"_uievent_selector_\"]",
    )
  ) {
    canvas.style.visibility = "hidden";
    canvas.style.display = "none";
  }
  restorePreview?.();
  restorePreview = null;
}

function beginPreview(context: RuntimePreviewContext): void {
  closePreview();
  const core: any = runtime.core;
  const floorId = context.floorId;
  const previousFloor = floorId ? core.floors[floorId] : undefined;
  const previousMainFloor = floorId ? runtime.main.floors[floorId] : undefined;
  const snapshot = {
    firstData: core.firstData,
    dataFirstData: core.data.firstData,
    values: core.values,
    flags: core.flags,
    nameMap: runtime.main.nameMap,
    blocksInfo: core.maps.blocksInfo,
    icons: core.material.icons,
    itemData: core.items.items,
    enemyData: core.enemys.enemys,
    materialItems: core.material.items,
    materialEnemys: core.material.enemys,
    id2number: core.status.id2number,
    number2Block: core.status.number2Block,
    statusFloorId: core.status.floorId,
    statusThisMap: core.status.thisMap,
    statusMaps: core.status.maps,
    statusHero: core.status.hero,
    statusCanvasCtx: core.dom.statusCanvasCtx,
    isVertical: core.domStyle.isVertical,
    showStatusBar: core.domStyle.showStatusBar,
  };
  restorePreview = () => {
    core.firstData = snapshot.firstData;
    core.data.firstData = snapshot.dataFirstData;
    core.values = snapshot.values;
    core.flags = snapshot.flags;
    runtime.main.nameMap = snapshot.nameMap;
    core.maps.blocksInfo = snapshot.blocksInfo;
    core.material.icons = snapshot.icons;
    core.items.items = snapshot.itemData;
    core.enemys.enemys = snapshot.enemyData;
    core.material.items = snapshot.materialItems;
    core.material.enemys = snapshot.materialEnemys;
    core.status.id2number = snapshot.id2number;
    core.status.number2Block = snapshot.number2Block;
    core.status.floorId = snapshot.statusFloorId;
    core.status.thisMap = snapshot.statusThisMap;
    core.status.maps = snapshot.statusMaps;
    core.status.hero = snapshot.statusHero;
    core.dom.statusCanvasCtx = snapshot.statusCanvasCtx;
    core.domStyle.isVertical = snapshot.isVertical;
    core.domStyle.showStatusBar = snapshot.showStatusBar;
    runtime.hero = core.status.hero;
    runtime.flags = core.status.hero?.flags;
    if (floorId) {
      if (previousFloor === undefined) delete core.floors[floorId];
      else core.floors[floorId] = previousFloor;
      if (previousMainFloor === undefined) delete runtime.main.floors[floorId];
      else runtime.main.floors[floorId] = previousMainFloor;
    }
  };
  applyContext(context);
}

function applyContext(context: RuntimePreviewContext): void {
  const core: any = runtime.core;
  const firstData = structuredClone(context.tower.firstData ?? {}) as {
    floorId?: string;
    hero?: { loc?: { x?: unknown; y?: unknown } };
  };
  const heroLoc = firstData.hero?.loc ?? {};
  core.firstData = firstData;
  core.data.firstData = firstData;
  core.values = structuredClone(context.tower.values ?? {});
  core.flags = structuredClone(context.tower.flags ?? {});
  runtime.main.nameMap = structuredClone(context.tower.nameMap ?? {});
  runtime.editor.currentFloorId = context.floorId ?? firstData.floorId ?? "";
  runtime.editor.pos = {
    x: Number.isFinite(Number(heroLoc.x)) ? Number(heroLoc.x) : 0,
    y: Number.isFinite(Number(heroLoc.y)) ? Number(heroLoc.y) : 0,
  };
  core.maps.blocksInfo = structuredClone(context.blockRegistry.maps);
  core.material.icons = structuredClone(context.blockRegistry.icons);
  core.items.items = structuredClone(context.blockRegistry.items);
  core.enemys.enemys = structuredClone(context.blockRegistry.enemys);
  for (const [id, item] of Object.entries(core.items.items as Record<string, Record<string, unknown>>)) item.id = id;
  for (const [id, enemy] of Object.entries(core.enemys.enemys as Record<string, Record<string, unknown>>)) {
    enemy.id = id;
  }
  core.material.items = core.items.getItems();
  core.material.enemys = core.enemys.getEnemys();
  core.status.id2number = {};
  core.status.number2Block = {};
  if (context.floorId && context.floor) {
    core.floors[context.floorId] = structuredClone(context.floor);
    runtime.main.floors[context.floorId] = core.floors[context.floorId];
    core.status.floorId = context.floorId;
    core.status.maps = { ...core.status.maps };
    core.status.maps[context.floorId] = core.maps.loadFloor(context.floorId);
    core.status.thisMap = core.status.maps[context.floorId];
  }
}

function exposeCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
  document.body.appendChild(canvas);
  document.querySelectorAll<HTMLElement>("body > *").forEach((element) => {
    element.style.visibility = "hidden";
  });
  const layers = canvas.id === "uievent"
    ? [canvas, ...document.querySelectorAll<HTMLCanvasElement>("canvas[id^=\"_uievent_selector_\"]")]
    : [canvas];
  layers.forEach((layer, index) => {
    document.body.appendChild(layer);
    layer.style.visibility = "visible";
    layer.style.display = "block";
    layer.style.position = "fixed";
    layer.style.left = layer.style.left || "0";
    layer.style.top = layer.style.top || "0";
    layer.style.zIndex = String(999999 + index);
  });
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  document.body.style.margin = "0";
}

async function renderUI(
  payload: import("./protocol").RuntimeUIPreviewRequest,
): Promise<{ width: number; height: number }> {
  await syncChangedResources();
  await syncContextAssets(payload.context);
  beginPreview(payload.context);
  const core: any = runtime.core;
  core.setAlpha("uievent", 1);
  core.clearMap("uievent");
  core.setFilter("uievent", null);
  if (payload.background === "thumbnail" && payload.context.floorId) {
    core.drawThumbnail(payload.context.floorId, null, { ctx: "uievent" });
  } else core.fillRect("uievent", 0, 0, core.__PIXELS__, core.__PIXELS__, payload.background);
  for (const raw of structuredClone(payload.list)) {
    const data = typeof raw === "string" ? { type: "text", text: raw } : raw;
    if (!data) continue;
    if (data.type === "text") {
      core.saveCanvas("uievent");
      core.drawTextBox(data.text, { ...data, ctx: "uievent" });
      core.loadCanvas("uievent");
    } else if (data.type === "choices") {
      const choices = (Array.isArray(data.choices) ? data.choices : []).map((choice: unknown) => {
        const normalized = typeof choice === "string" ? { text: choice } : { ...(choice as Record<string, unknown>) };
        normalized.text = core.replaceText(String(normalized.text ?? ""));
        return normalized;
      });
      core.saveCanvas("uievent");
      core.status.event.selection = data.selected ?? 0;
      core.drawChoices(core.replaceText(data.text ?? ""), choices, data.width, "uievent");
      core.status.event.selection = null;
      core.loadCanvas("uievent");
    } else if (data.type === "confirm") {
      core.saveCanvas("uievent");
      core.drawConfirmBox(data.text, null, null, "uievent");
      core.loadCanvas("uievent");
    } else core.ui[`_uievent_${data.type}`]?.(data);
  }
  const canvas = core.getContextByName("uievent")?.canvas as HTMLCanvasElement | undefined;
  if (!canvas) throw new Error("Runtime UI canvas unavailable");
  exposeCanvas(canvas, core.__PIXELS__, core.__PIXELS__);
  return { width: core.__PIXELS__, height: core.__PIXELS__ };
}

async function renderStatusBar(
  payload: import("./protocol").RuntimeStatusBarRequest,
): Promise<{ width: number; height: number }> {
  await syncChangedResources();
  await syncContextAssets(payload.context);
  beginPreview(payload.context);
  const core: any = runtime.core;
  const width = payload.orientation === "vertical" ? core.__PIXELS__ : Math.round(core.__PIXELS__ * 0.31);
  const height = payload.orientation === "vertical"
    ? 32 * (core.values.statusCanvasRowsOnMobile || 3) + 9
    : core.__PIXELS__ + (core.flags.extendToolbar ? 41 : 0);
  let canvas = document.getElementById("runtimeStatusPreview") as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "runtimeStatusPreview";
    document.body.appendChild(canvas);
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Runtime status canvas unavailable");
  const previous = core.dom.statusCanvasCtx;
  core.dom.statusCanvasCtx = ctx;
  core.domStyle.isVertical = payload.orientation === "vertical";
  const values = payload.values;
  core.status.hero = structuredClone(core.status.hero);
  for (const key of ["hp", "hpmax", "atk", "def", "mdef", "mana", "manamax", "money", "exp", "lv"]) {
    const value = Number(values[key]);
    if (!Number.isNaN(value)) core.status.hero[key] = value;
  }
  core.status.hero.name = values.name;
  core.flags.statusCanvas = true;
  core.domStyle.showStatusBar = true;
  for (const itemId of (values.items ?? "").split(",").map((item) => item.trim()).filter(Boolean)) {
    const item = core.material.items[itemId];
    if (!item || item.cls === "items") continue;
    core.status.hero.items[item.cls][itemId] = (core.status.hero.items[item.cls][itemId] || 0) + 1;
  }
  core.status.hero.equipment = (values.equips ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  try {
    Object.assign(core.status.hero.flags, JSON.parse(values.flags || "{}"));
  } catch (error) {
    throw new Error(`Invalid status bar flags: ${error instanceof Error ? error.message : String(error)}`);
  }
  runtime.hero = core.status.hero;
  runtime.flags = core.status.hero.flags;
  (0, eval)(`(${payload.code})()`);
  core.dom.statusCanvasCtx = previous;
  exposeCanvas(canvas, width, height);
  return { width, height };
}

async function initialize(previewUrl: string): Promise<void> {
  const response = await fetch(previewUrl);
  if (!response.ok) throw new Error(`Cannot load game index: HTTP ${response.status}`);
  const template = await response.text();
  const engineRoot = new URL(".", response.url || previewUrl);
  const parts = template.split("<!-- injection -->");
  if (parts.length !== 3) throw new Error("Game index injection markers are missing");
  document.body.innerHTML = parts[1];
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = new URL("styles.css", engineRoot).href;
  document.head.appendChild(stylesheet);
  const uiEventCanvas = document.createElement("canvas");
  uiEventCanvas.id = "uievent";
  uiEventCanvas.className = "gameCanvas";
  document.body.appendChild(uiEventCanvas);
  for (
    const src of [
      "libs/thirdparty/lz-string.min.js",
      "libs/thirdparty/priority-queue.min.js",
      "libs/thirdparty/localforage.min.js",
      "libs/thirdparty/zip.min.js",
      "main.js",
    ]
  ) await loadScript(new URL(src, engineRoot).href);
  runtime.editor = {
    isMobile: false,
    currentFloorId: "",
    pos: { x: 0, y: 0 },
    uievent: { isOpen: true },
  };
  runtime.main.replayChecking = true;
  runtime.main.useCompress = false;
  installMainResourceHooks(engineRoot);
  const originalLoadMod = runtime.main.loadMod;
  runtime.main.loadMod = (dir: string, name: string, callback: (name: string) => void) => {
    originalLoadMod(dir, name, (loaded: string) => {
      if (dir === "libs" && name === "loader") installLoaderResourceHooks();
      callback(loaded);
    });
  };
  try {
    await new Promise<void>((resolve, reject) => {
      rejectInitialization = reject;
      runtime.main.init("editor", () => {
        const core = runtime.core;
        core.resetGame(core.firstData.hero, null, core.firstData.floorId, core.cloneArray(core.initStatus.maps));
        core.status.floorId = core.firstData.floorId;
        runtime.editor.currentFloorId = core.status.floorId;
        resolve();
      });
    });
  } finally {
    rejectInitialization = null;
  }
}

window.addEventListener("message", (event) => {
  const connect = event.data as Partial<RuntimeConnectMessage> | undefined;
  if (
    connect?.type !== "mota-runtime-connect" || connect.version !== RUNTIME_PROTOCOL_VERSION
    || typeof connect.previewUrl !== "string" || !event.ports[0]
  ) return;
  port = event.ports[0];
  port.onmessage = (messageEvent: MessageEvent<HostMessage>) => {
    const message = messageEvent.data;
    if (message.type === "resources-changed") {
      for (const change of message.changes) changedResources.set(change.path, change);
      return;
    }
    if (message.type === "resource-response") {
      const pending = resourcePending.get(message.id);
      if (!pending) return;
      resourcePending.delete(message.id);
      if (message.ok) pending.resolve(message as HostResourceResponse & { ok: true });
      else pending.reject(new Error(message.error ?? "Runtime resource failed"));
      return;
    }
    if (!("id" in message)) return;
    void (async () => {
      try {
        const size = message.type === "render-ui"
          ? await renderUI(message.payload)
          : message.type === "render-status-bar"
          ? await renderStatusBar(message.payload)
          : (closePreview(), { width: 416, height: 416 });
        port?.postMessage({ type: "response", id: message.id, ok: true, ...size } satisfies RuntimeMessage);
      } catch (error) {
        port?.postMessage(
          {
            type: "response",
            id: message.id,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          } satisfies RuntimeMessage,
        );
      }
    })();
  };
  port.start();
  void initialize(connect.previewUrl).then(() =>
    port?.postMessage(
      { type: "ready", version: RUNTIME_PROTOCOL_VERSION, instanceId: crypto.randomUUID() } satisfies RuntimeMessage,
    )
  ).catch(fatal);
}, { once: true });
