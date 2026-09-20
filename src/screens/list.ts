import { el, type Screen } from "../app.ts";
import type { Library, Quiz } from "../quiz.ts";
import { masteredCount, progressIsStale } from "../session.ts";
import { loadProgress } from "../storage.ts";

export interface ListHooks {
  play(quiz: Quiz): void;
}

function status(quiz: Quiz): string {
  const stored = loadProgress(quiz.id);
  const base = `${masteredCount(quiz, stored)} of ${quiz.questions.length} mastered`;
  return progressIsStale(quiz, stored) ? `${base} (quiz was updated; starting fresh)` : base;
}

export function listScreen(library: Library, hooks: ListHooks): Screen {
  return (ctx) => {
    if (library.errors.length > 0) {
      ctx.root.append(el("p", undefined, "Some quizzes could not be loaded:"));
      ctx.root.append(el("pre", "errors", library.errors.join("\n")));
    }

    if (library.quizzes.length === 0) {
      ctx.root.append(el("p", undefined, "No quizzes yet."));
      return;
    }

    ctx.root.append(el("h2", undefined, "Quizzes"));
    const menu = el("div", "menu");
    library.quizzes.forEach((quiz, i) => {
      const button = el("button", "choice", `${i + 1}. ${quiz.title} — ${status(quiz)}`);
      button.addEventListener("click", () => hooks.play(quiz));
      menu.append(button);
    });
    ctx.root.append(menu);

    ctx.keys((e) => {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= library.quizzes.length) {
        hooks.play(library.quizzes[n - 1]);
      }
    });
  };
}
