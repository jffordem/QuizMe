import { el, type Screen } from "../app.ts";
import type { Session } from "../session.ts";

export interface DoneHooks {
  /** Clear this quiz's progress and start over. */
  studyAgain(): void;
  toList(): void;
}

const MISSED_SHOWN = 5;

export function doneScreen(session: Session, hooks: DoneHooks): Screen {
  return (ctx) => {
    ctx.root.append(el("h2", undefined, `All ${session.total} questions mastered.`));

    const missed = session.mostMissed(MISSED_SHOWN);
    if (missed.length > 0) {
      ctx.root.append(el("p", undefined, "Missed most often:"));
      const list = el("ol");
      for (const { question, missed: times } of missed) {
        const item = el("li");
        item.textContent = `${question.q} — ${question.answer} (missed ${times} ${times === 1 ? "time" : "times"})`;
        list.append(item);
      }
      ctx.root.append(list);
    }

    const again = el("button", undefined, "Study again");
    again.addEventListener("click", hooks.studyAgain);
    const back = el("button", "primary", "Back to list");
    back.addEventListener("click", hooks.toList);
    const actions = el("div", "actions");
    actions.append(again, back);
    ctx.root.append(actions);

    ctx.keys((e) => {
      if (e.key === "Escape") hooks.toList();
    });

    // Back is the safe default; "Study again" erases this quiz's progress.
    back.focus();
  };
}
