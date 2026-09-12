import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  resolve: {
    alias: {
      vue: fileURLToPath(new URL("../../node_modules/vue/dist/vue.esm-bundler.js", import.meta.url)),
    },
  },
  server: { host: "127.0.0.1", port: 13102 },
  build: { outDir: "dist", emptyOutDir: true },
});
