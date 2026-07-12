import react from "@vitejs/plugin-react";
import path from "path";
import { configDefaults, defineConfig } from "vitest/config";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import motaServerPlugin from "./vite-plugin-mota-server";
import fs from "node:fs/promises";
import { editorArtifactPlugin } from "./editor-artifact-plugin";
import { MOTA_JS_ROOT } from "./mota-root";

const packageInfo = JSON.parse(await fs.readFile(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

// https://vite.dev/config/
export default defineConfig({
  appType: "mpa",
  base: "./",
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    nodePolyfills({
      include: ['events']
    }),
    motaServerPlugin({ motaRoot: MOTA_JS_ROOT }),
    editorArtifactPlugin(packageInfo.version),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@test": path.resolve(__dirname, "./test"),
      "@styled-system": path.resolve(__dirname, "./styled-system"),
    },
  },
  publicDir: MOTA_JS_ROOT,
  server: {
    port: 1055,
    host: "127.0.0.1",
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    rollupOptions: {
      input: {
        editor: path.resolve(__dirname, "index.html"),
        runtime: path.resolve(__dirname, "runtime.html"),
      },
    },
    copyPublicDir: false,
  },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: [...configDefaults.exclude, "e2e/**"],
    setupFiles: ["./test/setup.ts"],
  },
});
