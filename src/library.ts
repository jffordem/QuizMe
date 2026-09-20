import { parseLibrary, type Library } from "./quiz.ts";

// Every quiz file is bundled into the build. The build has already validated
// them (see vite.config.ts); parsing again here gives typed data, and would
// surface a problem in the dev server, which doesn't run the build check.
const files = import.meta.glob("../quizzes/*.json", { eager: true, import: "default" });

export function loadLibrary(): Library {
  const library = parseLibrary(files);
  library.quizzes.sort((a, b) => a.title.localeCompare(b.title));
  return library;
}
