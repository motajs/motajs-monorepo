import { accessProjectById } from "./project";
import { ResponseUtils } from "./utils";
import {
  EditorReleaseError,
  getEditorReleaseManager,
  resolveEditorRelease,
} from "./editorRelease";

const environmentPattern = /(<script\b[^>]*\bid=["']mota-editor-environment["'][^>]*>)[\s\S]*?(<\/script>)/i;

const htmlAttribute = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("\"", "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

export interface EditorShellOptions {
  html: string;
  scopeUrl: URL;
  releaseRoot: URL;
  runtimeEntrypoint: string;
  projectId: number;
  docsEndpoint?: string;
  release: {
    buildId: string;
    version: string;
  };
}

export function createEditorShell({
  html,
  scopeUrl,
  releaseRoot,
  runtimeEntrypoint,
  projectId,
  docsEndpoint,
  release,
}: EditorShellOptions): string {
  const scope = new URL("./", scopeUrl);
  const serviceRoot = new URL(`service/${projectId}/`, scope);
  const environment = {
    protocolVersion: 1,
    release,
    endpoints: {
      fs: new URL("api/fs/", serviceRoot).href,
      runtime: new URL(runtimeEntrypoint, releaseRoot).href,
      preview: new URL("preview/", serviceRoot).href,
      ...(docsEndpoint ? { docs: docsEndpoint } : {}),
      project: new URL("project/", serviceRoot).href,
      update: new URL("api/editor-update/", serviceRoot).href,
    },
  };
  const serialized = JSON.stringify(environment).replaceAll("<", "\\u003c");
  const withEnvironment = html.replace(environmentPattern, (_match, open: string, close: string) => `${open}${serialized}${close}`);
  if (withEnvironment === html) throw new Error("Editor environment node is missing from artifact HTML");
  if (/<base\s/i.test(withEnvironment)) throw new Error("Editor artifact HTML must not contain a base element");
  return withEnvironment.replace(/<head([^>]*)>/i, `<head$1><base href="${htmlAttribute(releaseRoot.href)}">`);
}

export async function serveEditorUpdateStatus(
  request: Request,
  scopeUrl: URL,
  schedule?: (task: Promise<unknown>) => void,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "POST") {
    return ResponseUtils.error(405, "method-not-allowed", "Editor update status supports GET, HEAD and POST only");
  }
  const manager = getEditorReleaseManager(scopeUrl);
  if (request.method === "POST") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return ResponseUtils.error(400, "invalid-request", "Editor update action must be valid JSON");
    }
    if (!body || typeof body !== "object" || !("action" in body)) {
      return ResponseUtils.error(400, "invalid-request", "Editor update action is missing");
    }
    const action = (body as { action?: unknown }).action;
    if (action === "check") {
      const task = manager.checkForUpdates((body as { force?: unknown }).force === true)
        .catch((error) => console.debug("Editor update check failed", error));
      if (schedule) schedule(task);
      else void task;
    } else if (action === "activate") {
      const buildId = (body as { buildId?: unknown }).buildId;
      if (typeof buildId !== "string") {
        return ResponseUtils.error(400, "invalid-request", "Editor candidate buildId is missing");
      }
      try {
        await manager.activateCandidate(buildId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return ResponseUtils.error(error instanceof EditorReleaseError ? 409 : 500, "activation-failed", message);
      }
    } else {
      return ResponseUtils.error(400, "invalid-request", "Unknown Editor update action");
    }
  }
  const status = await manager.getUpdateState();
  return new Response(request.method === "HEAD" ? null : JSON.stringify(status), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function serveProjectEditor(
  request: Request,
  scopeUrl: URL,
  projectId: number,
  projectUrl: string,
  schedule?: (task: Promise<unknown>) => void,
  clientId?: string,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return ResponseUtils.error(405, "method-not-allowed", "Editor shell supports GET and HEAD only");
  }
  const access = await accessProjectById(projectId);
  if (access.status === "not-found") return ResponseUtils.error(404, "project-not-found", "Project not found");
  if (access.status === "permission-required") return Response.redirect(`${projectUrl}?reason=permission`, 302);
  const serviceRoot = new URL(`service/${projectId}/`, new URL("./", scopeUrl));
  const docsEndpoint = await access.fs.promises.stat("_docs/index.html")
    .then((stat) => stat.isFile() ? new URL("preview/_docs/", serviceRoot).href : undefined)
    .catch(() => undefined);
  let release;
  try {
    release = await resolveEditorRelease(scopeUrl, schedule, clientId);
  } catch (error) {
    const target = new URL(projectUrl);
    target.searchParams.set("reason", "editor-unavailable");
    target.searchParams.set("detail", error instanceof Error ? error.message : String(error));
    return Response.redirect(target, 302);
  }
  const output = createEditorShell({
    html: release.html,
    scopeUrl,
    releaseRoot: release.releaseRoot,
    runtimeEntrypoint: release.manifest.entrypoints.runtime,
    projectId,
    docsEndpoint,
    release: {
      buildId: release.manifest.buildId,
      version: release.manifest.editorVersion,
    },
  });
  return new Response(request.method === "HEAD" ? null : output, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
