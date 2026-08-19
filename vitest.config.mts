import { defineConfig } from "vitest/config";
import path from "node:path";

const rootDir = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  resolve: {
    alias: {
      "@workspace/api-zod": path.resolve(rootDir, "lib/api-zod/src/index.ts"),
      "@": path.resolve(rootDir, "artifacts/claims-checker/src"),
    },
  },
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "artifacts/api-server/**/*.test.ts",
      "artifacts/claims-checker/src/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: [
        "lib/api-zod/src/**/*.ts",
        "artifacts/api-server/src/**/*.ts",
        "artifacts/claims-checker/src/lib/**/*.ts",
        "artifacts/claims-checker/src/hooks/**/*.ts",
      ],
      exclude: ["**/generated/**", "**/*.test.ts"],
    },
  },
});
