import { defineConfig } from "vitest/config";

// Relative base so the built assets load correctly from the GitHub Pages
// sub-path (https://<user>.github.io/QuizMe/).
export default defineConfig({
  base: "./",
  server: {
    host: true,
    port: 4081,
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
