import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/lib/**/*.ts", "src/app/api/**/route.ts"],
      exclude: ["src/lib/examples.ts", "src/lib/utils.ts"],
      thresholds: {
        lines: 80,
        functions: 90,
        statements: 80,
        branches: 68,
      },
    },
  },
});
