import { el, type Screen } from "../app.ts";
import type { Library, Quiz } from "../quiz.ts";
import { hasProgress, masteredCount, progressIsStale, type QuizProgress } from "../session.ts";
import { loadProgress } from "../storage.ts";

export interface ListHooks {
  play(quiz: Quiz): void;
  /** Ask to erase this quiz's progress (the flow shows a confirmation first). */
  reset(quiz: Quiz): void;
}

function status(quiz: Quiz, stored: QuizProgress | null): string {
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
      const stored = loadProgress(quiz.id);
      const row = el("div", "row");

      const open = el("button", "choice", `${i + 1}. ${quiz.title} — ${status(quiz, stored)}`);
      open.addEventListener("click", () => hooks.play(quiz));
      row.append(open);

      // Only quizzes with something to erase get a Reset link.
      if (hasProgress(quiz, stored)) {
        const reset = el("button", "link-btn reset", "Reset");
        reset.title = `Reset progress for ${quiz.title}`;
        reset.setAttribute("aria-label", `Reset progress for ${quiz.title}`);
        reset.addEventListener("click", () => hooks.reset(quiz));
        row.append(reset);
      }
      menu.append(row);
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
