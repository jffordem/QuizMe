// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startApp } from "../src/flow.ts";
import type { Quiz } from "../src/quiz.ts";
import { REQUIRED_STREAK } from "../src/session.ts";
import { TERMS_VERSION } from "../src/screens/terms.ts";

const quiz: Quiz = {
  id: "capitals",
  title: "Capitals",
  version: 1,
  questions: [
    { q: "Capital of France?", answer: "Paris", distractors: ["Lyon", "Nice", "Lille"] },
    { q: "Capital of Italy?", answer: "Rome", distractors: ["Milan", "Turin", "Naples"] },
    { q: "Capital of Spain?", answer: "Madrid", distractors: ["Seville", "Valencia", "Bilbao"] },
  ],
};
const library = { quizzes: [quiz], errors: [] };

let root: HTMLElement;
let termsLink: HTMLElement;
let dispose: () => void;

const buttons = () => [...root.querySelectorAll("button")];
const buttonWith = (text: string) => {
  const found = buttons().find((b) => b.textContent?.includes(text));
  if (!found) throw new Error(`no button containing "${text}"; have: ${buttons().map((b) => b.textContent).join(" | ")}`);
  return found;
};
const key = (k: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k }));
const text = () => root.textContent ?? "";
const currentQuestion = () => {
  const shown = root.querySelector(".question")?.textContent;
  const found = quiz.questions.find((q) => q.q === shown);
  if (!found) throw new Error(`no question on screen: ${text()}`);
  return found;
};
const answerRight = () => buttonWith(`. ${currentQuestion().answer}`).click();
const answerWrong = () => {
  const q = currentQuestion();
  buttons().find((b) => b.classList.contains("choice") && !b.textContent?.includes(`. ${q.answer}`))!.click();
};
const start = () => {
  ({ dispose } = startApp(root, termsLink, library));
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  document.body.innerHTML = '<main id="screen"></main><button id="terms-link">Terms</button>';
  root = document.getElementById("screen")!;
  termsLink = document.getElementById("terms-link")!;
});

afterEach(() => {
  dispose?.();
  vi.useRealTimers();
});

describe("terms", () => {
  it("is shown first, blocks the quiz list, and is remembered once accepted", () => {
    start();
    expect(text()).toContain("Entertainment only");
    expect(text()).not.toContain("Capitals");

    buttonWith("I understand").click();
    expect(text()).toContain("Capitals");
    expect(localStorage.getItem("quizme.termsAccepted")).toBe(TERMS_VERSION);

    dispose();
    start();
    expect(text()).toContain("Capitals");
    expect(text()).not.toContain("Entertainment only");
  });

  it("asks again when the terms version changes", () => {
    localStorage.setItem("quizme.termsAccepted", "older-version");
    start();
    expect(text()).toContain("Entertainment only");
  });

  it("accepts with Enter", () => {
    start();
    key("Enter");
    expect(text()).toContain("Capitals");
  });

  it("can be re-read from the footer and closes back to the same screen", () => {
    localStorage.setItem("quizme.termsAccepted", TERMS_VERSION);
    start();
    termsLink.click();
    expect(text()).toContain("Entertainment only");
    buttonWith("Close").click();
    expect(text()).toContain("Capitals");
    expect(text()).not.toContain("Entertainment only");
  });

  it("still shows the terms (every visit) if storage is unavailable", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    start();
    expect(text()).toContain("Entertainment only");
    spy.mockRestore();
  });
});

