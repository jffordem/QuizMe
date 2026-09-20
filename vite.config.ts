import { readdirSync, readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { parseLibrary } from "./src/quiz.ts";

/** Fails the production build if any quiz file is invalid, so it never deploys. */
function validateQuizzes(): Plugin {
  return {
    name: "validate-quizzes",
    apply: "build",
    buildStart() {
      const files: Record<string, unknown> = {};
      const errors: string[] = [];
      for (const name of readdirSync("quizzes").filter((f) => f.endsWith(".json"))) {
        const path = `quizzes/${name}`;
        try {
          files[path] = JSON.parse(readFileSync(path, "utf-8"));
        } catch (e) {
          errors.push(`${path}: not valid JSON (${(e as Error).message})`);
        }
      }
      errors.push(...parseLibrary(files).errors);
      if (errors.length > 0) this.error(`Quiz validation failed:\n${errors.join("\n")}`);
    },
  };
}

// Relative base so the built assets load correctly from the GitHub Pages
// sub-path (https://<user>.github.io/QuizMe/).
export default defineConfig({
  base: "./",
  plugins: [validateQuizzes()],
  server: {
    host: true,
    port: 4081,
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
