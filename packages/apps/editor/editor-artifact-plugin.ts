import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

const blocklyMediaRoot = path.resolve(import.meta.dirname, "node_modules/blockly/media");
const editorThemeRoot = path.resolve(import.meta.dirname, "assets/theme");

const mediaMime = (name: string): string => {
  if (name.endsWith(".svg")) return "image/svg+xml";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".mp3")) return "audio/mpeg";
  if (name.endsWith(".ogg")) return "audio/ogg";
  if (name.endsWith(".wav")) return "audio/wav";
  if (name.endsWith(".cur")) return "image/x-icon";
  return "application/octet-stream";
};

export interface EditorArtifactManifest {
  schemaVersion: 2;
  environmentProtocolVersion: 1;
  runtimeProtocolVersion: 3;
  editorVersion: string;
  buildId: string;
  entrypoints: { editor: "index.html"; runtime: "runtime.html" };
  files: EditorArtifactFile[];
}

export interface EditorArtifactFile {
  path: string;
  size: number;
  sha256: string;
}

async function artifactFiles(root: string, relative = ""): Promise<string[]> {
  const entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const name = path.posix.join(relative, entry.name);
    return entry.isDirectory() ? artifactFiles(root, name) : [name];
  }));
  return files.flat().filter((name) => name !== "editor-manifest.json").sort();
}

export async function calculateEditorBuildId(root: string): Promise<string> {
  const hash = createHash("sha256");
  for (const name of await artifactFiles(root)) {
    hash.update(name).update("\0");
    hash.update(await fs.readFile(path.join(root, name))).update("\0");
  }
  return hash.digest("hex");
}

export async function createEditorArtifactFiles(root: string): Promise<EditorArtifactFile[]> {
  return await Promise.all((await artifactFiles(root)).map(async (name) => {
    const content = await fs.readFile(path.join(root, name));
    return {
      path: name,
      size: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
    };
  }));
}

export function editorArtifactPlugin(editorVersion: string): Plugin[] {
  let outDir = "dist";
  const devAssets: Plugin = {
    name: "mota-editor-dev-assets",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/assets/blockly-media/", async (request, response, next) => {
        const name = decodeURIComponent((request.url ?? "").split("?", 1)[0]!).replace(/^\/+/, "");
        if (!name || name.includes("..") || name.includes("\\")) return next();
        try {
          const content = await fs.readFile(path.join(blocklyMediaRoot, name));
          response.statusCode = 200;
          response.setHeader("content-type", mediaMime(name));
          response.end(content);
        } catch {
          next();
        }
      });
      server.middlewares.use("/assets/theme/", async (request, response, next) => {
        const name = decodeURIComponent((request.url ?? "").split("?", 1)[0]!).replace(/^\/+/, "");
        if (!name || name.includes("..") || name.includes("\\") || !name.endsWith(".css")) return next();
        try {
          response.statusCode = 200;
          response.setHeader("content-type", "text/css; charset=utf-8");
          response.end(await fs.readFile(path.join(editorThemeRoot, name)));
        } catch {
          next();
        }
      });
    },
  };
  const artifact: Plugin = {
    name: "mota-editor-artifact",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    async closeBundle() {
      await fs.cp(blocklyMediaRoot, path.join(outDir, "assets/blockly-media"), { recursive: true });
      await fs.cp(editorThemeRoot, path.join(outDir, "assets/theme"), { recursive: true });
      const files = await createEditorArtifactFiles(outDir);
      const manifest: EditorArtifactManifest = {
        schemaVersion: 2,
        environmentProtocolVersion: 1,
        runtimeProtocolVersion: 3,
        editorVersion,
        buildId: await calculateEditorBuildId(outDir),
        entrypoints: { editor: "index.html", runtime: "runtime.html" },
        files,
      };
      await fs.writeFile(path.join(outDir, "editor-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    },
  };
  return [devAssets, artifact];
}
