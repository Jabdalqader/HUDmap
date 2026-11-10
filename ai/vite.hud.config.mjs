// Builds the HUD bridge into ../web/ai/voice.js (one self-contained ES module for the browser).
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: { entry: "src/hudBridge.ts", formats: ["es"], fileName: () => "voice.js" },
    outDir: "../web/ai",
    emptyOutDir: false,
    target: "es2020",
    minify: true,
  },
});
