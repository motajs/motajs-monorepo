import pathUtils from "path";
import { match } from "ts-pattern";
import UniversalRouter, { Route, RouteContext, RouteParams, RouteResult, RouterContext } from "universal-router";
import { ResponseUtils } from "./utils";
import mime from "mime";
import fsScript from "./fsClient.js?raw";
import { zip } from "es-toolkit";
import { cacheFirst, networkFirst } from "./cache";
import { accessProjectById, forgetProject, listProject, registerProject } from "./project";
import { defineRoute, MessageServer } from "@motajs/utils/advance/message";
import { ForgetProjectMessage, ListProjectMessage, RegisterProjectMessage } from "@/idl";
import { parseTSConfig, transpileTS } from "./transpiler";

const sw = self as unknown as ServiceWorkerGlobalScope;

const BASE = pathUtils.dirname(sw.location.pathname);

sw.addEventListener("install", async () => {
  await sw.skipWaiting();
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

const messageServer = new MessageServer([
  defineRoute(RegisterProjectMessage, async ({ handle }) => {
    const projectId = await registerProject(handle);
    return {
      id: projectId,
    };
  }),
  defineRoute(ForgetProjectMessage, async ({ id }) => {
    forgetProject(id);
  }),
  defineRoute(ListProjectMessage, async () => {
    const list = await listProject();
    return {
      list,
    };
  }),
]);

sw.addEventListener("message", async (event) => {
  if (event.origin !== sw.origin || !event.source) return;
  const response = await messageServer.serve(event.data);
  event.source.postMessage(response);
});

interface SWRouterContext extends RouterContext {
  url: URL;
  event: FetchEvent;
  request: Request;
  query: URLSearchParams;
}

const handler = (action: (context: RouteContext<Response, SWRouterContext> & SWRouterContext, params: RouteParams) => RouteResult<Response>) => action as NonNullable<Route<Response, SWRouterContext>["action"]>;

const fixPathName = (pathname: string) => {
  if (pathname === "") pathname = "/";
  if (pathname.endsWith("/")) return pathname + "index.html";
  return pathname;
};

const router = new UniversalRouter<Response, SWRouterContext>([
  {
    path: "/api",
    children: [
      {
        path: "/*path",
        action: handler(() => ResponseUtils.create404()),
      },
    ],
  },
  {
    path: "/tower/:id",
    children: [
      {
        path: "/_server/fs.js",
        action: handler(() => ResponseUtils.text(fsScript, { headers: [["content-type", "application/javascript"]] })),
      },
      {
        path: "/fs/:op",
        action: handler(async (context) => {
          const { request, params } = context;
          const { id, op } = params;
          const project = await accessProjectById(Number(id));
          if (!project) return ResponseUtils.create404();
          const fs = project[0];
          const rawArgs = await request.text();
          const args = Object.fromEntries(rawArgs.split("&").map((rawArg) => {
            const [key] = rawArg.split("=", 1);
            const value = rawArg.slice(key.length + 1);
            return [key, value];
          }).filter(([k]) => k !== void 0) as [string, string][]);
          const p = (name: string, defaultValue?: string) => {
            const param = args[name] ?? defaultValue;
            if (param === null) throw `missing param ${name}`;
            return param;
          };
          try {
            return await match(op)
              .with("readFile", async () => {
                const path = p("name"), encoding = p("type") as BufferEncoding;
                const file = await fs.promises.readFile(path, { encoding }).catch(() => "");
                return new Response(file as string);
              })
              .with("writeFile", async () => {
                const path = p("name"), data = p("value"), encoding = p("type") as BufferEncoding;
                await fs.promises.writeFile(path, data, { encoding });
                return Response.json(data.length);
              })
              .with("writeMultiFiles", async () => {
                const paths = p("name").split(";"), datas = p("value").split(";");
                if (paths.length !== datas.length) return ResponseUtils.create500("name value not match");
                await Promise.all(zip(paths, datas).map(async ([path, data]) => {
                  await fs.promises.writeFile(path!, data!, { encoding: "base64" });
                }));
                return Response.json(paths.length);
              })
              .with("listFile", async () => {
                const path = p("name");
                const list = await fs.promises.readdir(path) as string[];
                return Response.json(list);
              })
              .with("makeDir", async () => {
                const path = p("name");
                const ret = await fs.promises.mkdir(path);
                return ResponseUtils.text(ret ?? "");
              })
              .with("moveFile", async () => {
                const src = p("src"), dest = p("dest");
                await fs.promises.rename(src, dest);
                return Response.json(true);
              })
              .with("deleteFile", async () => {
                const path = p("name");
                await fs.promises.unlink(path);
                return Response.json(true);
              })
              .otherwise(() => ResponseUtils.create404());
          } catch (e) {
            if (typeof e === "string") {
              return ResponseUtils.create500(e);
            }
            return ResponseUtils.create500(String(e));
          }
        }),
      },
      {
        path: "/*path",
        action: handler(async (context) => {
          const id = Number(context.params.id);
          const pathname = fixPathName((context.params.path as string[]).join("/"));
          const project = await accessProjectById(id);
          if (!project) return Response.redirect(BASE);
          const [fs] = project;
          if ([".jsx", ".ts", ".tsx"].includes(pathUtils.extname(pathname))) {
            const config = await fs.promises.readFile("tsconfig.json", { encoding: "utf-8" })
              .then((rawConfig) => parseTSConfig(rawConfig as string)?.config?.compilerOptions)
              .catch(() => void 0);
            return fs.promises.readFile(pathname, { encoding: "utf-8" })
              .then((rawFile) => {
                const result = transpileTS(pathname, rawFile as string, config);
                return ResponseUtils.text(result, {
                  headers: [
                    ["content-type", "application/javascript"],
                  ],
                });
              })
              .catch(() => ResponseUtils.create404());
          }
          return fs.openAsBlob(pathname)
            .then((e) => {
              return ResponseUtils.blob(e, {
                headers: [
                  ["content-type", mime.getType(pathUtils.extname(pathname)) ?? ""],
                ],
              });
            })
            .catch(() => ResponseUtils.create404());
        }),
      },
    ],
  },
  {
    path: "*path",
    action: handler((context) => {
      const { pathname, request } = context;
      if (import.meta.env.DEV) return fetch(request);
      if (pathname.endsWith("/")) {
        return networkFirst(request);
      }
      return match(pathUtils.basename(pathname))
        .when((e) => /-\w{8}\.(js|css)$/.test(e), () => {
          return cacheFirst(request);
        })
        .when((e) => /\.(js|css)/.test(e), () => {
          return networkFirst(request);
        })
        .otherwise(() => fetch(request));
    }),
  },
], {
  errorHandler: (e) => {
    if (e.message === "Route not found") {
      return ResponseUtils.create404();
    }
    return new Response(`500 Interal server error: ${e.message}`, {
      status: 500,
      statusText: "Interal server error",
    });
  },
});

sw.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.host !== location.host) return;
  const pathname = pathUtils.relative(BASE, url.pathname);
  if (pathname.startsWith("..")) return;
  const response = (async () => {
    const result = await router.resolve({
      pathname: "/" + pathname,
      url,
      event,
      request: event.request,
      query: new URLSearchParams(url.search),
    });
    if (result) return result;
    return fetch(event.request);
  })();
  event.respondWith(response);
});
