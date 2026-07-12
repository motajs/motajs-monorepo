import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Page, Route } from "@playwright/test";
import { MOTA_JS_ROOT } from "../../mota-root";

type WriteListener = {
  path: string;
  version: number;
  resolve: () => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

const PROJECT_ROOT = path.join(MOTA_JS_ROOT, "project");
const PUBLIC_ROOT = MOTA_JS_ROOT;
const CONFIG_PATH = "_server/config.json";
const FILE_ENDPOINTS = new Set([
  "/readFile",
  "/writeFile",
  "/writeMultiFiles",
  "/listFile",
  "/makeDir",
  "/moveFile",
  "/deleteFile",
]);

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolute));
    } else if (entry.isFile()) {
      files.push(absolute);
    }
  }

  return files;
}

function toProjectPath(absolute: string): string {
  return normalizeFilePath(`project/${path.relative(PROJECT_ROOT, absolute)}`);
}

function normalizeFilePath(filePath: string): string {
  return filePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "");
}

function isProjectPath(filePath: string): boolean {
  return normalizeFilePath(filePath).startsWith("project/");
}

function isWritableSandboxPath(filePath: string): boolean {
  const normalized = normalizeFilePath(filePath);
  return isProjectPath(normalized) || normalized === CONFIG_PATH;
}

