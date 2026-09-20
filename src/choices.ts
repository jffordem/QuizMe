// Builds the answer choices shown for a question. Pure; randomness is injected
// so tests can be deterministic. See QUIZ-GAME.md section 4.2.
import type { Question } from "./quiz.ts";
import { normalize } from "./text.ts";

export type Rng = () => number;

/** How many wrong answers to show alongside the correct one. */
export const WRONG_SHOWN = 3;

/** Fisher-Yates shuffle; returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Drop duplicates (by normalized text) and anything equal to `exclude`. */
function unique(items: readonly string[], exclude: string): string[] {
  const seen = new Set([normalize(exclude)]);
  const out: string[] = [];
  for (const item of items) {
    const key = normalize(item);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

/**
 * Wrong answers this question may draw from. Its own distractors are used as
 * they are when there are enough; otherwise they are topped up with the answers
 * of other questions (same `group` if the question has one, otherwise any).
 */
export function wrongAnswerPool(
  question: Question,
  questions: readonly Question[],
  wanted: number = WRONG_SHOWN,
): string[] {
  const own = unique(question.distractors ?? [], question.answer);
  if (own.length >= wanted) return own;

  const others = questions
    .filter((o) => o !== question && (question.group === undefined || o.group === question.group))
    .map((o) => o.answer);
  return unique([...own, ...others], question.answer);
}

/** The shuffled choices for one showing of a question (correct answer included). */
export function buildChoices(
  question: Question,
  questions: readonly Question[],
  rng: Rng = Math.random,
  wanted: number = WRONG_SHOWN,
): string[] {
  const pool = wrongAnswerPool(question, questions, wanted);
  const wrong = shuffle(pool, rng).slice(0, wanted);
  return shuffle([question.answer, ...wrong], rng);
}