describe("playing a quiz", () => {
  beforeEach(() => {
    localStorage.setItem("quizme.termsAccepted", TERMS_VERSION);
    start();
    buttonWith("Capitals").click();
  });

  it("shows the question, choices, mastered count and streak", () => {
    const q = currentQuestion();
    expect(text()).toContain("Mastered 0/3");
    expect(text()).toContain(`Streak on this question: 0/${REQUIRED_STREAK}`);
    expect(buttons().filter((b) => b.classList.contains("choice"))).toHaveLength(4);
    expect(text()).toContain(`. ${q.answer}`);
  });

  it("answers with number keys, then moves on by itself after a correct answer", () => {
    const first = currentQuestion();
    const choiceButtons = buttons().filter((b) => b.classList.contains("choice"));
    const index = choiceButtons.findIndex((b) => b.textContent?.includes(`. ${first.answer}`));
    key(String(index + 1));
    expect(text()).toContain("Correct.");
    expect(text()).toContain("(correct)");
    expect(text()).toContain(`Streak on this question: 1/${REQUIRED_STREAK}`);

    vi.advanceTimersByTime(1000);
    expect(text()).not.toContain("Correct.");
    expect(currentQuestion()).not.toBe(first);
  });

  it("waits for Continue after a wrong answer and shows the right one", () => {
    const first = currentQuestion();
    answerWrong();
    expect(text()).toContain(`Incorrect. The answer is: ${first.answer}`);
    expect(text()).toContain("(your answer)");

    vi.advanceTimersByTime(5000);
    expect(text()).toContain("Incorrect."); // no auto-advance

    buttonWith("Continue").click();
    expect(text()).not.toContain("Incorrect.");
    expect(currentQuestion()).not.toBe(first);
  });

  it("advances on Enter or Space from the keyboard after a wrong answer", () => {
    answerWrong();
    // The Continue button is focused in a real browser and handles Enter itself,
    // so the window-level handler must not also advance (that would skip a question).
    key("Enter");
    expect(text()).not.toContain("Incorrect.");
  });

  it("ignores number keys once answered", () => {
    answerWrong();
    key("1");
    expect(text()).toContain("Incorrect.");
  });

  it("keeps state across a visit to the terms page", () => {
    const q = currentQuestion();
    answerWrong();
    termsLink.click();
    expect(text()).toContain("Entertainment only");
    buttonWith("Close").click();
    expect(currentQuestion()).toBe(q);
    expect(text()).toContain(`Incorrect. The answer is: ${q.answer}`);
  });

  it("does not let a pending auto-advance fire on another screen", () => {
    answerRight();
    termsLink.click();
    vi.advanceTimersByTime(2000);
    expect(text()).toContain("Entertainment only");
  });

  it("saves progress after every answer", () => {
    answerRight();
    const saved = JSON.parse(localStorage.getItem("quizme.progress.capitals")!);
    expect(saved.version).toBe(1);
    expect(Object.values(saved.questions as Record<string, { streak: number }>).filter((p) => p.streak === 1)).toHaveLength(1);
  });

  it("goes back to the list with Escape", () => {
    key("Escape");
    expect(text()).toContain("Quizzes");
  });

  it("has a Back button that returns to the list", () => {
    buttonWith("Back to quizzes").click();
    expect(text()).toContain("Quizzes");
    expect(root.querySelector(".question")).toBeNull();
  });

  it("Back works after answering, keeps progress, and cancels the pending auto-advance", () => {
    answerRight();
    buttonWith("Back to quizzes").click();
    vi.advanceTimersByTime(2000);
    expect(text()).toContain("Quizzes");
    expect(root.querySelector(".question")).toBeNull();
    expect(JSON.parse(localStorage.getItem("quizme.progress.capitals")!).version).toBe(1);
  });

  it("Back works from the wrong-answer feedback state", () => {
    answerWrong();
    buttonWith("Back to quizzes").click();
    expect(text()).toContain("Quizzes");
  });

  it("resuming a quiz after Back keeps its saved streaks", () => {
    answerRight();
    buttonWith("Back to quizzes").click();
    buttonWith("Capitals").click();
    // One question now has streak 1/2 saved; it is one of the three still to master.
    const saved = JSON.parse(localStorage.getItem("quizme.progress.capitals")!);
    expect(Object.values(saved.questions as Record<string, { streak: number }>).some((p) => p.streak === 1)).toBe(true);
    expect(text()).toContain("Mastered 0/3");
  });

  it("finishes the quiz, reports what was missed, and can start over", () => {
    answerWrong(); // one miss to report
    buttonWith("Continue").click();

    let guard = 0;
    while (root.querySelector(".question")) {
      answerRight();
      vi.advanceTimersByTime(1000);
      if (++guard > 20) throw new Error("quiz did not finish");
    }
    expect(text()).toContain("All 3 questions mastered.");
    expect(text()).toContain("Missed most often:");
    expect(text()).toContain("missed 1 time)");

    // The finished quiz shows as fully mastered on the list, and reopens on the done screen.
    buttonWith("Back to list").click();
    expect(text()).toContain("3 of 3 mastered");
    buttonWith("Capitals").click();
    expect(text()).toContain("All 3 questions mastered.");

    buttonWith("Study again").click();
    expect(localStorage.getItem("quizme.progress.capitals")).toBeNull();
    expect(text()).toContain("Mastered 0/3");
  });
});

