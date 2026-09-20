import { describe, expect, it } from "vitest";
import { masteredCount, progressIsStale, REQUIRED_STREAK, Session } from "../src/session.ts";
import { makeQuiz, seeded } from "./helpers.ts";

/** Answer the current question correctly or incorrectly. */
function answer(session: Session, correct: boolean) {
  const q = session.current!;
  return session.answer(correct ? q.answer : session.choices.find((c) => c !== q.answer)!);
}

describe("Session mastery rule", () => {
  it("retires a question after two correct answers in a row", () => {
    const session = new Session(makeQuiz(), null, seeded(1));
    const first = session.next()!;
    expect(REQUIRED_STREAK).toBe(2);

    expect(answer(session, true)).toMatchObject({ correct: true, retired: false });
    expect(session.streak).toBe(1);

    // Keep drawing until the same question comes back, answering the others correctly.
    let guard = 0;
    while (session.current !== first || session.last) {
      session.next();
      if (session.current !== first) answer(session, true);
      if (++guard > 50) throw new Error("question never came back");
    }
    expect(answer(session, true)).toMatchObject({ correct: true, retired: true });
    expect(session.mastered).toBeGreaterThanOrEqual(1);
  });

  it("resets the streak on a wrong answer and keeps the question in the pool", () => {
    const session = new Session(makeQuiz(), null, seeded(2));
    session.next();
    answer(session, true);
    expect(session.streak).toBe(1);
    const q = session.current!;
    session.next(); // moves on; find q again
    let guard = 0;
    while (session.current !== q) {
      answer(session, true);
      session.next();
      if (++guard > 50) throw new Error("question never came back");
    }
    const result = answer(session, false);
    expect(result).toMatchObject({ correct: false, retired: false, correctAnswer: q.answer });
    expect(session.streak).toBe(0);
    expect(session.mostMissed(5)).toEqual([{ question: q, missed: 1 }]);
  });

  it("finishes when every question is retired", () => {
    const session = new Session(makeQuiz(), null, seeded(3));
    let asked = 0;
    while (session.next()) {
      answer(session, true);
      if (++asked > 100) throw new Error("did not finish");
    }
    expect(session.mastered).toBe(session.total);
    expect(session.current).toBeNull();
    expect(asked).toBe(session.total * REQUIRED_STREAK);
  });

  it("never asks the same question twice in a row while others remain", () => {
    const session = new Session(makeQuiz(), null, seeded(4));
    let previous = null;
    for (let i = 0; i < 40; i++) {
      const q = session.next();
      if (!q) break;
      if (session.mastered < session.total - 1) expect(q).not.toBe(previous);
      previous = q;
      answer(session, false); // never retire anything
    }
  });

  it("may repeat the last remaining question", () => {
    const quiz = makeQuiz({ questions: makeQuiz().questions.slice(0, 2) });
    const session = new Session(quiz, null, seeded(5));
    while (session.mastered < 1) {
      session.next();
      answer(session, true);
    }
    const remaining = session.next();
    expect(remaining).not.toBeNull();
    expect(session.next()).toBe(remaining);
  });

  it("returns the first result if answered twice", () => {
    const session = new Session(makeQuiz(), null, seeded(6));
    session.next();
    const first = answer(session, false);
    expect(session.answer(session.current!.answer)).toBe(first);
    expect(session.streak).toBe(0);
  });

  it("always includes the correct answer among the choices", () => {
    const session = new Session(makeQuiz(), null, seeded(7));
    for (let i = 0; i < 20; i++) {
      session.next();
      expect(session.choices).toContain(session.current!.answer);
      answer(session, false);
    }
  });
});

describe("Session progress", () => {
  it("round-trips through toProgress", () => {
    const quiz = makeQuiz();
    const a = new Session(quiz, null, seeded(8));
    a.next();
    answer(a, false);
    const saved = a.toProgress();

    const b = new Session(quiz, JSON.parse(JSON.stringify(saved)), seeded(9));
    expect(b.toProgress()).toEqual(saved);
  });

  it("restores retired questions and streaks", () => {
    const quiz = makeQuiz();
    const session = new Session(quiz, null, seeded(10));
    while (session.mastered < 2) {
      session.next();
      answer(session, true);
    }
    const restored = new Session(quiz, session.toProgress(), seeded(11));
    expect(restored.mastered).toBe(session.mastered);
    expect(masteredCount(quiz, session.toProgress())).toBe(session.mastered);
  });

  it("ignores progress recorded against another quiz version", () => {
    const quiz = makeQuiz();
    const old = new Session(quiz, null, seeded(12));
    old.next();
    answer(old, true);
    const stored = old.toProgress();

    const updated = makeQuiz({ version: 2 });
    expect(progressIsStale(updated, stored)).toBe(true);
    expect(progressIsStale(quiz, stored)).toBe(false);
    expect(progressIsStale(quiz, null)).toBe(false);
    expect(masteredCount(updated, stored)).toBe(0);
    expect(new Session(updated, stored).mastered).toBe(0);
  });

  it("drops progress for questions that no longer exist", () => {
    const quiz = makeQuiz();
    const s = new Session(quiz, null, seeded(13));
    s.next();
    answer(s, true);
    const trimmed = makeQuiz({ questions: quiz.questions.slice(0, 2) });
    expect(Object.keys(new Session(trimmed, s.toProgress()).toProgress().questions)).toHaveLength(2);
  });

  it("copes with junk in saved progress", () => {
    const quiz = makeQuiz();
    const junk = {
      version: 1,
      questions: { nope: 5, [Object.keys(new Session(quiz).toProgress().questions)[0]]: { streak: "x", seen: -3, retired: "yes" } },
    };
    const session = new Session(quiz, junk as never);
    expect(session.mastered).toBe(0);
    expect(Object.values(session.toProgress().questions).every((p) => p.streak === 0 && p.seen === 0)).toBe(true);
  });
});
