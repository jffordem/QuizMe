// Quiz file types and validation. Validation runs at build time (see
// vite.config.ts) so a bad quiz fails the deploy, and again at load time so the
// app works with typed data.
import { wrongAnswerPool } from "./choices.ts";
import { normalize, questionKey } from "./text.ts";

export interface Question {
  q: string;
  answer: string;
  /** Wrong answers; any number. Optional. */
  distractors?: string[];
  /** Other questions in the same group supply plausible wrong answers. */
  group?: string;
}

export interface Quiz {
  id: string;
  title: string;
  /** Bump when a change would make old progress misleading. */
  version: number;
  questions: Question[];
}

export interface ParseResult {
  quiz: Quiz | null;
  errors: string[];
}

export interface Library {
  quizzes: Quiz[];
  errors: string[];
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isText(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

function preview(text: string): string {
  return text.length > 40 ? `${text.slice(0, 37)}...` : text;
}

/** Validate one parsed quiz file. `file` is only used in error messages. */
export function parseQuiz(raw: unknown, file: string): ParseResult {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(`${file}: ${msg}`);

  if (!isRecord(raw)) {
    err("top level must be an object");
    return { quiz: null, errors };
  }

  if (!isText(raw.id) || !ID_PATTERN.test(raw.id)) {
    err('"id" must be lowercase letters, digits and hyphens (e.g. "hunger-games")');
  }
  if (!isText(raw.title)) err('"title" must be a non-empty string');
  if (!Number.isInteger(raw.version) || (raw.version as number) < 1) {
    err('"version" must be a whole number, 1 or more');
  }
  if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
    err('"questions" must be a non-empty list');
    return { quiz: null, errors };
  }

  const questions: Question[] = [];
  const seenKeys = new Map<string, number>();

  raw.questions.forEach((item: unknown, index: number) => {
    const n = index + 1;
    if (!isRecord(item)) {
      err(`question ${n}: must be an object`);
      return;
    }
    const label = isText(item.q) ? `question ${n} ("${preview(item.q)}")` : `question ${n}`;
    const qErr = (msg: string) => err(`${label}: ${msg}`);

    if (!isText(item.q)) qErr('"q" must be a non-empty string');
    if (!isText(item.answer)) qErr('"answer" must be a non-empty string');
    if (item.group !== undefined && !isText(item.group)) qErr('"group" must be a non-empty string');

    let distractors: string[] | undefined;
    if (item.distractors !== undefined) {
      if (!Array.isArray(item.distractors) || !item.distractors.every(isText)) {
        qErr('"distractors" must be a list of non-empty strings');
      } else {
        distractors = item.distractors as string[];
        const seen = new Set<string>();
        for (const d of distractors) {
          const key = normalize(d);
          if (isText(item.answer) && key === normalize(item.answer)) {
            qErr(`answer "${item.answer}" is also listed in distractors`);
          }
          if (seen.has(key)) qErr(`distractor "${d}" is listed twice`);
          seen.add(key);
        }
      }
    }

    if (isText(item.q)) {
      const key = questionKey(item.q);
      const first = seenKeys.get(key);
      if (first !== undefined) qErr(`same text as question ${first}`);
      else seenKeys.set(key, n);
    }

    if (isText(item.q) && isText(item.answer)) {
      const question: Question = { q: item.q, answer: item.answer };
      if (distractors) question.distractors = distractors;
      if (isText(item.group)) question.group = item.group;
      questions.push(question);
    }
  });

  if (errors.length > 0) return { quiz: null, errors };

  const quiz: Quiz = {
    id: raw.id as string,
    title: raw.title as string,
    version: raw.version as number,
    questions,
  };

  // Every question needs at least one wrong answer to offer (two choices minimum).
  quiz.questions.forEach((question, index) => {
    if (wrongAnswerPool(question, quiz.questions).length === 0) {
      const hint =
        question.group !== undefined
          ? `add distractors, or other questions in group "${question.group}"`
          : "add distractors, or more questions to the quiz";
      err(`question ${index + 1} ("${preview(question.q)}"): no wrong answers available; ${hint}`);
    }
  });

  return errors.length > 0 ? { quiz: null, errors } : { quiz, errors };
}

/** Validate every quiz file, plus cross-file rules (unique ids). Keys are file names. */
export function parseLibrary(files: Record<string, unknown>): Library {
  const quizzes: Quiz[] = [];
  const errors: string[] = [];
  const idOwner = new Map<string, string>();

  for (const file of Object.keys(files).sort()) {
    const result = parseQuiz(files[file], file);
    errors.push(...result.errors);
    if (!result.quiz) continue;

    const owner = idOwner.get(result.quiz.id);
    if (owner !== undefined) {
      errors.push(`${file}: id "${result.quiz.id}" is already used by ${owner}`);
      continue;
    }
    idOwner.set(result.quiz.id, file);
    quizzes.push(result.quiz);
  }

  return { quizzes, errors };
}
