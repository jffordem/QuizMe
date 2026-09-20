import { el, type Screen } from "../app.ts";
import { REQUIRED_STREAK, type Session } from "../session.ts";

export interface QuestionHooks {
  /** Called after an answer; saves progress. */
  answered(): void;
  /** Move on to the next question (or the done screen). */
  advance(): void;
  toList(): void;
}

/** How long a correct answer stays on screen before moving on by itself. */
const AUTO_ADVANCE_MS = 900;

/**
 * Renders the session's current state: unanswered, or answered with feedback.
 * Everything shown is derived from the session, so re-rendering is always safe
 * (answering, or coming back from the terms page).
 */
export function questionScreen(session: Session, hooks: QuestionHooks): Screen {
  return (ctx) => {
    const question = session.current;
    if (!question) return;
    const result = session.last;

    const status = el("div", "status");
    status.append(
      el("span", undefined, session.quiz.title),
      el("span", undefined, `Mastered ${session.mastered}/${session.total}`),
    );

    const choices = el("div", "menu");
    session.choices.forEach((choice, i) => {
      let label = `${i + 1}. ${choice}`;
      if (result && choice === result.correctAnswer) label += " (correct)";
      else if (result && choice === result.chosen) label += " (your answer)";
      const button = el("button", result && choice === result.correctAnswer ? "choice correct" : "choice", label);
      if (result) {
        button.disabled = true;
      } else {
        button.addEventListener("click", () => answer(choice));
      }
      choices.append(button);
    });

    const streak = el(
      "p",
      "streak",
      `Streak on this question: ${session.streak}/${REQUIRED_STREAK}`,
    );

    const feedback = el("p", "feedback");
    feedback.setAttribute("role", "status");
    let continueButton: HTMLButtonElement | null = null;
    if (result) {
      if (result.correct) {
        feedback.textContent = result.retired ? "Correct. Mastered." : "Correct.";
      } else {
        feedback.textContent = `Incorrect. The answer is: ${result.correctAnswer}`;
      }
    }

    ctx.root.append(status, el("p", "question", question.q), choices, streak, feedback);

    if (result && !result.correct) {
      continueButton = el("button", "primary", "Continue");
      continueButton.addEventListener("click", hooks.advance);
      ctx.root.append(continueButton);
      continueButton.focus();
    } else if (result) {
      ctx.later(hooks.advance, AUTO_ADVANCE_MS);
    }

    function answer(choice: string): void {
      session.answer(choice);
      hooks.answered();
      ctx.show(questionScreen(session, hooks));
    }

    ctx.keys((e) => {
      if (e.key === "Escape") {
        hooks.toList();
        return;
      }
      if (!result) {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= session.choices.length) answer(session.choices[n - 1]);
        return;
      }
      // A focused button handles Enter/Space itself through its click event.
      if ((e.key === "Enter" || e.key === " ") && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        hooks.advance();
      }
    });
  };
}
