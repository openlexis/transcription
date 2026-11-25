import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  outDir: "./www",
  build: { format: "directory", inlineStylesheets: "auto" },
  compressHTML: true,
  devToolbar: { enabled: false },
  vite: { server: { fs: { allow: [".."] } } },
});