async function readPublicFile(filePath: string, encoding: BufferEncoding): Promise<string> {
  const normalized = normalizeFilePath(filePath);
  const absolute = path.resolve(PUBLIC_ROOT, normalized);
  const relative = path.relative(PUBLIC_ROOT, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to read outside mota-js root: ${filePath}`);
  }
  return readFile(absolute, { encoding });
}

function makeResponse(body: string, status: number = 200): Parameters<Route["fulfill"]>[0] {
  return {
    status,
    contentType: "text/plain; charset=utf-8",
    body,
  };
}

export class ProjectSandbox {
  private files = new Map<string, Buffer>();
  private writeVersions = new Map<string, number>();
  private deleteVersions = new Map<string, number>();
  private readVersions = new Map<string, number>();
  private writeListeners: WriteListener[] = [];
  private deleteListeners: WriteListener[] = [];

  static async create(page: Page): Promise<ProjectSandbox> {
    const sandbox = new ProjectSandbox();
    await sandbox.loadProjectFiles();
    await page.route("**/*", async (route) => {
      await sandbox.handleRoute(route);
    });
    return sandbox;
  }

  readText(filePath: string): string {
    const file = this.files.get(normalizeFilePath(filePath));
    if (!file) throw new Error(`Missing sandbox file: ${filePath}`);
    return file.toString("utf-8");
  }

  readBytes(filePath: string): Buffer {
    const file = this.files.get(normalizeFilePath(filePath));
    if (!file) throw new Error(`Missing sandbox file: ${filePath}`);
    return Buffer.from(file);
  }

  writeText(filePath: string, value: string): void {
    const normalized = normalizeFilePath(filePath);
    if (!isWritableSandboxPath(normalized)) {
      throw new Error(`Refusing to write non-project sandbox file: ${filePath}`);
    }
    this.files.set(normalized, Buffer.from(value, "utf-8"));
    this.notify(this.writeListeners, this.writeVersions, normalized);
  }

  hasFile(filePath: string): boolean {
    return this.files.has(normalizeFilePath(filePath));
  }

  readCount(filePath: string): number {
    return this.readVersions.get(normalizeFilePath(filePath)) ?? 0;
  }

  waitForWrite(filePath: string, timeoutMs: number = 10_000): Promise<void> {
    const normalized = normalizeFilePath(filePath);
    const version = this.writeVersions.get(normalized) ?? 0;
    return this.waitForVersion(this.writeListeners, normalized, version, timeoutMs, "write");
  }

  waitForDelete(filePath: string, timeoutMs: number = 10_000): Promise<void> {
    const normalized = normalizeFilePath(filePath);
    const version = this.deleteVersions.get(normalized) ?? 0;
    return this.waitForVersion(this.deleteListeners, normalized, version, timeoutMs, "delete");
  }

  private async loadProjectFiles(): Promise<void> {
    for (const absolute of await collectFiles(PROJECT_ROOT)) {
      this.files.set(toProjectPath(absolute), await readFile(absolute));
    }
    try {
      this.files.set(CONFIG_PATH, await readFile(path.join(PUBLIC_ROOT, CONFIG_PATH)));
    } catch {
      this.files.set(CONFIG_PATH, Buffer.from("{}", "utf-8"));
    }
  }

  private waitForVersion(
    listeners: WriteListener[],
    filePath: string,
    version: number,
    timeoutMs: number,
    action: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = listeners.findIndex((listener) => listener.timer === timer);
        if (index >= 0) listeners.splice(index, 1);
        reject(new Error(`Timed out waiting for ${action}: ${filePath}`));
      }, timeoutMs);

      listeners.push({
        path: filePath,
        version,
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject,
        timer,
      });
    });
  }

  private notify(listeners: WriteListener[], versions: Map<string, number>, filePath: string): void {
    const nextVersion = (versions.get(filePath) ?? 0) + 1;
    versions.set(filePath, nextVersion);

    for (let i = listeners.length - 1; i >= 0; i -= 1) {
      const listener = listeners[i];
      if (listener.path === filePath && nextVersion > listener.version) {
        listeners.splice(i, 1);
        listener.resolve();
      }
    }
  }

  private async handleRoute(route: Route): Promise<void> {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() !== "POST" || !FILE_ENDPOINTS.has(pathname)) {
      await route.fallback();
      return;
    }

    try {
      const params = new URLSearchParams(request.postData() ?? "");
      const body = await this.handleEndpoint(pathname, params);
      await route.fulfill(makeResponse(body));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await route.fulfill(makeResponse(`error: ${message}`));
    }
  }

  private async handleEndpoint(pathname: string, params: URLSearchParams): Promise<string> {
    if (pathname === "/readFile") return this.readFile(params);
    if (pathname === "/writeFile") return this.writeFile(params);
    if (pathname === "/writeMultiFiles") return this.writeMultiFiles(params);
    if (pathname === "/listFile") return this.listFile(params);
    if (pathname === "/makeDir") return this.makeDir(params);
    if (pathname === "/moveFile") return this.moveFile(params);
    if (pathname === "/deleteFile") return this.deleteFile(params);
    return `error: Unsupported endpoint ${pathname}`;
  }

  private async readFile(params: URLSearchParams): Promise<string> {
    const name = normalizeFilePath(params.get("name") ?? "");
    const encoding = params.get("type") === "base64" ? "base64" : "utf-8";
    const file = this.files.get(name);
    if (file) {
      this.readVersions.set(name, (this.readVersions.get(name) ?? 0) + 1);
      return file.toString(encoding);
    }
    return readPublicFile(name, encoding);
  }

  private writeFile(params: URLSearchParams): string {
    const name = normalizeFilePath(params.get("name") ?? "");
    if (!isWritableSandboxPath(name)) return `error: Refusing to write non-project file ${name}`;

    const encoding = params.get("type") === "base64" ? "base64" : "utf-8";
    const value = params.get("value") ?? "";
    this.files.set(name, Buffer.from(value, encoding));
    this.notify(this.writeListeners, this.writeVersions, name);
    return "";
  }

  private writeMultiFiles(params: URLSearchParams): string {
    const names = (params.get("name") ?? "").split(";").filter(Boolean).map(normalizeFilePath);
    const values = (params.get("value") ?? "").split(";");
    if (names.some((name) => !isProjectPath(name))) {
      return "error: Refusing to write non-project file";
    }

    for (let i = 0; i < names.length; i += 1) {
      const name = names[i];
      this.files.set(name, Buffer.from(values[i] ?? "", "utf-8"));
      this.notify(this.writeListeners, this.writeVersions, name);
    }
    return "";
  }

  private async listFile(params: URLSearchParams): Promise<string> {
    const name = normalizeFilePath(params.get("name") ?? "");
    if (!isProjectPath(`${name}/`) && name !== "project") {
      const absolute = path.resolve(PUBLIC_ROOT, name);
      const relative = path.relative(PUBLIC_ROOT, absolute);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        return "error: Invalid list path";
      }
      return JSON.stringify(await readdir(absolute));
    }

    const prefix = name.endsWith("/") ? name : `${name}/`;
    const entries = new Set<string>();
    for (const filePath of this.files.keys()) {
      if (!filePath.startsWith(prefix)) continue;
      const rest = filePath.slice(prefix.length);
      const entry = rest.split("/")[0];
      if (entry) entries.add(entry);
    }
    return JSON.stringify([...entries].sort());
  }

  private makeDir(params: URLSearchParams): string {
    const name = normalizeFilePath(params.get("name") ?? "");
    if (!isProjectPath(`${name}/`) && name !== "project") {
      return `error: Refusing to create non-project directory ${name}`;
    }
    return "";
  }

  private moveFile(params: URLSearchParams): string {
    const src = normalizeFilePath(params.get("src") ?? "");
    const dest = normalizeFilePath(params.get("dest") ?? "");
    if (!isProjectPath(src) || !isProjectPath(dest)) {
      return "error: Refusing to move non-project file";
    }
    const file = this.files.get(src);
    if (!file) return `error: Missing file ${src}`;
    this.files.set(dest, file);
    this.files.delete(src);
    this.notify(this.writeListeners, this.writeVersions, dest);
    this.notify(this.deleteListeners, this.deleteVersions, src);
    return "";
  }

  private deleteFile(params: URLSearchParams): string {
    const name = normalizeFilePath(params.get("name") ?? "");
    if (!isProjectPath(name)) return `error: Refusing to delete non-project file ${name}`;
    this.files.delete(name);
    this.notify(this.deleteListeners, this.deleteVersions, name);
    return "";
  }
}
