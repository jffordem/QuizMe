import { describe, expect, it } from "vitest";
import { buildChoices, shuffle, wrongAnswerPool, WRONG_SHOWN } from "../src/choices.ts";
import type { Question } from "../src/quiz.ts";
import { seeded } from "./helpers.ts";

const q = (text: string, answer: string, extra: Partial<Question> = {}): Question => ({ q: text, answer, ...extra });

describe("shuffle", () => {
  it("keeps every item and does not modify the input", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(input, seeded(1));
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("wrongAnswerPool", () => {
  it("uses only the question's own distractors when there are enough, however many", () => {
    const question = q("Q", "A", { distractors: ["w1", "w2", "w3", "w4", "w5", "w6"] });
    const other = q("Other", "Z");
    expect(wrongAnswerPool(question, [question, other])).toEqual(["w1", "w2", "w3", "w4", "w5", "w6"]);
  });

  it("tops up from other questions' answers when there are too few distractors", () => {
    const question = q("Q", "A", { distractors: ["w1"] });
    const pool = wrongAnswerPool(question, [question, q("O1", "X"), q("O2", "Y")]);
    expect(pool).toEqual(["w1", "X", "Y"]);
  });

  it("tops up only from the same group when the question has one", () => {
    const question = q("Q", "Rue", { group: "people" });
    const questions = [question, q("O1", "Cato", { group: "people" }), q("O2", "1066", { group: "dates" }), q("O3", "1492")];
    expect(wrongAnswerPool(question, questions)).toEqual(["Cato"]);
  });

  it("removes duplicates and the correct answer, ignoring case and spacing", () => {
    const question = q("Q", "Paris", { distractors: ["paris ", "Lyon", "lyon"] });
    const other = q("O", "PARIS");
    expect(wrongAnswerPool(question, [question, other])).toEqual(["Lyon"]);
  });
});

describe("buildChoices", () => {
  const questions = [
    q("Q1", "A", { distractors: ["a1", "a2", "a3", "a4", "a5", "a6"] }),
    q("Q2", "B"),
    q("Q3", "C"),
  ];

  it("returns the correct answer plus three wrong ones, all distinct", () => {
    const choices = buildChoices(questions[0], questions, seeded(3));
    expect(choices).toHaveLength(1 + WRONG_SHOWN);
    expect(choices).toContain("A");
    expect(new Set(choices).size).toBe(choices.length);
    for (const c of choices.filter((c) => c !== "A")) expect(["a1", "a2", "a3", "a4", "a5", "a6"]).toContain(c);
  });

  it("varies across showings when the wrong-answer pool is larger than what is shown", () => {
    const rng = seeded(7);
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) for (const c of buildChoices(questions[0], questions, rng)) seen.add(c);
    expect(seen.size).toBe(7); // "A" plus all six wrong answers show up over time
  });

  it("shows fewer choices when fewer wrong answers exist", () => {
    const tiny = [q("Q1", "A"), q("Q2", "B")];
    expect([...buildChoices(tiny[0], tiny, seeded(1))].sort()).toEqual(["A", "B"]);
  });

  it("puts the correct answer in different positions", () => {
    const rng = seeded(11);
    const positions = new Set<number>();
    for (let i = 0; i < 40; i++) positions.add(buildChoices(questions[0], questions, rng).indexOf("A"));
    expect(positions.size).toBe(4);
  });
});
