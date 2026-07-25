const baseUrl = new URL(document.baseURI);
const basePath = baseUrl.pathname.endsWith("/") ? baseUrl.pathname : `${baseUrl.pathname}/`;

export const appUrl = (path = "") => new URL(path, baseUrl).href;
export const serviceWorkerUrl = () => appUrl("service-worker.js");
export const serviceWorkerScope = () => basePath;
export const projectUrl = (id: number) => appUrl(`service/${id}/project/`);
export const previewUrl = (id: number) => appUrl(`service/${id}/preview/`);
export const editorUrl = (id: number) => appUrl(`service/${id}/editor/`);
export const editorUpdateUrl = (id: number) => appUrl(`service/${id}/api/editor-update/`);

export type ViewRoute = { kind: "home" } | { kind: "project"; id: number };

export const currentViewRoute = (): ViewRoute => {
  const path = window.location.pathname.startsWith(basePath)
    ? window.location.pathname.slice(basePath.length)
    : "";
  const match = /^service\/(\d+)\/project\/?$/.exec(path);
  return match ? { kind: "project", id: Number(match[1]) } : { kind: "home" };
};