describe("resetting a quiz", () => {
  const PROGRESS_KEY = "quizme.progress.capitals";
  const seedProgress = () => {
    // Play one wrong answer so there is something to erase, then go back to the list.
    buttonWith("Capitals").click();
    answerWrong();
    buttonWith("Back to quizzes").click();
  };

  beforeEach(() => {
    localStorage.setItem("quizme.termsAccepted", TERMS_VERSION);
    start();
  });

  it("offers no Reset for a quiz with no progress", () => {
    expect(buttons().some((b) => b.textContent === "Reset")).toBe(false);
  });

  it("offers Reset once there is progress", () => {
    seedProgress();
    expect(buttons().some((b) => b.textContent === "Reset")).toBe(true);
  });

  it("asks for confirmation and shows what will be erased", () => {
    seedProgress();
    buttonWith("Reset").click();
    expect(text()).toContain("Reset progress?");
    expect(text()).toContain("Capitals (0 of 3 mastered)");
    expect(localStorage.getItem(PROGRESS_KEY)).not.toBeNull(); // nothing erased yet
  });

  it("Cancel keeps the progress", () => {
    seedProgress();
    buttonWith("Reset").click();
    buttonWith("Cancel").click();
    expect(text()).toContain("Quizzes");
    expect(localStorage.getItem(PROGRESS_KEY)).not.toBeNull();
    expect(buttons().some((b) => b.textContent === "Reset")).toBe(true);
  });

  it("Escape cancels", () => {
    seedProgress();
    buttonWith("Reset").click();
    key("Escape");
    expect(text()).toContain("Quizzes");
    expect(localStorage.getItem(PROGRESS_KEY)).not.toBeNull();
  });

  it("Enter does not erase anything (Cancel has the focus)", () => {
    seedProgress();
    buttonWith("Reset").click();
    key("Enter");
    expect(localStorage.getItem(PROGRESS_KEY)).not.toBeNull();
  });

  it("confirming erases the progress and returns to a fresh list", () => {
    seedProgress();
    buttonWith("Reset").click();
    buttonWith("Reset progress").click();
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
    expect(text()).toContain("Quizzes");
    expect(text()).toContain("0 of 3 mastered");
    expect(buttons().some((b) => b.textContent === "Reset")).toBe(false);
  });

  it("resets a fully mastered quiz so it can be played again from the start", () => {
    buttonWith("Capitals").click();
    let guard = 0;
    while (root.querySelector(".question")) {
      answerRight();
      vi.advanceTimersByTime(1000);
      if (++guard > 20) throw new Error("quiz did not finish");
    }
    buttonWith("Back to list").click();
    expect(text()).toContain("3 of 3 mastered");

    buttonWith("Reset").click();
    buttonWith("Reset progress").click();
    expect(text()).toContain("0 of 3 mastered");

    buttonWith("Capitals").click();
    expect(root.querySelector(".question")).not.toBeNull();
    expect(text()).toContain("Mastered 0/3");
  });
});

describe("quiz list", () => {
  beforeEach(() => localStorage.setItem("quizme.termsAccepted", TERMS_VERSION));

  it("starts a quiz with its number key", () => {
    start();
    key("1");
    expect(root.querySelector(".question")).not.toBeNull();
  });

  it("says when a quiz was updated and progress restarted", () => {
    localStorage.setItem("quizme.progress.capitals", JSON.stringify({ version: 0, questions: {} }));
    start();
    expect(text()).toContain("0 of 3 mastered (quiz was updated; starting fresh)");
  });

  it("shows load errors and works with no quizzes", () => {
    ({ dispose } = startApp(root, termsLink, { quizzes: [], errors: ["bad.json: nope"] }));
    expect(text()).toContain("bad.json: nope");
    expect(text()).toContain("No quizzes yet.");
  });
});
