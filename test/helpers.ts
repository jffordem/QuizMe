import type { Quiz } from "../src/quiz.ts";

/** Small deterministic RNG (mulberry32) so tests don't depend on Math.random. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: "sample",
    title: "Sample",
    version: 1,
    questions: [
      { q: "Capital of France?", answer: "Paris", distractors: ["Lyon", "Nice", "Lille", "Nantes"] },
      { q: "Capital of Italy?", answer: "Rome" },
      { q: "Capital of Spain?", answer: "Madrid" },
      { q: "Capital of Germany?", answer: "Berlin" },
    ],
    ...overrides,
  };
}
