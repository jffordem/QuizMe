// Wires the screens together. Kept out of main.ts so tests can start the app on
// any root element.
import { createApp } from "./app.ts";
import type { Library, Quiz } from "./quiz.ts";
import { doneScreen } from "./screens/done.ts";
import { listScreen } from "./screens/list.ts";
import { questionScreen } from "./screens/question.ts";
import { acceptTermsScreen, readTermsScreen, termsAccepted } from "./screens/terms.ts";
import { Session } from "./session.ts";
import { clearProgress, loadProgress, saveProgress } from "./storage.ts";

export function startApp(
  root: HTMLElement,
  termsLink: HTMLElement | null,
  library: Library,
): { dispose(): void } {
  const { ctx, current, dispose } = createApp(root);

  const list = () => listScreen(library, { play });
  const showList = () => ctx.show(list());

  function play(quiz: Quiz): void {
    const session = new Session(quiz, loadProgress(quiz.id));
    session.next();
    showQuestion(session);
  }

  function showQuestion(session: Session): void {
    if (!session.current) {
      ctx.show(
        doneScreen(session, {
          studyAgain: () => {
            clearProgress(session.quiz.id);
            play(session.quiz);
          },
          toList: showList,
        }),
      );
      return;
    }
    ctx.show(
      questionScreen(session, {
        answered: () => saveProgress(session.quiz.id, session.toProgress()),
        advance: () => {
          session.next();
          showQuestion(session);
        },
        toList: showList,
      }),
    );
  }

  // Footer link reopens the terms, then returns to whatever screen was showing.
  termsLink?.addEventListener("click", () => {
    const back = current();
    if (back) ctx.show(readTermsScreen(back));
  });

  ctx.show(termsAccepted() ? list() : acceptTermsScreen(list()));

  return { dispose };
}
