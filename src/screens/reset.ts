import { el, type Screen } from "../app.ts";
import type { Quiz } from "../quiz.ts";
import { masteredCount } from "../session.ts";
import { loadProgress } from "../storage.ts";

export interface ResetHooks {
  /** Erase this quiz's progress. */
  confirm(): void;
  cancel(): void;
}

/** Confirmation before erasing a quiz's progress. Cancel is the default action. */
export function resetScreen(quiz: Quiz, hooks: ResetHooks): Screen {
  return (ctx) => {
    const mastered = masteredCount(quiz, loadProgress(quiz.id));
    ctx.root.append(
      el("h2", undefined, "Reset progress?"),
      el(
        "p",
        undefined,
        `This erases your progress on ${quiz.title} (${mastered} of ${quiz.questions.length} mastered) ` +
          "so you can start it over. It cannot be undone.",
      ),
    );

    const reset = el("button", undefined, "Reset progress");
    reset.addEventListener("click", hooks.confirm);
    const cancel = el("button", "primary", "Cancel");
    cancel.addEventListener("click", hooks.cancel);
    const actions = el("div", "actions");
    actions.append(reset, cancel);
    ctx.root.append(actions);

    ctx.keys((e) => {
      if (e.key === "Escape") hooks.cancel();
    });

    // Cancel is focused so a stray Enter can't erase anything.
    cancel.focus();
  };
}
