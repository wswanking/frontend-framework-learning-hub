import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  server: { host: "127.0.0.1", port: 13103 },
  build: { outDir: "dist", emptyOutDir: true },
});
