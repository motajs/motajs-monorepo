import react from "@vitejs/plugin-react";
import path from "path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@test": path.resolve(import.meta.dirname, "test"),
      "@styled-system": path.resolve(import.meta.dirname, "styled-system"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: [...configDefaults.exclude, "e2e/**"],
    setupFiles: ["./test/setup.ts"],
  },
});
