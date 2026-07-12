import pathUtils from "path";
import mime from "mime";

import { accessProjectById, invalidateProject } from "./project";
import { normalizeProjectPath } from "./fsApi";
import { parseTSConfig, transpileTS } from "./transpiler";
import { errorResponse, ResponseUtils } from "./utils";

const noStoreHeaders = { "cache-control": "no-store" };

const withCharset = (contentType: string) => (
  !/charset=/i.test(contentType)
  && (/^text\//.test(contentType) || /^application\/(javascript|json|xml)$/.test(contentType))
    ? `${contentType}; charset=utf-8`
    : contentType
);

const parseRange = (header: string, size: number): [number, number] | null => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) return null;
  return [start, Math.min(end, size - 1)];
};

const serveBlob = (blob: Blob, request: Request, contentType: string): Response => {
  const rangeHeader = request.headers.get("range");
  const commonHeaders = {
    ...noStoreHeaders,
    "accept-ranges": "bytes",
    "content-type": withCharset(contentType),
  };
  if (rangeHeader) {
    const range = parseRange(rangeHeader, blob.size);
    if (!range) {
      return new Response(null, { status: 416, headers: { ...commonHeaders, "content-range": `bytes */${blob.size}` } });
    }
    const [start, end] = range;
    const body = request.method === "HEAD" ? null : blob.slice(start, end + 1);
    return new Response(body, {
      status: 206,
      headers: {
        ...commonHeaders,
        "content-length": String(end - start + 1),
        "content-range": `bytes ${start}-${end}/${blob.size}`,
      },
    });
  }
  return new Response(request.method === "HEAD" ? null : blob, {
    headers: { ...commonHeaders, "content-length": String(blob.size) },
  });
};

export interface PreviewRouteContext {
  projectId: number;
  projectPath: string;
  request: Request;
  projectUrl: string;
  rootUrl: string;
}

export const serveProjectPreview = async (context: PreviewRouteContext): Promise<Response> => {
  const { projectId, request } = context;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return ResponseUtils.error(405, "method-not-allowed", "Preview resources support GET and HEAD only");
  }
  const access = await accessProjectById(projectId);
  if (access.status === "not-found") {
    return request.mode === "navigate"
      ? Response.redirect(context.rootUrl, 302)
      : ResponseUtils.error(404, "project-not-found", "Project not found");
  }
  if (access.status === "permission-required") {
    return request.mode === "navigate"
      ? Response.redirect(`${context.projectUrl}?reason=permission`, 302)
      : ResponseUtils.error(403, "project-permission-required", "Project permission is required");
  }

  let pathname: string;
  try {
    pathname = normalizeProjectPath(context.projectPath || "index.html");
  } catch (error) {
    return errorResponse(error);
  }

  try {
    if ([".jsx", ".ts", ".tsx"].includes(pathUtils.posix.extname(pathname))) {
      const config = await access.fs.promises.readFile("tsconfig.json", { encoding: "utf-8" })
        .then((raw) => parseTSConfig(raw as string)?.config?.compilerOptions)
        .catch(() => undefined);
      const raw = await access.fs.promises.readFile(pathname, { encoding: "utf-8" }) as string;
      const output = new Blob([transpileTS(pathname, raw, config)], { type: "application/javascript" });
      return serveBlob(output, request, "application/javascript");
    }
    const blob = await access.fs.openAsBlob(pathname);
    return serveBlob(blob, request, mime.getType(pathname) ?? "application/octet-stream");
  } catch (error) {
    const candidate = error as { name?: string; code?: string };
    if (candidate?.name === "NotAllowedError" || candidate?.code === "EACCES") invalidateProject(projectId);
    if (pathname === "index.html" && request.mode === "navigate") {
      return Response.redirect(`${context.projectUrl}?reason=missing-index`, 302);
    }
    return errorResponse(error);
  }
};
