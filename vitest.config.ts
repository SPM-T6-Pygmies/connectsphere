import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // The core is pure, so it needs no DOM and no framework runtime.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
