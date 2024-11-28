import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { analyzer } from "vite-bundle-analyzer";
import { resolvePlugin } from "@motajs/config/resolvePlugin";

// https://vitejs.dev/config/
export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  appType: "mpa",
  plugins: [
    react(),
    svgr(),
    nodePolyfills({
      globals: {
        Buffer: true,
      },
    }),
    analyzer({
      analyzerMode: "static",
      openAnalyzer: false,
    }),
    [
      {
        name: "service-worker",
        load(id) {
          if (id === "/service-worker.js") {
            return `import ${JSON.stringify(path.resolve(import.meta.dirname, "src/server/index.ts"))}`;
          }
        },
      },
      resolvePlugin,
    ],
  ],
  css: {
    modules: {
      localsConvention: "camelCase",
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, "index.html"),
        serverWorker: path.resolve(import.meta.dirname, "src/server/index.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "serverWorker") {
            return "service-worker.js";
          }
          return "assets/[name]-[hash].js";
        },
      },
    },
  },
});
