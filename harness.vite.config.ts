// DEBUG HARNESS build config — not part of the plugin build.
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    outDir: "dist-harness",
    rollupOptions: { input: "harness.html" },
  },
});
