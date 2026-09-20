import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLibrary } from "../src/quiz.ts";

// Every quiz shipped in quizzes/ must be valid. (The build checks this too; this
// gives the same answer from `npm test`, with the failing file named.)
describe("shipped quizzes", () => {
  const files: Record<string, unknown> = {};
  for (const name of readdirSync("quizzes").filter((f) => f.endsWith(".json"))) {
    files[`quizzes/${name}`] = JSON.parse(readFileSync(`quizzes/${name}`, "utf-8"));
  }

  it("has at least one quiz", () => {
    expect(Object.keys(files).length).toBeGreaterThan(0);
  });

  it("all validate, with unique ids", () => {
    const { quizzes, errors } = parseLibrary(files);
    expect(errors).toEqual([]);
    expect(quizzes).toHaveLength(Object.keys(files).length);
  });

  it("file names match quiz ids", () => {
    for (const [path, data] of Object.entries(files)) {
      expect(path).toBe(`quizzes/${(data as { id: string }).id}.json`);
    }
  });
});
