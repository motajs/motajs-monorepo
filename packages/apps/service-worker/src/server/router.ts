import fsScript from './fsClient.js?raw';

import { cacheFirst, networkFirst } from './cache';
import { handleFsRequest } from './fsApi';
import { serveProjectPreview } from './preview';
import { ResponseUtils } from './utils';
import { serveEditorUpdateStatus, serveProjectEditor } from './editorHost';
import { serveEditorReleaseAsset } from './editorRelease';

export type BackgroundTaskScheduler = (task: Promise<unknown>) => void;

export interface RequestRouteContext {
  clientId?: string;
}

const withSlash = (value: string) => (value.endsWith('/') ? value : `${value}/`);

const appShell = async (scopeUrl: URL): Promise<Response> => {
  const indexUrl = new URL('index.html', scopeUrl);
  const response = await networkFirst(new Request(indexUrl, { headers: { accept: 'text/html' } }));
  if (!response.ok) return response;
  const html = await response.text();
  const base = withSlash(scopeUrl.pathname);
  const output = /<base\s/i.test(html) ? html : html.replace(/<head([^>]*)>/i, `<head$1><base href="${base}">`);
  return new Response(output, {
    status: response.status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
  });
};

const decodeRoutePath = (value: string): string => {
  try {
    return value.split('/').map(decodeURIComponent).join('/');
  } catch {
    return value;
  }
};

const redirect = (url: URL, pathname: string, status = 308) => {
  const target = new URL(url);
  target.pathname = pathname;
  return Response.redirect(target, status);
};

const routeService = async (
  request: Request,
  url: URL,
  scopeUrl: URL,
  projectId: number,
  tail: string,
  schedule?: BackgroundTaskScheduler,
  context?: RequestRouteContext,
): Promise<Response> => {
  const serviceRoot = `${withSlash(scopeUrl.pathname)}service/${projectId}/`;
  const projectUrl = new URL(`${serviceRoot}project/`, url.origin).href;
  if (!tail) return redirect(url, `${serviceRoot}project/`);
  if (tail === 'project' || tail === 'project/') return appShell(scopeUrl);
  if (tail === 'editor') return redirect(url, `${serviceRoot}editor/`);
  if (tail === 'editor/') {
    return serveProjectEditor(request, scopeUrl, projectId, projectUrl, schedule, context?.clientId);
  }
  if (tail === 'api/editor-update' || tail === 'api/editor-update/') {
    return serveEditorUpdateStatus(request, scopeUrl, schedule);
  }

  const apiMatch = /^api\/fs\/([^/]+)\/?$/.exec(tail);
  if (apiMatch) return handleFsRequest(projectId, apiMatch[1]!, request);

  const compatibilityFs = /^preview\/fs\/([^/]+)\/?$/.exec(tail);
  if (compatibilityFs) return handleFsRequest(projectId, compatibilityFs[1]!, request);
  if (tail === 'preview/_server/fs.js') {
    return ResponseUtils.text(fsScript, {
      headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  if (tail === 'preview') return redirect(url, `${serviceRoot}preview/`);
  if (tail === 'preview/' || tail.startsWith('preview/')) {
    const rawPath = tail === 'preview/' ? '' : tail.slice('preview/'.length);
    return serveProjectPreview({
      projectId,
      projectPath: decodeRoutePath(rawPath),
      request,
      projectUrl,
      rootUrl: scopeUrl.href,
    });
  }
  return ResponseUtils.create404();
};

const routeLegacyTower = async (
  request: Request,
  url: URL,
  scopeUrl: URL,
  projectId: number,
  tail: string,
): Promise<Response> => {
  const fsMatch = /^fs\/([^/]+)\/?$/.exec(tail);
  if (fsMatch && request.method === 'POST') return handleFsRequest(projectId, fsMatch[1]!, request);
  if (tail === '_server/fs.js') {
    return ResponseUtils.text(fsScript, {
      headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return ResponseUtils.error(405, 'method-not-allowed', 'Legacy tower redirects support GET and HEAD only');
  }
  const previewRoot = `${withSlash(scopeUrl.pathname)}service/${projectId}/preview/`;
  return redirect(url, `${previewRoot}${tail}`);
};

export const routeRequest = async (
  request: Request,
  scopeUrl: URL,
  schedule?: BackgroundTaskScheduler,
  context?: RequestRouteContext,
): Promise<Response | null> => {
  const url = new URL(request.url);
  if (url.origin !== scopeUrl.origin) return null;
  const scopePath = withSlash(scopeUrl.pathname);
  if (!url.pathname.startsWith(scopePath)) return null;
  const pathname = url.pathname.slice(scopePath.length);

  const service = /^service\/(\d+)(?:\/(.*))?$/.exec(pathname);
  if (service) {
    return routeService(request, url, scopeUrl, Number(service[1]), service[2] ?? '', schedule, context);
  }

  const tower = /^tower\/(\d+)(?:\/(.*))?$/.exec(pathname);
  if (tower) return routeLegacyTower(request, url, scopeUrl, Number(tower[1]), tower[2] ?? '');

  if (pathname.startsWith('api/')) return ResponseUtils.create404();
  if (/^static\/editor\/releases\/[a-f0-9]{64}\//.test(pathname)) {
    return serveEditorReleaseAsset(request, scopeUrl);
  }
  if (pathname.startsWith('static/editor/')) return fetch(request, { cache: 'no-store' });
  if (import.meta.env.DEV) return fetch(request);
  if (!pathname || pathname === 'index.html' || pathname.endsWith('/')) return networkFirst(request);
  if (pathname.startsWith('assets/') && /\.(js|css)$/.test(pathname)) return cacheFirst(request);
  if (/\.(js|css)$/.test(pathname)) return networkFirst(request);
  return fetch(request);
};
