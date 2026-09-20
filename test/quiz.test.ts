import { describe, expect, it } from "vitest";
import { parseLibrary, parseQuiz } from "../src/quiz.ts";
import { questionKey } from "../src/text.ts";

const valid = () => ({
  id: "sample",
  title: "Sample",
  version: 1,
  questions: [
    { q: "One?", answer: "a", distractors: ["b", "c"] },
    { q: "Two?", answer: "d" },
  ],
});

describe("parseQuiz", () => {
  it("accepts a valid quiz", () => {
    const { quiz, errors } = parseQuiz(valid(), "sample.json");
    expect(errors).toEqual([]);
    expect(quiz?.questions).toHaveLength(2);
    expect(quiz?.questions[0].distractors).toEqual(["b", "c"]);
  });

  it("rejects a non-object", () => {
    expect(parseQuiz([], "x.json").errors[0]).toContain("top level must be an object");
  });

  it.each([
    ["bad id", (d: any) => (d.id = "Has Spaces"), '"id"'],
    ["missing title", (d: any) => delete d.title, '"title"'],
    ["bad version", (d: any) => (d.version = 0), '"version"'],
    ["no questions", (d: any) => (d.questions = []), '"questions"'],
    ["blank answer", (d: any) => (d.questions[1].answer = "  "), '"answer"'],
    ["non-list distractors", (d: any) => (d.questions[0].distractors = "b"), '"distractors"'],
    ["answer in distractors", (d: any) => (d.questions[0].distractors = ["A ", "c"]), "also listed in distractors"],
    ["repeated distractor", (d: any) => (d.questions[0].distractors = ["b", "B"]), "listed twice"],
    ["duplicate question", (d: any) => (d.questions[1].q = "one?"), "same text as question 1"],
    ["blank group", (d: any) => (d.questions[0].group = ""), '"group"'],
  ])("reports %s", (_name, mutate, expected) => {
    const data = valid();
    mutate(data);
    const { quiz, errors } = parseQuiz(data, "sample.json");
    expect(quiz).toBeNull();
    expect(errors.join("\n")).toContain(expected);
    expect(errors.every((e) => e.startsWith("sample.json: "))).toBe(true);
  });

  it("names the question at fault", () => {
    const data = valid();
    data.questions[1].answer = "";
    expect(parseQuiz(data, "s.json").errors[0]).toContain('question 2 ("Two?")');
  });

  it("requires at least one wrong answer to be available for every question", () => {
    const data = { ...valid(), questions: [{ q: "Only one?", answer: "yes" }] };
    expect(parseQuiz(data, "s.json").errors[0]).toContain("no wrong answers available");
  });

  it("a group with no other members needs its own distractors", () => {
    const data = {
      ...valid(),
      questions: [
        { q: "A?", answer: "a", group: "g1" },
        { q: "B?", answer: "b", group: "g2" },
      ],
    };
    expect(parseQuiz(data, "s.json").errors.join("\n")).toContain('group "g1"');
  });
});

describe("parseLibrary", () => {
  it("collects quizzes and errors across files", () => {
    const bad = { ...valid(), id: "other", title: "" };
    const lib = parseLibrary({ "b.json": valid(), "a.json": bad });
    expect(lib.quizzes.map((q) => q.id)).toEqual(["sample"]);
    expect(lib.errors).toHaveLength(1);
  });

  it("rejects duplicate ids across files", () => {
    const lib = parseLibrary({ "a.json": valid(), "b.json": valid() });
    expect(lib.quizzes).toHaveLength(1);
    expect(lib.errors).toEqual(['b.json: id "sample" is already used by a.json']);
  });
});

describe("questionKey", () => {
  it("ignores case and spacing but not wording", () => {
    expect(questionKey("  What  is X? ")).toBe(questionKey("what is x?"));
    expect(questionKey("What is X?")).not.toBe(questionKey("What is Y?"));
  });
});
